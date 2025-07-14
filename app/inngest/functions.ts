// app/inngest/functions.ts
import prisma from "@/lib/prisma";
import {JobStatus} from "@prisma/client";
import {inngest} from "./client";
import {env} from "@/lib/env.mjs";
import {prepareAudioFromFileBlob, splitAudio} from "@/lib/file-processor";
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
import ffmpeg from "fluent-ffmpeg";
import {promisify} from "util";

const ffprobeAsync = promisify<string, ffmpeg.FfprobeData>(ffmpeg.ffprobe);

// --- HELPER FUNCTIONS ---
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

function generateCaptionsFromText(
  text: string,
  startTime: number,
  duration: number
) {
  const vttSegment = `${formatTimestamp(
    startTime,
    "vtt"
  )} --> ${formatTimestamp(startTime + duration, "vtt")}\n${text.trim()}\n`;
  const srtSegment = `1\n${formatTimestamp(
    startTime,
    "srt"
  )} --> ${formatTimestamp(startTime + duration, "srt")}\n${text.trim()}\n`;
  return {vtt: vttSegment, srt: srtSegment};
}

// --- WORKER 1: The "Scheduler" Orchestrator ---
const mainWorker = inngest.createFunction(
  {id: "process-media-scheduler", concurrency: {limit: 2}},
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

    const prepData = await step.run(
      "1-prepare-and-decide-strategy",
      async () => {
        const prepResult = isLinkJob
          ? await prepareAudioFromLink(linkUrl!)
          : await prepareAudioFromFileBlob(blobUrl!, originalFileName!);
        if (!prepResult.success) throw new Error(prepResult.error);
        const stats = await fs.stat(prepResult.tempAudioPath);
        const audioSizeMB = stats.size / (1024 * 1024);
        const GROQ_LIMIT_MB = 24;
        let strategy: "SINGLE" | "CHUNKED" =
          audioSizeMB > GROQ_LIMIT_MB ? "CHUNKED" : "SINGLE";
        if (env.FORCE_V1_PROCESSING === "true") {
          strategy = "SINGLE";
        }

        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            processing_strategy: strategy,
            status:
              strategy === "SINGLE" ? JobStatus.PROCESSING : JobStatus.CHUNKING,
            startedAt: new Date(),
          },
        });
        revalidatePath("/");
        return {strategy, tempAudioPath: prepResult.tempAudioPath};
      }
    );

    if (!prepData) throw new Error("Preparation step failed to resume.");

    try {
      if (prepData.strategy === "SINGLE") {
        const transcriptionResult = await step.run(
          "2a-transcribe-single-file",
          async () => {
            const audioBuffer = await fs.readFile(prepData.tempAudioPath);
            return await transcribeAudioAction(
              audioBuffer,
              "source.opus",
              transcriptionMode
            );
          }
        );
        if (!transcriptionResult?.success)
          throw new Error(
            transcriptionResult?.error || "Transcription returned no data."
          );

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
          });
        }
      } else {
        // CHUNKED
        const chunks = await step.run(
          "2b-split-and-upload-chunks",
          async () => {
            const probeData = await ffprobeAsync(prepData.tempAudioPath);
            const totalDuration = probeData.format.duration || 0;
            const stats = await fs.stat(prepData.tempAudioPath);
            const totalSizeMB = stats.size / (1024 * 1024);
            const TARGET_CHUNK_SIZE_MB = 24;
            const numChunks = Math.ceil(totalSizeMB / TARGET_CHUNK_SIZE_MB);
            const chunkDurationSec = Math.ceil(totalDuration / numChunks);
            const splitResult = await splitAudio(
              prepData.tempAudioPath,
              jobId,
              chunkDurationSec
            );
            if (!splitResult.success) throw new Error(splitResult.error);
            const chunkDataForScheduling = [];
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
                  jobId,
                  chunk_index: chunk.index,
                  start_time: chunk.startTime,
                  end_time: chunk.endTime,
                  blob_url: chunkUrl,
                  status: "PENDING",
                },
              });
              chunkDataForScheduling.push({index: chunk.index, url: chunkUrl});
              await fs.unlink(chunk.filePath);
            }
            await fs.rm(path.dirname(splitResult.chunks[0].filePath), {
              recursive: true,
              force: true,
            });
            await prisma.transcriptionJob.update({
              where: {id: jobId},
              data: {chunks_total: splitResult.chunks.length},
            });
            return chunkDataForScheduling;
          }
        );

        if (!chunks)
          throw new Error("Chunk splitting step did not resume correctly.");

        const eventsToSchedule = chunks.map((chunk, i) => {
          const COOLDOWN_MINUTES = 2;
          const delay = i === 0 ? "0s" : `${i * COOLDOWN_MINUTES}m`;
          return {
            name: "audio.chunk.ready.v3" as const,
            data: {
              parentJobId: jobId,
              chunkIndex: chunk.index,
              chunkUrl: chunk.url,
              transcriptionMode,
            },
            after: delay,
          };
        });

        await step.sendEvent("3b-schedule-chunk-jobs", eventsToSchedule);

        await step.run("4b-update-status-to-processing-chunks", () =>
          prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {status: JobStatus.PROCESSING_CHUNKS},
          })
        );
      }
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
      if (prepData?.tempAudioPath) {
        await fs
          .unlink(prepData.tempAudioPath)
          .catch((e) => console.error(`Temp file cleanup failed`, e));
      }
    }
  }
);

