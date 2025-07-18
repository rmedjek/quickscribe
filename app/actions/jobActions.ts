// app/actions/jobActions.ts
"use server";

import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {inngest} from "@/inngest/client";
import {AppEvents} from "@/inngest/types";
import {DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {env} from "@/lib/env.mjs";
import {R2} from "@/lib/rs";

interface FileJobParams {
  type: "file";
  blobUrl: string;
  originalFileName: string;
  fileHash: string;
  fileSize: number;
}

interface LinkJobParams {
  type: "link";
  linkUrl: string;
}

type SubmitJobParams = FileJobParams | LinkJobParams;

export async function submitMediaJob(params: SubmitJobParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return {success: false, error: "Unauthorized"};
  }

  // Step 1: Create the initial PENDING job record in our database.
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
    },
  });

  // Step 2: Create the event payload using the ID from the job we just created.
  const eventPayload: AppEvents["media.submitted"]["data"] = {
    jobId: newJob.id,
    fileUrl: newJob.fileUrl,
    isLinkJob: params.type === "link",
    originalFileName: newJob.sourceFileName,
    // Add any other fields your worker needs from the 'newJob' or 'params' objects.
  };

  // Step 3: Send the event.
  await inngest.send({
    name: "media.submitted",
    data: eventPayload,
  });

  console.log(
    `[JobAction] Sent "media.submitted" event for DB jobId: ${newJob.id}`
  );

  // Step 4: Return the real DB ID for the polling page.
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
    // --- FIX for Prisma Include ---
    const jobToDelete = await prisma.transcriptionJob.findUnique({
      where: {id: jobId},
      include: {
        chunks: true,
      },
    });

    if (!jobToDelete || jobToDelete.userId !== userId) {
      return {success: false, error: "Job not found or permission denied."};
    }

    if (jobToDelete.sourceFileHash) {
      const keysToDelete: {Key: string}[] = [];
      const sourceKey = new URL(jobToDelete.fileUrl).pathname.substring(1);
      keysToDelete.push({Key: sourceKey});

      if (jobToDelete.chunks.length > 0) {
        const chunkKeys = jobToDelete.chunks.map((chunk) => ({
          Key: new URL(chunk.blob_url).pathname.substring(1),
        }));
        keysToDelete.push(...chunkKeys);
      }

      try {
        if (keysToDelete.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: env.R2_BUCKET_NAME,
            Delete: {Objects: keysToDelete},
          });
          await R2.send(deleteCommand);
          console.log(
            `[JobAction] Deleted ${keysToDelete.length} R2 objects for job ${jobId}`
          );
        }
      } catch (r2Error: any) {
        console.error(
          `[JobAction] Could not delete R2 objects for job ${jobId}. Error: ${r2Error.message}`
        );
      }
    }

    await prisma.transcriptionJob.delete({where: {id: jobId}});
    revalidatePath("/");
    return {success: true};
  } catch (error: any) {
    console.error("Error deleting transcription job:", error);
    return {success: false, error: "Failed to delete the job."};
  }
}

export async function renameJobAction(jobId: string, newTitle: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return {success: false, error: "Unauthorized"};
  try {
    await prisma.transcriptionJob.updateMany({
      where: {id: jobId, userId: userId},
      data: {displayTitle: newTitle},
    });
    revalidatePath("/");
    return {success: true};
  } catch (error) {
    console.error("Error renaming transcription job:", error);
    return {success: false, error: "Failed to rename job."};
  }
}

// Add this to jobActions.ts
export async function getJobStatusAction(jobId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return {success: false, error: "Unauthorized"};
  }

  try {
    const job = await prisma.transcriptionJob.findFirst({
      where: {id: jobId, userId: session.user.id},
      select: {
        id: true,
        status: true,
        errorMessage: true,
        processing_strategy: true,
        chunks_total: true,
        chunks_completed: true,
      },
    });

    if (job) {
      return {success: true, job};
    } else {
      return {success: false, error: "Job not found yet"};
    }
  } catch (error) {
    console.error(`[getJobStatusAction Error] for ID ${jobId}:`, error);
    return {success: false, error: "Internal Server Error"};
  }
}
