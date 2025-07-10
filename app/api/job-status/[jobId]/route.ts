// app/api/job-status/[jobId]/route.ts
import {NextRequest} from "next/server";

export async function GET(
  req: NextRequest,
  {params}: {params: {jobId: string}}
) {
  const {jobId} = params;
  const stream = new ReadableStream({
    start(controller) {
      // For this example, we'll just simulate progress.
      // [TODO] A real implementation would use a Pub/Sub system like Redis or Inngest's event stream.
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        const message = `data: {"status": "PROCESSING", "progress": ${progress}}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
        if (progress >= 100) {
          const finalMessage = `data: {"status": "COMPLETED", "jobId": "${jobId}"}\n\n`;
          controller.enqueue(new TextEncoder().encode(finalMessage));
          clearInterval(interval);
          controller.close();
        }
      }, 500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
