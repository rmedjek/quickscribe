// app/actions/jobActions.ts
"use server";

import prisma from "@/lib/prisma"; // CORRECT: Import the singleton
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {inngest} from "@/inngest/client";
import {AppEvents} from "@/inngest/types";
import {env} from "@/lib/env.mjs";
import {R2} from "@/lib/r2";
import {DeleteObjectsCommand} from "@aws-sdk/client-s3";

// --- NEW DISCRIMINATED UNION TYPES ---
interface FileJobParams {
  type: "file";
  blobUrl: string;
  originalFileName: string;
  fileHash: string;
  fileSize: number;
  processingStrategy: "SINGLE" | "CHUNKED";
  transcriptionMode: TranscriptionMode;
}

interface LinkJobParams {
  type: "link";
  linkUrl: string;
  transcriptionMode: TranscriptionMode;
}

type SubmitJobParams = FileJobParams | LinkJobParams;

export async function submitMediaJob(params: SubmitJobParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return {success: false, error: "Unauthorized"};
  }

  // --- FIX for `prefer-const` ---
  // No longer need a mutable tempJobId variable.
  // The ID comes directly from the newly created job.
  const newJob = await prisma.transcriptionJob.create({
    data: {
      userId: session.user.id,
      status: "PENDING",
      sourceFileName:
        params.type === "file" ? params.originalFileName : params.linkUrl,
      sourceFileHash: params.type === "file" ? params.fileHash : null,
      fileUrl: params.type === "file" ? params.blobUrl : params.linkUrl,
      displayTitle:
        params.type === "file" ? params.originalFileName : params.linkUrl,
      sourceFileSize: params.type === "file" ? params.fileSize : 0,
      processing_strategy:
        params.type === "file" ? params.processingStrategy : "SINGLE",
      engineUsed: params.transcriptionMode,
    },
  });

  // --- FIX for TypeScript error ---
  // The eventPayload is now constructed based on the updated AppEvents type.
  let eventPayload: AppEvents["media.submitted"]["data"];

  if (params.type === "file") {
    eventPayload = {
      jobId: newJob.id,
      userId: session.user.id,
      transcriptionMode: params.transcriptionMode,
      isLinkJob: false,
      processingStrategy: params.processingStrategy,
      blobUrl: params.blobUrl,
      originalFileName: params.originalFileName,
      fileHash: params.fileHash,
    };
  } else {
    // params.type === 'link'
    eventPayload = {
      jobId: newJob.id,
      userId: session.user.id,
      transcriptionMode: params.transcriptionMode,
      isLinkJob: true,
      processingStrategy: "SINGLE",
      linkUrl: params.linkUrl,
    };
  }

  await inngest.send({
    name: "media.submitted",
    data: eventPayload,
  });

  console.log(
    `[JobAction] Sent "media.submitted" event for DB jobId: ${newJob.id}`
  );

  // Return the real DB ID. The processing page will use this to poll.
  return {success: true, tempJobId: newJob.id};
}

export async function getJobAction(jobId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;
  return await prisma.transcriptionJob.findFirst({
    where: {id: jobId, userId: userId},
  });
}

export async function deleteJobAction(jobId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {success: false, error: "Unauthorized"};
  }

  try {
    // --- REFACTORED FOR R2 ---
    // 1. Find the job and its associated chunks to get all file keys
    const jobToDelete = await prisma.transcriptionJob.findUnique({
      where: {id: jobId},
      include: {
        chunks: {
          // Include the chunk records
          select: {blob_url: true},
        },
      },
    });

    if (!jobToDelete || jobToDelete.userId !== userId) {
      return {success: false, error: "Job not found or permission denied."};
    }

    // 2. If it was a file-based job, prepare to delete its files from R2
    if (jobToDelete.sourceFileHash) {
      const keysToDelete: {Key: string}[] = [];

      // Add the main source file's key
      const sourceKey = new URL(jobToDelete.fileUrl).pathname.substring(1);
      keysToDelete.push({Key: sourceKey});

      // Add the keys for all associated chunks, if any exist
      if (jobToDelete.chunks.length > 0) {
        const chunkKeys = jobToDelete.chunks.map((chunk) => ({
          Key: new URL(chunk.blob_url).pathname.substring(1),
        }));
        keysToDelete.push(...chunkKeys);
      }

      console.log(
        `[JobAction] Preparing to delete ${keysToDelete.length} objects from R2 for job ${jobId}`
      );

      try {
        // 3. Send a single command to R2 to delete all objects
        if (keysToDelete.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: env.R2_BUCKET_NAME,
            Delete: {Objects: keysToDelete},
          });
          await R2.send(deleteCommand);
        }
        console.log(`[JobAction] Deleted R2 objects for job ${jobId}`);
      } catch (r2Error: any) {
        // Log the error but don't block the DB deletion.
        console.error(
          `[JobAction] Could not delete R2 objects for job ${jobId}. Error: ${r2Error.message}`
        );
      }
    }

    // 4. Finally, delete the job record and its chunks from the database (cascade delete)
    await prisma.transcriptionJob.delete({
      where: {id: jobId},
    });

    revalidatePath("/");
    console.log(
      `[JobAction] Deleted job ${jobId} and all associated data for user ${userId}`
    );
    return {success: true};
  } catch (error) {
    console.error("Error deleting transcription job:", error);
    return {success: false, error: "Failed to delete the job."};
  }
}

export async function renameJobAction(jobId: string, newTitle: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return {success: false, error: "Unauthorized"};

  try {
    const job = await prisma.transcriptionJob.findFirst({
      where: {id: jobId, userId: userId},
    });
    if (!job) return {success: false, error: "Job not found"};

    const updatedJob = await prisma.transcriptionJob.update({
      where: {id: jobId},
      data: {displayTitle: newTitle},
    });

    revalidatePath("/");
    return {success: true, updatedJob: updatedJob};
  } catch (error) {
    console.error("Error renaming transcription job:", error);
    return {success: false, error: "Failed to rename job."};
  }
}
