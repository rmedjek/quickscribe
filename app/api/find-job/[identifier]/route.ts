// app/api/find-job/[identifier]/route.ts
import {NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";

export async function GET(
  req: Request,
  {params}: {params: {identifier: string}}
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const {identifier} = params;

  const rePadded = identifier + "=".repeat((4 - (identifier.length % 4)) % 4);
  const originalBase64 = rePadded.replace(/_/g, "/").replace(/-/g, "+");
  const linkUrl = Buffer.from(originalBase64, "base64").toString("ascii");
  const job = await prisma.transcriptionJob.findFirst({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      OR: [
        {sourceFileHash: identifier},
        {fileUrl: linkUrl}, // Use the decoded URL
      ],
    },
  });

  if (job) {
    return NextResponse.json(job);
  } else {
    return NextResponse.json({error: "Not found"}, {status: 404});
  }
}
