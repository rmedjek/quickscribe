// app/lib/assemblyai.ts
import {AssemblyAI} from "assemblyai";
import {env} from "./env.mjs";

// Create and export a singleton instance of the AssemblyAI client.
// This client is configured with our API key from the environment variables.
export const assemblyai = new AssemblyAI({
  apiKey: env.ASSEMBLYAI_API_KEY,
});
