// File: app/api/inngest/route.ts

import {serve} from "inngest/next";
import {inngest} from "@/inngest/client"; // Import the single, correct client
import {processTranscription} from "@/inngest/functions"; // Import our worker function

// The `serve` function exposes our Inngest functions as a Next.js API route.
export const {GET, POST, PUT} = serve({
  client: inngest,
  functions: [
    processTranscription, // Register our worker function here
  ],
});
