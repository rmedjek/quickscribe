// File: app/api/client-upload/route.ts

import {handleUpload, type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new NextResponse("Unauthorized", {status: 401});
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        const securePathname = `${userId}/${pathname}`;

        return {
          pathname: securePathname,
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: userId,
          }),
        };
      },

      onUploadCompleted: async ({tokenPayload}) => {
        console.log("Upload completed. Custom token payload:", tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = (error as Error).message || "Internal Server Error";
    return new NextResponse(message, {status: 500});
  }
}
