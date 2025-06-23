// app/actions/jobActions.ts
"use server";

import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";

const prisma = new PrismaClient();

// --- Action for FILE UPLOADS ---
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

    console.log(`[JobAction] Created FILE job ${newJob.id} for user ${userId}`);
    revalidatePath("/dashboard");
    return {success: true, jobId: newJob.id};
  } catch (error) {
    console.error("Error creating file transcription job:", error);
    return {success: false, error: "Failed to create job in database."};
  }
}

// --- NEW Action for LINK SUBMISSIONS ---
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
        sourceFileSize: 0, // We don't know the size yet
        engineUsed: transcriptionMode,
      },
    });

    console.log(`[JobAction] Created LINK job ${newJob.id} for user ${userId}`);
    revalidatePath("/dashboard");
    return {success: true, jobId: newJob.id};
  } catch (error) {
    console.error("Error creating link transcription job:", error);
    return {success: false, error: "Failed to create job in database."};
  }
}
