// app/actions/jobActions.ts
"use server";

import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";

// --- THIS IS THE CRITICAL FIX ---
// We now import the single, correct, typed client from its dedicated file.
import {inngest} from "@/inngest/client";
// --- END FIX ---

const prisma = new PrismaClient();

// The rest of this file is correct, but the import above fixes the core issue.

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
    revalidatePath("/dashboard");
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

  if (!userId) {
    return {success: false, error: "Unauthorized"};
  }

  const {linkUrl, transcriptionMode} = params;

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
      data: {
        jobId: newJob.id,
        isLinkJob: true,
      },
    });

    console.log(
      `[JobAction] Created LINK job ${newJob.id} and sent 'transcription.requested' event.`
    );
    revalidatePath("/dashboard");
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
