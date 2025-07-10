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

  // Try to find a completed job by either file hash or file URL (for links)
  const job = await prisma.transcriptionJob.findFirst({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      OR: [
        {sourceFileHash: identifier},
        {fileUrl: Buffer.from(identifier, "base64").toString("ascii")},
      ],
    },
  });

  if (job) {
    return NextResponse.json(job);
  } else {
    return NextResponse.json({error: "Not found"}, {status: 404});
  }
}
