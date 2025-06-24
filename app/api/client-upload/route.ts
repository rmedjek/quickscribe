// File: app/api/client-upload/route.ts

import {handleUpload, type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      {error: "Unauthorized: You must be logged in to upload files."},
      {status: 401}
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (clientPathname) => {
        // We will still prefix with the user's ID for security and organization.
        const securePathPrefix = `${userId}/`;

        return {
          // --- THE DEFINITIVE FIX ---
          // Use the library's built-in option to guarantee uniqueness.
          // This will automatically append a random suffix to the filename.
          // e.g., "MyFile.mp4" becomes "MyFile-aB1cDef.mp4"
          addRandomSuffix: true,

          // We also ensure the file is placed inside the user's folder.
          pathname: `${securePathPrefix}${clientPathname}`,
          // --- END FIX ---

          tokenPayload: JSON.stringify({
            userId: userId,
            originalFilename: clientPathname,
          }),
        };
      },
      onUploadCompleted: async ({blob, tokenPayload}) => {
        console.log("Blob upload completed:", blob.pathname);
        console.log("Token payload:", tokenPayload);
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
