// app/inngest/functions.ts

import {inngest} from "./client";
import {PrismaClient} from "@prisma/client";
import {processFileFromBlob} from "@/lib/file-processor";
import {processLink} from "@/lib/link-processor";
import type {TranscriptionMode} from "@/components/ConfirmationView";

const prisma = new PrismaClient();

export const processTranscription = inngest.createFunction(
  {id: "process-transcription-job"},
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

    await step.run("update-job-status-to-processing", async () => {
      await prisma.transcriptionJob.update({
        where: {id: jobId},
        data: {status: "PROCESSING", startedAt: new Date()},
      });
    });

    const result = await step.run("process-media", async () => {
      const mode = job.engineUsed as TranscriptionMode;
      if (isLinkJob) {
        return await processLink(job.fileUrl, mode);
      } else {
        return await processFileFromBlob(job.fileUrl, job.sourceFileName, mode);
      }
    });

    if (result.success && result.data) {
      // --- THIS IS THE FIX ---
      // We assign result.data to a new constant. TypeScript knows this constant
      // can't be undefined, and this knowledge is correctly carried into the
      // inner async function's scope.
      const transcriptionData = result.data;
      // --- END FIX ---

      await step.run("update-job-as-completed", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            // Now we use the new constant, which is guaranteed to exist.
            transcriptText: transcriptionData.text,
            transcriptSrt: transcriptionData.srtContent,
            transcriptVtt: transcriptionData.vttContent,
            duration: transcriptionData.duration,
            language: transcriptionData.language,
          },
        });
      });
      return {success: true, message: `Job ${jobId} completed successfully.`};
    } else {
      await step.run("update-job-as-failed", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage:
              result.error || "An unknown processing error occurred.",
          },
        });
      });
      throw new Error(result.error || `Processing failed for job ${jobId}`);
    }
  }
);