// --- WORKER 2: The "Dumb" Processor ---
const transcribeChunkWorker = inngest.createFunction(
  {id: "transcribe-audio-chunk-v3"},
  {event: "audio.chunk.ready.v3"},
  async ({event, step}) => {
    const {parentJobId, chunkIndex, chunkUrl, transcriptionMode} = event.data;
    try {
      await step.run("update-chunk-status", () =>
        prisma.jobChunk.updateMany({
          where: {jobId: parentJobId, chunk_index: chunkIndex},
          data: {status: "PROCESSING"},
        })
      );

      const transcriptionResult = await step.run(
        "transcribe-the-chunk",
        async () => {
          const response = await fetch(chunkUrl);
          if (!response.ok)
            throw new Error(`Download failed for chunk ${chunkIndex}`);
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          return await transcribeAudioAction(
            audioBuffer,
            `chunk_${chunkIndex}.opus`,
            transcriptionMode
          );
        }
      );

      if (!transcriptionResult.success)
        throw new Error(transcriptionResult.error);

      const updatedJob = await step.run("save-and-progress", async () => {
        await prisma.jobChunk.updateMany({
          where: {jobId: parentJobId, chunk_index: chunkIndex},
          data: {
            status: "COMPLETED",
            transcript: transcriptionResult.data!.text,
          },
        });
        return await prisma.transcriptionJob.update({
          where: {id: parentJobId},
          data: {chunks_completed: {increment: 1}},
        });
      });

      if (
        updatedJob &&
        updatedJob.chunks_completed === updatedJob.chunks_total
      ) {
        await step.sendEvent("trigger-assembly", {
          name: "job.assembly.ready",
          data: {jobId: parentJobId},
        });
      }
    } catch (error) {
      // Simple failure - just let Inngest's default retries handle it.
      // The long delay between jobs will prevent cascading failures.
      await step.run("mark-parent-job-as-failed", async () => {
        await prisma.transcriptionJob.update({
          where: {id: parentJobId},
          data: {
            status: JobStatus.FAILED,
            errorMessage: `Processing failed on chunk #${chunkIndex}.`,
          },
        });
      });
      throw error;
    }
  }
);

// --- WORKER 3: The Finalizer ---
const assemblyWorker = inngest.createFunction(
  {id: "assemble-chunked-transcript"},
  {event: "job.assembly.ready"},
  async ({event, step}) => {
    const {jobId} = event.data;
    try {
      await step.run("update-status-to-assembling", () =>
        prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {status: JobStatus.ASSEMBLING},
        })
      );
      revalidatePath("/");

      const {text, srt, vtt} = await step.run(
        "stitch-transcripts",
        async () => {
          const finalChunks = await prisma.jobChunk.findMany({
            where: {jobId, status: "COMPLETED"},
            orderBy: {chunk_index: "asc"},
          });
          let combinedText = "";
          let combinedSrt = "";
          let combinedVtt = "WEBVTT\n\n";
          let srtCounter = 1;
          for (const chunk of finalChunks) {
            if (chunk.transcript) {
              combinedText += chunk.transcript + " ";
              const duration = chunk.end_time - chunk.start_time;
              const {vtt: vttSegment, srt: srtSegment} =
                generateCaptionsFromText(
                  chunk.transcript,
                  chunk.start_time,
                  duration
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
        }
      );

      const parentJob = await step.run(
        "update-final-job-and-get-urls",
        async () => {
          return prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {
              status: JobStatus.COMPLETED,
              completedAt: new Date(),
              transcriptText: text,
              transcriptSrt: srt,
              transcriptVtt: vtt,
              errorMessage: null,
            },
            include: {chunks: true},
          });
        }
      );
      revalidatePath("/");

      await step.run("cleanup-all-r2-files", async () => {
        const chunkKeys = parentJob.chunks.map((c) =>
          new URL(c.blob_url).pathname.substring(1)
        );
        const sourceKey = new URL(parentJob.fileUrl).pathname.substring(1);
        const keysToDelete = [...chunkKeys, sourceKey].map((key) => ({
          Key: key,
        }));
        if (keysToDelete.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: env.R2_BUCKET_NAME,
            Delete: {Objects: keysToDelete},
          });
          await R2.send(deleteCommand);
        }
      });
    } catch (error: any) {
      console.error(`[AssemblyWorker] Error assembling job ${jobId}:`, error);
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
