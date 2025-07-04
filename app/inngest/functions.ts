// app/inngest/functions.ts
import {inngest} from "./client";
import {PrismaClient} from "@prisma/client";
import {processFileFromBlob} from "@/lib/file-processor";
import {processLink} from "@/lib/link-processor";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import type {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {del} from "@vercel/blob";

const prisma = new PrismaClient();

type ProcessingResult = {
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
};

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

    try {
      // Set the initial sub-stage
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

      const result: ProcessingResult = await step.run(
        "process-media",
        async () => {
          const mode = job.engineUsed as TranscriptionMode;
          return isLinkJob
            ? processLink(job.fileUrl, mode)
            : processFileFromBlob(job.fileUrl, job.sourceFileName, mode);
        }
      );

      // After media is processed, update the sub-stage
      await step.run("update-substage-to-transcribing", async () => {
        return prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {processingSubStage: "TRANSCRIBING"},
        });
      });

      if (result.success && result.data) {
        const transcriptionData = result.data;
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
          result.error || "Processing was successful but returned no data."
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
