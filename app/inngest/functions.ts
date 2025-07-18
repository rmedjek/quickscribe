// app/inngest/functions.ts
import prisma from "@/lib/prisma";
import {JobStatus} from "@prisma/client";
import {inngest} from "./client";
import {revalidatePath} from "next/cache";
import {env} from "@/lib/env.mjs";
import {assemblyai} from "@/lib/assemblyai";

const mainWorker = inngest.createFunction(
  {
    id: "assemblyai-transcription-worker",
    // We can allow high concurrency because this function is very fast and lightweight.
    concurrency: {limit: 20},
  },
  {event: "media.submitted"},
  async ({event, step}) => {
    const {jobId, fileUrl} = event.data;
    const vercelUrl = env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:3000";
    const WEBHOOK_URL = `${vercelUrl}/api/webhooks/assemblyai`;

    console.log(
      `[Worker] Submitting job ${jobId} to AssemblyAI. File: ${fileUrl}`
    );

    await step.sleep("wait-for-db-replication", "2s");

    try {
      // Step 1: Set our job status to PROCESSING.
      await step.run("update-status-to-processing", () =>
        prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {status: JobStatus.PROCESSING, startedAt: new Date()},
        })
      );
      // --- THE FIX: Back to the simple, single transcribe call ---
      const assemblyJob = await step.run("submit-to-assemblyai", async () => {
        return await assemblyai.transcripts.transcribe({
          audio: fileUrl,
          webhook_url: WEBHOOK_URL,
          speaker_labels: true,
          auto_highlights: true,
        });
      });
      // --- END FIX ---

      await step.run("save-external-id", () =>
        prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {external_id: assemblyJob.id},
        })
      );

      console.log(
        `[Worker] Successfully submitted job ${jobId}. External ID: ${assemblyJob.id}`
      );
      revalidatePath("/");
    } catch (error: any) {
      // If submission to AssemblyAI fails, mark our job as FAILED.
      await step.run("handle-submission-failure", async () => {
        await prisma.transcriptionJob.update({
          where: {id: jobId},
          data: {status: JobStatus.FAILED, errorMessage: error.message},
        });
      });
      revalidatePath("/");
      throw error;
    }
  }
);

// We only need this one worker now.
export const functions = [mainWorker];
