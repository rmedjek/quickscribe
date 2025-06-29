// app/inngest/functions.ts
import {inngest} from "./client";
import {PrismaClient} from "@prisma/client";
import {processFileFromBlob} from "@/lib/file-processor";
import {processLink} from "@/lib/link-processor";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import type {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction"; // Import the detailed result type
import {del} from "@vercel/blob";
import {generateTitleAction} from "@/actions/generateTitleAction";

const prisma = new PrismaClient();

// Define the expected shape of our processing result for clarity
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

    let result: ProcessingResult;

    try {
      await step.run("update-job-status-to-processing", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {status: "PROCESSING", startedAt: new Date()},
        });
      });

      result = await step.run("process-media", async () => {
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
      });

      if (result.success && result.data) {
        const transcriptionData = result.data;

        const displayTitle = await step.run(
          "generate-display-title",
          async () => {
            return await generateTitleAction(transcriptionData.text);
          }
        );

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
              displayTitle: displayTitle,
            },
          });
        });
      } else {
        throw new Error(
          result.error || "Processing was successful but returned no data."
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      if (!isLinkJob && job.fileUrl) {
        await step.run("delete-source-blob", async () => {
          console.log(`[Inngest] Deleting source blob: ${job.fileUrl}`);
          try {
            await del(job.fileUrl);
            console.log(`[Inngest] Successfully deleted blob: ${job.fileUrl}`);
          } catch (delError: any) {
            // Log the deletion error, but don't fail the entire Inngest run for it
            console.error(
              `[Inngest] Failed to delete blob ${job.fileUrl}. It may need manual cleanup. Error: ${delError.message}`
            );
          }
        });
      }
    }

    return {success: true, message: `Job ${jobId} completed successfully.`};
  }
);
