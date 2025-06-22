// app/actions/jobActions.ts
"use server";

import {PrismaClient} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {auth} from "@/lib/auth";

const prisma = new PrismaClient();

// CORRECTED: 'transcriptionMode' is now an official part of the interface.
interface StartJobParams {
  blobUrl: string;
  originalFileName: string;
  fileSize: number;
  fileHash: string;
  transcriptionMode: TranscriptionMode;
}

export async function startTranscriptionJob(params: StartJobParams) {
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
        userId: userId,
        status: "PENDING",
        fileUrl: blobUrl,
        sourceFileName: originalFileName,
        sourceFileSize: fileSize,
        sourceFileHash: fileHash,
        engineUsed: transcriptionMode, // This will now work without error.
      },
    });

    // In Phase 2, we will trigger the worker here.
    // import { inngest } from "@/app/inngest";
    // await inngest.send({ name: 'transcription.requested', data: { jobId: newJob.id } });

    console.log(
      `[JobAction] Created job ${newJob.id} for user ${userId} with mode ${transcriptionMode}`
    );

    revalidatePath("/dashboard");

    return {success: true, jobId: newJob.id};
  } catch (error) {
    console.error("Error creating transcription job:", error);
    return {success: false, error: "Failed to create job in database."};
  }
}
