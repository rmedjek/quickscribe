// app/api/find-job/[identifier]/route.ts
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

  // Await the params before destructuring
  const {identifier} = await params;

  console.log("Looking for job with identifier:", identifier);

  try {
    // First try to find by sourceFileHash (which seems to be what tempJobId is)
    let job = await prisma.transcriptionJob.findFirst({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        sourceFileHash: identifier,
      },
    });

    // If not found by hash, try to decode as base64 URL
    if (!job) {
      try {
        const rePadded =
          identifier + "=".repeat((4 - (identifier.length % 4)) % 4);
        const originalBase64 = rePadded.replace(/_/g, "/").replace(/-/g, "+");
        const linkUrl = Buffer.from(originalBase64, "base64").toString("ascii");
        console.log("Decoded URL:", linkUrl);

        job = await prisma.transcriptionJob.findFirst({
          where: {
            userId: session.user.id,
            status: {in: ["COMPLETED", "FAILED"]},
            OR: [{sourceFileHash: identifier}, {fileUrl: linkUrl}],
          },
        });
      } catch (decodeError) {
        console.log("Failed to decode as base64:", decodeError);
      }
    }

    console.log("Found job:", job ? job.id : "none");

    if (job) {
      return NextResponse.json(job);
    } else {
      return NextResponse.json({error: "Not found"}, {status: 404});
    }
  } catch (error) {
    console.error("Error finding job:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
