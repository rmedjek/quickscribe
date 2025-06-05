
// app/api/ai_interaction/route.ts
import { type NextRequest } from 'next/server';
import { interactWithTranscriptAction, AIInteractionParams } from '@/actions/interactWithTranscriptAction'; // Adjust path if necessary

export const runtime = 'edge'; // Optional: Edge runtime can be faster for streaming

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIInteractionParams;

    if (!body.transcriptText || !body.taskType) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: transcriptText and taskType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // For "custom_question", customPrompt is also expected in the body
    if (body.taskType === "custom_question" && (!body.customPrompt || body.customPrompt.trim() === "")) {
        return new Response(JSON.stringify({ error: 'Missing customPrompt for custom_question task' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }


    // Call the server action
    // The server action itself now returns a StreamingTextResponse or a regular Response for errors
    return await interactWithTranscriptAction(body);

  } catch (error: unknown) {
    console.error('[API Route ai_interaction] Error:', error);
    let errorMessage = 'An unexpected error occurred in the API route.';
    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        errorMessage = (error as { message: string }).message;
    }
    // Check if it's a known type of error from JSON parsing or else
    if (typeof error === 'object' && error !== null && 'type' in error && (error as { type: unknown }).type === ' शरीर अपार्सनीय') { // Example of specific error check if req.json() fails
        errorMessage = 'Invalid JSON in request body.';
         return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}