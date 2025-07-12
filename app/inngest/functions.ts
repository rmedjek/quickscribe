// app/inngest/functions.ts
import prisma from "@/lib/prisma";
import {prepareAudioFromFileBlob, splitAudio} from "@/lib/file-processor";
import {JobStatus} from "@prisma/client";
import {prepareAudioFromLink} from "@/lib/link-processor";
import {transcribeAudioAction} from "@/actions/transcribeAudioAction";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {R2} from "@/lib/r2";
import * as fs from "node:fs/promises";
import {revalidatePath} from "next/cache";
import path from "node:path";
import {AppEvents, inngest} from "./client";
import {env} from "@/lib/env.mjs";

function generateCaptionsFromText(
  text: string,
  startTime: number,
  duration: number
) {
  const vttSegment = `${formatTimestamp(
    startTime,
    "vtt"
  )} --> ${formatTimestamp(startTime + duration, "vtt")}\n${text}\n`;
  const srtSegment = `1\n${formatTimestamp(
    startTime,
    "srt"
  )} --> ${formatTimestamp(startTime + duration, "srt")}\n${text}\n`;
  return {vtt: vttSegment, srt: srtSegment};
}

function formatTimestamp(seconds: number, format: "srt" | "vtt"): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  const separator = format === "srt" ? "," : ".";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}${separator}${String(ms).padStart(
    3,
    "0"
  )}`;
}

const mainWorker = inngest.createFunction(
  {id: "process-submitted-media", concurrency: {limit: 10}},
  {event: "media.submitted"},
  async ({event, step}) => {
    const {
      jobId,
      isLinkJob,
      linkUrl,
      blobUrl,
      originalFileName,
      transcriptionMode,
    } = event.data;
    let tempAudioPath: string | null = null;

    console.log(`[Orchestrator] Starting job ${jobId}`);

    try {
      const prepResult = await step.run("1-prepare-audio", async () => {
        return isLinkJob
          ? await prepareAudioFromLink(linkUrl!)
          : await prepareAudioFromFileBlob(blobUrl!, originalFileName!);
      });
      if (!prepResult.success) throw new Error(prepResult.error);
      tempAudioPath = prepResult.tempAudioPath;

      const stats = await fs.stat(tempAudioPath);
      const audioSizeMB = stats.size / (1024 * 1024);
      const GROQ_LIMIT_MB = 24;
      let strategy: "SINGLE" | "CHUNKED" =
        audioSizeMB > GROQ_LIMIT_MB ? "CHUNKED" : "SINGLE";

      if (env.FORCE_V1_PROCESSING === "true") {
        strategy = "SINGLE";
        console.log(
          `[Orchestrator] FORCE_V1_PROCESSING is true. Forcing SINGLE strategy for job ${jobId}.`
        );
      }

      await step.run("set-processing-strategy-and-status", () =>
        prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            processing_strategy: strategy,
            status:
              strategy === "SINGLE" ? JobStatus.PROCESSING : JobStatus.CHUNKING,
            startedAt: new Date(),
          },
        })
      );
      revalidatePath("/");
      console.log(`[Orchestrator] Job ${jobId} assigned strategy: ${strategy}`);

      if (strategy === "SINGLE") {
        const transcriptionResult = await step.run(
          "2a-transcribe-single-file",
          async () => {
            const audioBuffer = await fs.readFile(tempAudioPath!);
            const formData = new FormData();
            formData.append(
              "audioBlob",
              new Blob([audioBuffer], {type: "audio/opus"}),
              prepResult.audioFileName
            );
            return await transcribeAudioAction(formData, transcriptionMode);
          }
        );

        if (!transcriptionResult.success || !transcriptionResult.data) {
          throw new Error(
            transcriptionResult.error || "Transcription returned no data."
          );
        }

        await step.run("3a-update-final-job", async () => {
          return prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {
              status: JobStatus.COMPLETED,
              completedAt: new Date(),
              transcriptText: transcriptionResult.data!.text,
              transcriptSrt: transcriptionResult.data!.srtContent,
              transcriptVtt: transcriptionResult.data!.vttContent,
              duration: transcriptionResult.data!.duration,
              language: transcriptionResult.data!.language,
              errorMessage: null,
            },
          });
        });

        if (!isLinkJob) {
          await step.run("4a-cleanup-v1-source-blob", async () => {
            const key = new URL(blobUrl!).pathname.substring(1);
            const deleteCommand = new DeleteObjectCommand({
              Bucket: env.R2_BUCKET_NAME,
              Key: key,
            });
            await R2.send(deleteCommand);
            console.log(`[V1-Worker] Cleaned up source blob from R2: ${key}`);
          });
        }
        console.log(`[V1-Worker] Job ${jobId} completed successfully.`);
      } else {
        const splitResult = await step.run(
          "3b-split-audio-into-chunks",
          async () => {
            return await splitAudio(tempAudioPath!, jobId);
          }
        );
        if (!splitResult.success) throw new Error(splitResult.error);

        const chunkEvents = await step.run(
          "4b-upload-chunks-and-prepare-events",
          async () => {
            const events: {
              name: "audio.chunk.ready";
              data: AppEvents["audio.chunk.ready"]["data"];
            }[] = [];

            for (const chunk of splitResult.chunks) {
              const chunkFileBuffer = await fs.readFile(chunk.filePath);
              const key = `chunks/${jobId}/${chunk.fileName}`;

              const putCommand = new PutObjectCommand({
                Bucket: env.R2_BUCKET_NAME,
                Key: key,
                Body: chunkFileBuffer,
                ContentType: "audio/opus",
              });
              await R2.send(putCommand);
              const chunkUrl = `https://${env.R2_PUBLIC_HOSTNAME}/${key}`;

              await prisma.jobChunk.create({
                data: {
                  jobId: jobId,
                  chunk_index: chunk.index,
                  start_time: chunk.startTime,
                  end_time: chunk.endTime,
                  blob_url: chunkUrl,
                  status: JobStatus.PENDING,
                },
              });

              events.push({
                name: "audio.chunk.ready",
                data: {
                  parentJobId: jobId,
                  chunkIndex: chunk.index,
                  chunkUrl: chunkUrl,
                  transcriptionMode: transcriptionMode,
                },
              });
              await fs.unlink(chunk.filePath);
            }

            await fs.rm(path.dirname(splitResult.chunks[0].filePath), {
              recursive: true,
              force: true,
            });
            return events;
          }
        );

        await step.sendEvent("5b-fan-out-chunk-jobs", chunkEvents);

        await step.run("6b-update-job-for-processing", () =>
          prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {
              status: JobStatus.PROCESSING_CHUNKS,
              chunks_total: chunkEvents.length,
            },
          })
        );
        console.log(
          `[V2-Orchestrator] Fanned out ${chunkEvents.length} jobs for job: ${jobId}`
        );
      }
      revalidatePath("/");
    } catch (error: any) {
      console.error(`[Orchestrator] Error processing job ${jobId}:`, error);
      await step.run("x-update-failure-in-db", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: JobStatus.FAILED,
            errorMessage:
              error.message || "An unknown processing error occurred.",
          },
        });
      });
      revalidatePath("/");
      throw error;
    } finally {
      if (tempAudioPath) {
        await fs
          .unlink(tempAudioPath)
          .catch((e) =>
            console.error(`Cleanup failed for ${tempAudioPath}`, e)
          );
      }
    }
  }
);

