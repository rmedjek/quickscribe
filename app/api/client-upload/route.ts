// File: app/api/client-upload/route.ts

import {handleUpload, type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  // This is the critical security check. If there is no session or no user ID,
  // we must terminate the request immediately.
  if (!session?.user?.id) {
    return NextResponse.json(
      {error: "Unauthorized: You must be logged in to upload files."},
      {status: 401}
    );
  }

  const userId = session.user.id;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          // Prefix the pathname with the user's ID to ensure they can only upload to their own folder.
          pathname: `${userId}/${pathname}`,
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({userId}),
        };
      },
      onUploadCompleted: async ({tokenPayload}) => {
        console.log("Upload completed. Custom token payload:", tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = (error as Error).message || "Internal Server Error";
    return NextResponse.json(
      {error: `Upload failed: ${message}`},
      {status: 500}
    );
  }
}
