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
  fileSize: number;
  fileHash: string;
  transcriptionMode: TranscriptionMode;
}

export async function startTranscriptionJob(params: StartFileJobParams) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {success: false, error: "Unauthorized"};
  }

  const userExists = await prisma.user.findUnique({where: {id: userId}});
  if (!userExists) {
    return {
      success: false,
      error:
        "User session is invalid or user not found. Please sign out and sign back in.",
    };
  }

  const {blobUrl, originalFileName, fileSize, fileHash, transcriptionMode} =
    params;

  try {
    const newJob = await prisma.transcriptionJob.create({
      data: {
        userId,
        status: "PENDING",
        fileUrl: blobUrl,
        sourceFileName: originalFileName,
        sourceFileSize: fileSize,
        sourceFileHash: fileHash,
        engineUsed: transcriptionMode,
      },
    });

    await inngest.send({
      name: "transcription.requested",
      data: {
        jobId: newJob.id,
        isLinkJob: false,
      },
    });

    console.log(
      `[JobAction] Created FILE job ${newJob.id} and sent 'transcription.requested' event.`
    );
    return {success: true, jobId: newJob.id};
  } catch (error) {
    console.error("Error creating file transcription job:", error);
    return {success: false, error: "Failed to create job in database."};
  }
}

interface StartLinkJobParams {
  linkUrl: string;
  transcriptionMode: TranscriptionMode;
}

export async function startLinkTranscriptionJob(params: StartLinkJobParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return {success: false, error: "Unauthorized"};

  const {linkUrl, transcriptionMode} = params;

  const existingJob = await prisma.transcriptionJob.findFirst({
    where: {userId, fileUrl: linkUrl, status: "COMPLETED"},
  });

  if (existingJob) {
    console.log(
      `[JobAction] Found existing COMPLETED job ${existingJob.id} for link ${linkUrl}. Redirecting.`
    );
    return {success: true, jobId: existingJob.id};
  }

  const userExists = await prisma.user.findUnique({where: {id: userId}});
  if (!userExists)
    return {
      success: false,
      error: "User session invalid. Please sign out and sign back in.",
    };

  try {
    const newJob = await prisma.transcriptionJob.create({
      data: {
        userId,
        status: "PENDING",
        fileUrl: linkUrl,
        sourceFileName: linkUrl,
        sourceFileSize: 0,
        engineUsed: transcriptionMode,
      },
    });
    await inngest.send({
      name: "transcription.requested",
      data: {jobId: newJob.id, isLinkJob: true},
    });
    console.log(`[JobAction] Created NEW LINK job ${newJob.id}.`);
    // No revalidate here, we let the Inngest worker do it after fetching the title.
    return {success: true, jobId: newJob.id};
  } catch (error) {
    console.error("Error creating link transcription job:", error);
    return {success: false, error: "Failed to create job in database."};
  }
}

export async function getJobAction(jobId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      userId: userId,
    },
  });

  return job;
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