const transcribeChunkWorker = inngest.createFunction(
  {id: "transcribe-audio-chunk", concurrency: {limit: 3}},
  {event: "audio.chunk.ready"},
  async ({event, step}) => {
    const {parentJobId, chunkIndex, chunkUrl, transcriptionMode} = event.data;
    console.log(
      `[V2-ChunkWorker] Processing chunk ${chunkIndex} for job ${parentJobId}`
    );

    try {
      // --- THIS IS THE REFACTOR ---
      // 1. Download the audio chunk directly, OUTSIDE of a step.
      // The function's ephemeral filesystem will hold the data.
      console.log(`[V2-ChunkWorker] Downloading chunk from ${chunkUrl}`);
      const response = await fetch(chunkUrl);
      if (!response.ok)
        throw new Error(`Failed to download chunk ${chunkIndex}`);
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(
        `[V2-ChunkWorker] Downloaded chunk ${chunkIndex}, size: ${audioBuffer.length} bytes`
      );

      // 2. Now, use steps for the parts that change state or call external APIs.
      await step.run("update-chunk-status-to-processing", async () => {
        await prisma.jobChunk.updateMany({
          where: {jobId: parentJobId, chunk_index: chunkIndex},
          data: {status: "PROCESSING"},
        });
      });

      // 3. The transcribe step now uses the buffer from the top-level scope.
      const transcriptionResult = await step.run(
        "transcribe-chunk",
        async () => {
          const formData = new FormData();
          formData.append(
            "audioBlob",
            new Blob([audioBuffer], {type: "audio/opus"}),
            `chunk.opus`
          );
          return await transcribeAudioAction(formData, transcriptionMode);
        }
      );
      // --- END REFACTOR ---

      if (!transcriptionResult.success || !transcriptionResult.data?.text) {
        throw new Error(
          transcriptionResult.error ||
            "Transcription of chunk failed to produce text."
        );
      }

      await step.run("save-chunk-transcript", async () => {
        await prisma.jobChunk.updateMany({
          where: {jobId: parentJobId, chunk_index: chunkIndex},
          data: {
            status: "COMPLETED",
            transcript: transcriptionResult.data!.text,
          },
        });
      });

      const updatedJob = await step.run(
        "increment-parent-job-progress",
        async () => {
          return prisma.transcriptionJob.update({
            where: {id: parentJobId},
            data: {
              chunks_completed: {
                increment: 1,
              },
            },
          });
        }
      );

      console.log(
        `[V2-ChunkWorker] Completed chunk ${chunkIndex} for job ${parentJobId}`
      );

      if (updatedJob.chunks_completed === updatedJob.chunks_total) {
        console.log(
          `[V2-ChunkWorker] All chunks for job ${parentJobId} are complete. Triggering assembly.`
        );
        await step.sendEvent("trigger-assembly", {
          name: "job.assembly.ready",
          data: {jobId: parentJobId},
        });
      }

      return {success: true, chunkIndex};
    } catch (error: any) {
      console.error(
        `[V2-ChunkWorker] Error processing chunk ${chunkIndex} for job ${parentJobId}:`,
        error
      );
      await step.run("mark-chunk-as-failed", async () => {
        await prisma.jobChunk.updateMany({
          where: {jobId: parentJobId, chunk_index: chunkIndex},
          data: {status: "FAILED"},
        });
      });
      await step.run("mark-parent-job-as-failed", async () => {
        await prisma.transcriptionJob.update({
          where: {id: parentJobId},
          data: {
            status: JobStatus.FAILED,
            errorMessage: `Processing failed on chunk #${chunkIndex}.`,
          },
        });
      });
      revalidatePath("/");
      throw error;
    }
  }
);

