// app/api/presigned-url/route.ts
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {PutObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {env} from "@/lib/env.mjs";
import crypto from "crypto";
import {R2} from "@/lib/rs";

export async function POST(request: Request) {
  const session = await auth();
  console.log("SESSION USER ID:", session?.user?.id);
  if (!session?.user?.id) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  try {
    const {filename, contentType} = await request.json();

    // Generate a unique path for the file to prevent overwrites
    const randomSuffix = crypto.randomBytes(8).toString("hex");
    const key = `${session.user.id}/${randomSuffix}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // Generate the special, temporary URL for the client to upload to
    const presignedUrl = await getSignedUrl(R2, command, {expiresIn: 300}); // URL is valid for 5 minutes

    // This is the final, permanent public URL of the file after it's uploaded
    const publicUrl = `https://${env.R2_PUBLIC_HOSTNAME}/${key}`;

    return NextResponse.json({
      url: presignedUrl,
      publicUrl: publicUrl,
    });
  } catch (error) {
    console.error("Error creating presigned URL:", error);
    return NextResponse.json(
      {error: "Failed to create upload URL"},
      {status: 500}
    );
  }
}
