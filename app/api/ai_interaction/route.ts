// app/api/ai_interaction/route.ts
import {type NextRequest, NextResponse} from "next/server"; // Import NextResponse for cleaner JSON responses
import {
  interactWithTranscriptAction,
  AIInteractionParams,
} from "@/actions/interactWithTranscriptAction";

// export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIInteractionParams;

    // Validate required parameters
    if (!body.transcriptText || !body.taskType) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: transcriptText and taskType",
        },
        {status: 400}
      );
    }
    if (
      body.taskType === "custom_question" &&
      (!body.customPrompt || body.customPrompt.trim() === "")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing customPrompt for custom_question task",
        },
        {status: 400}
      );
    }

    return await interactWithTranscriptAction(body);
  } catch (error: unknown) {
    console.error(
      "[API Route ai_interaction] Error processing request:",
      error
    );
    let errorMessage = "An unexpected error occurred in the API route.";

    if (
      error instanceof SyntaxError &&
      error.message.toLowerCase().includes("json")
    ) {
      errorMessage = "Invalid JSON in request body.";
      return NextResponse.json(
        {success: false, error: errorMessage},
        {status: 400}
      );
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {success: false, error: errorMessage},
      {status: 500}
    );
  }
}
