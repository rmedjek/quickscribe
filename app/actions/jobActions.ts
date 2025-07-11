// app/actions/jobActions.ts
"use server";

import prisma from "@/lib/prisma"; // CORRECT: Import the singleton
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {inngest} from "@/inngest/client";
import {del} from "@vercel/blob";
import {AppEvents} from "@/inngest/types";

// --- NEW DISCRIMINATED UNION TYPES ---
interface FileJobParams {
  type: "file";
  blobUrl: string;
  originalFileName: string;
  fileHash: string;
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

  let tempJobId: string;
  let eventPayload: AppEvents["media.submitted"]["data"];

  if (params.type === "file") {
    tempJobId = params.fileHash;
    eventPayload = {
      userId: session.user.id,
      transcriptionMode: params.transcriptionMode,
      isLinkJob: false,
      tempJobId,
      blobUrl: params.blobUrl,
      originalFileName: params.originalFileName,
      fileHash: params.fileHash,
    };
  } else {
    // params.type === 'link'
    // --- THIS IS THE FIX ---
    // 1. Encode the URL to Base64 as before.
    const base64Id = Buffer.from(params.linkUrl).toString("base64");
    // 2. Make it URL-safe by replacing problematic characters.
    //    Replace '/' with '_', '+' with '-', and remove '=' padding.
    tempJobId = base64Id
      .replace(/\//g, "_")
      .replace(/\+/g, "-")
      .replace(/=/g, "");
    // --- END FIX ---

    eventPayload = {
      userId: session.user.id,
      transcriptionMode: params.transcriptionMode,
      isLinkJob: true,
      tempJobId,
      linkUrl: params.linkUrl,
    };
  }

  await inngest.send({
    name: "media.submitted",
    data: eventPayload,
  });

  console.log(
    `[JobAction] Sent "media.submitted" event for tempJobId: ${tempJobId}`
  );
  return {success: true, tempJobId: tempJobId};
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
    const jobToDelete = await prisma.transcriptionJob.findUnique({
      where: {id: jobId},
    });

    // Security Check: Ensure the user owns this job before deleting.
    if (!jobToDelete || jobToDelete.userId !== userId) {
      return {success: false, error: "Job not found or permission denied."};
    }

    // If the job was from a file upload (not a link), delete its associated blob.
    if (jobToDelete.sourceFileHash) {
      try {
        await del(jobToDelete.fileUrl);
        console.log(`[JobAction] Deleted blob for job ${jobId}`);
      } catch (blobError: any) {
        // Log the error but don't block the DB deletion if the blob is already gone.
        console.error(
          `[JobAction] Could not delete blob for job ${jobId}. It may have already been deleted. Error: ${blobError.message}`
        );
      }
    }

    // Delete the job record from the database.
    await prisma.transcriptionJob.delete({
      where: {id: jobId},
    });

    revalidatePath("/");
    console.log(`[JobAction] Deleted job ${jobId} for user ${userId}`);
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
