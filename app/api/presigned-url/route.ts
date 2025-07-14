// app/api/presigned-url/route.ts
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {PutObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {R2} from "@/lib/r2";
import crypto from "crypto";
import {env} from "@/lib/env.mjs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const {filename, contentType} = await request.json();
  // Generate a unique key for the file to prevent overwrites
  const randomSuffix = crypto.randomBytes(5).toString("hex");
  const key = `${session.user.id}/${randomSuffix}-${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(R2, command, {expiresIn: 300}); // URL is valid for 5 minutes

    // The final public URL of the file after upload
    const publicFileUrl = `https://${env.R2_PUBLIC_HOSTNAME}/${key}`;

    return NextResponse.json({
      url: presignedUrl,
      publicUrl: publicFileUrl,
      key: key,
    });
  } catch (error) {
    console.error("Error creating presigned URL:", error);
    return NextResponse.json(
      {error: "Failed to create upload URL"},
      {status: 500}
    );
  }
}
