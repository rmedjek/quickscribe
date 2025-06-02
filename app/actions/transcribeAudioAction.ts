/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"; 

import Groq from 'groq-sdk';
import { generateSRT, generateVTT, Segment } from '../lib/caption-utils'; // Assuming path
import { TranscriptionMode } from '@/components/ConfirmationView';

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is not set.");
}

// Configure the Groq client with a longer timeout
const GROQ_REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes, example
// const GROQ_MAX_RETRIES = 0; // Optional: reduce retries if you want faster failure for debugging

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: GROQ_REQUEST_TIMEOUT_MS, // Set global timeout for this client instance
  // maxRetries: GROQ_MAX_RETRIES,  // Optionally override default retries
});

export interface DetailedTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Segment[];
  srtContent?: string;
  vttContent?: string;
  extractedAudioSizeBytes?: number;
}

export async function transcribeAudioAction(
  formData: FormData,
   mode: TranscriptionMode // Receive the mode 
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log("[Server Action] transcribeAudioAction called");
  
  const modelToUse = mode === 'turbo' ? 'whisper-large-v3' : 'distil-whisper-large-v3-en';
  const audioBlob = formData.get("audioBlob") as File | null;

  if (!audioBlob) {
    return { success: false, error: "No audio file provided in form data." };
  }

  const audioBlobSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`[Server Action] Received audio blob: ${audioBlob.name}, Size: ${audioBlobSizeMB} MB, Type: ${audioBlob.type}`);

  try {
    console.log(`[Server Action] Sending audio to Groq for transcription (timeout: ${GROQ_REQUEST_TIMEOUT_MS / 1000}s)...`);
    
    const transcription = await groq.audio.transcriptions.create({
      file: audioBlob,
      model: modelToUse,
      response_format: "verbose_json", 
      timestamp_granularities: ["segment"],
    }
    // Per-request timeout override if needed, but global should work:
    // , { timeout: SPECIFIC_REQUEST_TIMEOUT_MS }
    );

    console.log("[Server Action] Raw verbose_json response from Groq:", JSON.stringify(transcription, null, 2));

    // ... (rest of the parsing logic for rawText, language, duration, segmentsFromApi)
    const rawText = (transcription as any).text as string | undefined;
    const language = (transcription as any).language as string | undefined;
    const duration = (transcription as any).duration as number | undefined;
    const segmentsFromApi = (transcription as any).segments as Array<any> | undefined;

    if (rawText && Array.isArray(segmentsFromApi)) {
        const typedSegments: Segment[] = segmentsFromApi.map((s: any, index: number) => ({
          id: s.id ?? index, 
          start: s.start || 0,
          end: s.end || 0,
          text: s.text || "",
    }));

      const srt = generateSRT(typedSegments);
      const vtt = generateVTT(typedSegments);
      const result: DetailedTranscriptionResult = {
        text: rawText,
        language: language,
        duration: duration,
        segments: typedSegments, 
        srtContent: srt,
        vttContent: vtt,
        extractedAudioSizeBytes: audioBlob.size,
      };
      return { success: true, data: result };
    } else {
      console.error("[Server Action] Groq response (verbose_json) did not contain expected fields:", transcription);
      return { success: false, error: "Transcription failed: Unexpected response structure from Groq." };
    }

  } catch (error) {
    console.error("[Server Action] Error during Groq API call:", error);
    if (error instanceof Groq.APIConnectionTimeoutError) { // Specific timeout error
        return { success: false, error: `Groq API Error: Connection timed out after ${GROQ_REQUEST_TIMEOUT_MS / 1000}s. The audio file might be too large or processing took too long.` };
    } else if (error instanceof Groq.APIError) { 
      let errorMessage = `Groq API Error`;
      if (error.status) { errorMessage += ` (Status: ${error.status})`; }
      errorMessage += `: ${error.message}`;
      console.error("[Server Action] Full Groq.APIError object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return { success: false, error: errorMessage };
    }
    return { 
        success: false, 
        error: `An unexpected error occurred during transcription: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}