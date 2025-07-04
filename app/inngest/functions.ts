// app/inngest/functions.ts
import {inngest} from "./client";
import prisma from "@/lib/prisma"; // CORRECT: Import the singleton
import {prepareAudioFromFileBlob} from "@/lib/file-processor";
import {prepareAudioFromLink} from "@/lib/link-processor";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {transcribeAudioAction} from "@/actions/transcribeAudioAction";
import {del} from "@vercel/blob";
import * as fs from "node:fs/promises";

// REMOVED: const prisma = new PrismaClient();

// ... rest of the file remains the same
export const processTranscription = inngest.createFunction(
  {
    id: "process-transcription-job",
    concurrency: {limit: 5},
  },
  {event: "transcription.requested"},
  async ({event, step}) => {
    const {jobId, isLinkJob} = event.data;
    console.log(`[Inngest] Received job ${jobId}. Is link job: ${isLinkJob}`);

    const job = await step.run("fetch-job-details", async () => {
      return await prisma.transcriptionJob.findUnique({where: {id: jobId}});
    });

    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    // --- FIX: This variable will hold the path to the temp audio file ---
    let tempAudioPath: string | null = null;

    try {
      await step.run("update-status-to-processing", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: "PROCESSING",
            startedAt: new Date(),
            processingSubStage: "PREPARING_AUDIO",
          },
        });
      });

      // --- STEP 1: Prepare Audio, returning the file path ---
      const preparationResult = await step.run("prepare-audio", async () => {
        // 'mode' is not needed here, so it is removed.
        return isLinkJob
          ? await prepareAudioFromLink(job.fileUrl)
          : await prepareAudioFromFileBlob(job.fileUrl, job.sourceFileName);
      });

      if (!preparationResult.success) {
        throw new Error(preparationResult.error);
      }

      // --- FIX: Store the path for cleanup in the 'finally' block ---
      tempAudioPath = preparationResult.tempAudioPath;

      await step.run("update-substage-to-transcribing", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {processingSubStage: "TRANSCRIBING"},
        });
      });

      // --- STEP 2: Transcribe Audio using the file path ---
      const transcriptionResult = await step.run(
        "transcribe-with-groq",
        async () => {
          // --- FIX: Read the file from the path to get a fresh Buffer ---
          const audioBuffer = await fs.readFile(
            preparationResult.tempAudioPath
          );
          const formData = new FormData();
          const audioBlob = new Blob([audioBuffer], {type: "audio/opus"});
          formData.append(
            "audioBlob",
            audioBlob,
            preparationResult.audioFileName
          );

          return await transcribeAudioAction(
            formData,
            job.engineUsed as TranscriptionMode
          );
        }
      );

      if (transcriptionResult.success && transcriptionResult.data) {
        const transcriptionData = transcriptionResult.data;
        await step.run("update-job-as-completed", async () => {
          return prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              transcriptText: transcriptionData.text,
              transcriptSrt: transcriptionData.srtContent,
              transcriptVtt: transcriptionData.vttContent,
              duration: transcriptionData.duration,
              language: transcriptionData.language,
              processingSubStage: "COMPLETED",
            },
          });
        });
      } else {
        throw new Error(
          transcriptionResult.error ||
            "Transcription was successful but returned no data."
        );
      }
    } catch (error: any) {
      await step.run("update-job-as-failed", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: error.message || "An unknown error occurred.",
          },
        });
      });
      throw error;
    } finally {
      // --- FINAL BLOCK: Cleanup using the stored file path ---
      // 1. Clean up local temporary audio file
      if (tempAudioPath) {
        await step.run("cleanup-temp-audio", async () => {
          console.log(
            `[Inngest] Cleaning up temporary audio file: ${tempAudioPath}`
          );
          await fs
            .unlink(tempAudioPath as string)
            .catch((err) =>
              console.warn(
                `[Cleanup] Could not delete temp audio file: ${err.message}`
              )
            );
        });
      }

      // 2. Delete the source blob from Vercel storage if it was a file upload
      if (!isLinkJob && job.fileUrl) {
        await step.run("delete-source-blob", async () => {
          console.log(`[Inngest] Deleting source blob: ${job.fileUrl}`);
          try {
            await del(job.fileUrl);
          } catch (delError: any) {
            console.error(
              `[Inngest] Failed to delete blob ${job.fileUrl}. Error: ${delError.message}`
            );
          }
        });
      }
    }

    return {success: true, message: `Job ${jobId} completed successfully.`};
  }
);
