// app/api/webhooks/assemblyai/route.ts
import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {JobStatus} from "@prisma/client";
import {revalidatePath} from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {transcript_id, status, error} = body;

    if (!transcript_id) {
      return NextResponse.json({error: "Missing transcript_id"}, {status: 400});
    }

    const job = await prisma.transcriptionJob.findFirst({
      where: {external_id: transcript_id},
    });

    if (!job) {
      console.warn(
        `[Webhook] Job not found for AssemblyAI ID: ${transcript_id}. Forcing retry.`
      );
      return NextResponse.json(
        {error: "Job not found, webhook will be retried."},
        {status: 500}
      );
    }

    if (status === "completed") {
      // Destructure all the fields we need directly from the body.
      const {text, audio_duration, summary, auto_highlights, utterances} = body;

      await prisma.transcriptionJob.update({
        where: {id: job.id},
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          transcriptText: text,
          duration: audio_duration,
          ai_results: {
            summary: summary,
            auto_highlights: auto_highlights,
            utterances: utterances,
          },
          errorMessage: null,
        },
      });
      console.log(`[Webhook] Successfully updated job ${job.id} to COMPLETED.`);
    } else if (status === "error") {
      await prisma.transcriptionJob.update({
        where: {id: job.id},
        data: {status: JobStatus.FAILED, errorMessage: error},
      });
      console.error(
        `[Webhook] Marked job ${job.id} as FAILED. Error: ${error}`
      );
    }

    revalidatePath("/");
    return NextResponse.json({received: true});
  } catch (err: any) {
    console.error("[Webhook] FATAL: Error processing webhook:", err);
    return NextResponse.json(
      {error: "Failed to process webhook"},
      {status: 500}
    );
  }
}
