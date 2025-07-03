// app/inngest/functions.ts
import {inngest} from "./client";
import {PrismaClient} from "@prisma/client";
import {processFileFromBlob} from "@/lib/file-processor";
import {processLink} from "@/lib/link-processor";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import type {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {del} from "@vercel/blob"; // Import the delete function

const prisma = new PrismaClient();

type ProcessingResult = {
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
};

export const processTranscription = inngest.createFunction(
  {
    id: "process-transcription-job",
    concurrency: {
      limit: 5,
    },
  },
  {event: "transcription.requested"},
  async ({event, step}) => {
    const {jobId, isLinkJob} = event.data;
    console.log(`[Inngest] Received job ${jobId}. Is link job: ${isLinkJob}`);

    const job = await step.run("fetch-job-details", async () => {
      return await prisma.transcriptionJob.findUnique({
        where: {id: jobId},
      });
    });

    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    try {
      await step.run("update-job-status-to-processing", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {status: "PROCESSING", startedAt: new Date()},
        });
      });

      const result: ProcessingResult = await step.run(
        "process-media",
        async () => {
          const mode = job.engineUsed as TranscriptionMode;
          if (isLinkJob) {
            return await processLink(job.fileUrl, mode);
          } else {
            return await processFileFromBlob(
              job.fileUrl,
              job.sourceFileName,
              mode
            );
          }
        }
      );

      if (result.success && result.data) {
        const transcriptionData = result.data;
        await step.run("update-job-as-completed", async () => {
          await prisma.transcriptionJob.update({
            where: {id: jobId},
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              transcriptText: transcriptionData.text,
              transcriptSrt: transcriptionData.srtContent,
              transcriptVtt: transcriptionData.vttContent,
              duration: transcriptionData.duration,
              language: transcriptionData.language,
            },
          });
        });
      } else {
        throw new Error(
          result.error || "Processing was successful but returned no data."
        );
      }
    } catch (error: any) {
      await step.run("update-job-as-failed", async () => {
        await prisma.transcriptionJob.update({
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
      // --- THIS IS THE DEFINITIVE FIX ---
      // This `finally` block runs whether the job succeeded or failed.
      // We only delete the blob if it was a file-based job (not a link).
      if (!isLinkJob && job.fileUrl) {
        await step.run("delete-source-blob", async () => {
          console.log(`[Inngest] Deleting source blob: ${job.fileUrl}`);
          try {
            await del(job.fileUrl);
            console.log(`[Inngest] Successfully deleted blob: ${job.fileUrl}`);
          } catch (delError: any) {
            console.error(
              `[Inngest] Failed to delete blob ${job.fileUrl}. It may need manual cleanup. Error: ${delError.message}`
            );
          }
        });
      }
      // --- END FIX ---
    }

    return {success: true, message: `Job ${jobId} completed successfully.`};
  }
);
