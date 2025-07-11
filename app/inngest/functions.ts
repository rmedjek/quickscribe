// app/inngest/functions.ts
import {inngest} from "./client";
import prisma from "@/lib/prisma";
import {prepareAudioFromFileBlob} from "@/lib/file-processor";
import {prepareAudioFromLink} from "@/lib/link-processor";
import {transcribeAudioAction} from "@/actions/transcribeAudioAction";
import {del} from "@vercel/blob";
import * as fs from "node:fs/promises";
import {revalidatePath} from "next/cache";

const mainWorker = inngest.createFunction(
  {id: "process-submitted-media", concurrency: {limit: 10}},
  {event: "media.submitted"},
  async ({event, step}) => {
    const {data} = event;
    let tempAudioPath: string | null = null;
    const {userId, tempJobId, isLinkJob} = data; // Destructure for use in catch

    try {
      const prepResult = await step.run("1-prepare-audio", async () => {
        return data.isLinkJob
          ? await prepareAudioFromLink(data.linkUrl!)
          : await prepareAudioFromFileBlob(
              data.blobUrl!,
              data.originalFileName!
            );
      });

      if (!prepResult.success) throw new Error(prepResult.error);
      tempAudioPath = prepResult.tempAudioPath;

      const transcriptionResult = await step.run(
        "2-transcribe-audio",
        async () => {
          const audioBuffer = await fs.readFile(prepResult.tempAudioPath);
          const formData = new FormData();
          formData.append(
            "audioBlob",
            new Blob([audioBuffer], {type: "audio/opus"}),
            prepResult.audioFileName
          );
          return await transcribeAudioAction(formData, data.transcriptionMode);
        }
      );

      if (!transcriptionResult.success || !transcriptionResult.data) {
        throw new Error(
          transcriptionResult.error || "Transcription returned no data."
        );
      }

      // Final step: Commit the successful job to the database
      const newJob = await step.run("3-commit-job-to-db", async () => {
        return prisma.transcriptionJob.create({
          data: {
            userId: data.userId,
            status: "COMPLETED",
            fileUrl: data.isLinkJob ? data.linkUrl! : data.blobUrl!,
            sourceFileName:
              data.originalFileName || (prepResult as any).displayTitle,
            displayTitle:
              (prepResult as any).displayTitle || data.originalFileName,
            sourceFileHash: data.fileHash,
            sourceFileSize: 0,
            engineUsed: data.transcriptionMode,
            transcriptText: transcriptionResult.data!.text,
            transcriptSrt: transcriptionResult.data!.srtContent,
            transcriptVtt: transcriptionResult.data!.vttContent,
            duration: transcriptionResult.data!.duration,
            language: transcriptionResult.data!.language,
            startedAt: new Date(),
            completedAt: new Date(),
            processingSubStage: "COMPLETED",
          },
        });
      });

      revalidatePath("/");

      console.log(
        `[Inngest] Job complete. Final DB ID: ${newJob.id}. Client can now be redirected.`
      );

      return {success: true, newJobId: newJob.id};
    } catch (error: any) {
      console.error(
        `[Inngest] Job for tempId ${tempJobId} failed permanently:`,
        error.message
      );

      await step.run("x-commit-failure-to-db", async () => {
        return prisma.transcriptionJob.create({
          data: {
            userId: userId,
            status: "FAILED",
            errorMessage:
              error.message || "An unknown processing error occurred.",
            fileUrl: data.linkUrl || data.blobUrl || "N/A",
            sourceFileHash: isLinkJob ? tempJobId : data.fileHash,
            sourceFileName: data.originalFileName || data.linkUrl || "N/A",
            displayTitle: data.originalFileName || data.linkUrl || "N/A",
            engineUsed: data.transcriptionMode,
            sourceFileSize: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      throw error;
    } finally {
      if (tempAudioPath) {
        await fs
          .unlink(tempAudioPath)
          .catch((e) => console.error("Temp audio cleanup failed", e));
      }
      if (!data.isLinkJob && data.blobUrl) {
        await del(data.blobUrl).catch((e) =>
          console.error("Source blob deletion failed", e)
        );
      }
    }
  }
);

export const functions = [mainWorker];
