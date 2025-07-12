import {NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";

export async function GET(
  req: Request,
  {params}: {params: Promise<{identifier: string}>}
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  // Await the params before accessing its properties
  const {identifier: jobId} = await params;

  try {
    const job = await prisma.transcriptionJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id, // Security check: ensure the user owns this job.
      },
      // Select only the fields needed by the polling page UI.
      select: {
        id: true,
        status: true,
        errorMessage: true,
        chunks_total: true,
        chunks_completed: true,
      },
    });

    // If a job is found (even if it's still processing), return its status.
    if (job) {
      return NextResponse.json(job);
    } else {
      // If no job is found, it means it's either not created yet or doesn't belong
      // to this user. The client should keep polling for a short time.
      return NextResponse.json(
        {error: "Job not found or not owned by user"},
        {status: 404}
      );
    }
  } catch (error) {
    console.error(`[API Find-Job Error] for ID ${jobId}:`, error);
    return NextResponse.json({error: "Internal Server Error"}, {status: 500});
  }
}
