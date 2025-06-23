// app/actions/jobActions.ts
"use server";

import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {inngest} from "../api/inngest/route";
// We will create this Inngest client file in the next step.
// For now, this will show a TypeScript error, which is expected.

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

    // --- THIS IS THE NEW PART ---
    // After creating the job, send an event to Inngest.
    await inngest.send({
      name: "transcription.requested",
      data: {
        jobId: newJob.id,
        isLinkJob: false, // Flag to tell the worker this is a file job
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

// --- Action for LINK SUBMISSIONS ---
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

    // --- THIS IS THE NEW PART ---
    // Send the same event, but flag it as a link job.
    await inngest.send({
      name: "transcription.requested",
      data: {
        jobId: newJob.id,
        isLinkJob: true, // This tells the worker to use the link processing logic
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