const assemblyWorker = inngest.createFunction(
  {id: "assemble-chunked-transcript"},
  {event: "job.assembly.ready"},
  async ({event, step}) => {
    const {jobId} = event.data;

    console.log(
      `[V2-AssemblyWorker] Assembling final transcript for job ${jobId}`
    );

    await step.run("update-status-to-assembling", () =>
      prisma.transcriptionJob.update({
        where: {id: jobId},
        data: {status: JobStatus.ASSEMBLING},
      })
    );
    revalidatePath("/");

    try {
      const chunks = await step.run("fetch-all-chunks", async () => {
        return prisma.jobChunk.findMany({
          where: {jobId: jobId, status: "COMPLETED"},
          orderBy: {chunk_index: "asc"},
        });
      });

      const parentJob = await step.run("get-parent-job", async () => {
        return prisma.transcriptionJob.findUnique({where: {id: jobId}});
      });

      if (!parentJob || chunks.length !== parentJob.chunks_total) {
        throw new Error(
          `Assembly failed: Mismatch in completed chunks. Expected ${parentJob?.chunks_total}, found ${chunks.length}.`
        );
      }

      const finalResult = await step.run("stitch-transcripts", () => {
        let combinedText = "";
        let combinedSrt = "";
        let combinedVtt = "WEBVTT\n\n";
        let srtCounter = 1;

        for (const chunk of chunks) {
          if (chunk.transcript) {
            combinedText += chunk.transcript + " ";

            const {vtt: vttSegment, srt: srtSegment} = generateCaptionsFromText(
              chunk.transcript,
              chunk.start_time,
              chunk.end_time - chunk.start_time
            );

            combinedVtt += vttSegment + "\n";
            combinedSrt +=
              srtSegment.replace(/^1\n/, `${srtCounter++}\n`) + "\n";
          }
        }
        return {
          text: combinedText.trim(),
          srt: combinedSrt.trim(),
          vtt: combinedVtt.trim(),
        };
      });

      await step.run("update-parent-job-with-final-transcript", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            transcriptText: finalResult.text,
            transcriptSrt: finalResult.srt,
            transcriptVtt: finalResult.vtt,
            errorMessage: null,
          },
        });
      });

      revalidatePath("/");
      console.log(`[V2-AssemblyWorker] Successfully assembled job ${jobId}`);

      await step.run("cleanup-all-r2-files", async () => {
        const chunkKeys = chunks.map((c) =>
          new URL(c.blob_url).pathname.substring(1)
        );
        const sourceKey = new URL(parentJob.fileUrl).pathname.substring(1);
        const keysToDelete = [...chunkKeys, sourceKey].map((key) => ({
          Key: key,
        }));

        const deleteCommand = new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET_NAME,
          Delete: {Objects: keysToDelete},
        });
        await R2.send(deleteCommand);
        console.log(
          `[V2-AssemblyWorker] Cleaned up source file and ${chunkKeys.length} chunks from R2 for job ${jobId}`
        );
      });

      return {success: true, jobId};
    } catch (error: any) {
      console.error(
        `[V2-AssemblyWorker] Error assembling job ${jobId}:`,
        error
      );
      await step.run("mark-assembly-as-failed", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: JobStatus.FAILED,
            errorMessage: `Assembly failed: ${error.message}`,
          },
        });
      });
      revalidatePath("/");
      throw error;
    }
  }
);

export const functions = [mainWorker, transcribeChunkWorker, assemblyWorker];
