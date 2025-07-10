// app/actions/jobActions.ts
"use server";

import prisma from "@/lib/prisma"; // CORRECT: Import the singleton
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {inngest} from "@/inngest/client";
import {del} from "@vercel/blob";

interface StartFileJobParams {
  blobUrl: string;
  originalFileName: string;
  fileHash: string;
  transcriptionMode: TranscriptionMode;
}

export async function startTranscriptionJob(params: StartFileJobParams) {
  const session = await auth();
  if (!session?.user?.id) return {success: false, error: "Unauthorized"};

  const {fileHash} = params;

  // Use the file hash as a temporary, unique ID for this job submission
  const tempJobId = fileHash;

  await inngest.send({
    name: "media.submitted",
    data: {...params, userId: session.user.id, isLinkJob: false, tempJobId},
  });

  console.log(
    `[JobAction] Sent "media.submitted" event for tempJobId: ${tempJobId}`
  );
  return {success: true, tempJobId: tempJobId};
}

interface StartLinkJobParams {
  linkUrl: string;
  transcriptionMode: TranscriptionMode;
}

interface StartLinkJobParams {
  linkUrl: string;
  transcriptionMode: TranscriptionMode;
}

export async function startLinkTranscriptionJob(params: StartLinkJobParams) {
  const session = await auth();
  if (!session?.user?.id) return {success: false, error: "Unauthorized"};

  // Create a temporary ID from a hash of the URL for link jobs
  const tempJobId = Buffer.from(params.linkUrl).toString("base64");

  await inngest.send({
    name: "media.submitted",
    data: {...params, userId: session.user.id, isLinkJob: true, tempJobId},
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
  if (!session?.user?.id) return {success: false, error: "Unauthorized"};

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
