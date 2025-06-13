// app/actions/transcribeAudioAction.ts
"use server";

import Groq from 'groq-sdk';
import { generateSRT, generateVTT, Segment } from '../lib/caption-utils';
import { TranscriptionMode } from '@/components/ConfirmationView';
import { retryWithBackoff } from '@/lib/api-utils'; // Import the helper
import { TRANSCRIPTION_MODELS } from '@/types/app';

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is not set.");
}

const GROQ_REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for each attempt

// const TRANSCRIPTION_MODEL_TURBO = process.env.GROQ_TRANSCRIPTION_MODEL_TURBO || 'whisper-large-v3-turbo';
// const TRANSCRIPTION_MODEL_CORE = process.env.GROQ_TRANSCRIPTION_MODEL_CORE || 'whisper-large-v3';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: GROQ_REQUEST_TIMEOUT_MS,
  maxRetries: 0, // Let our custom retryWithBackoff handle retries
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
  mode: TranscriptionMode
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log("[Server Action] transcribeAudioAction called");

  const modelToUse = TRANSCRIPTION_MODELS[mode];
  const audioBlob = formData.get("audioBlob") as File | null;

  if (!audioBlob) {
    return { success: false, error: "No audio file provided in form data." };
  }

  const audioBlobSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`[Server Action] Received audio blob: ${audioBlob.name}, Size: ${audioBlobSizeMB} MB, Type: ${audioBlob.type}`);
  console.log(`[Server Action] Preparing to transcribe with actual model: "${modelToUse}"`);

  try {
    const operation = async () => {
      // This console log will now appear for each attempt within retryWithBackoff
      console.log(`[Server Action] Attempting Groq transcription. Size: ${audioBlobSizeMB} MB...`);
      return await groq.audio.transcriptions.create({
        file: audioBlob,
        model: modelToUse,
        response_format: "verbose_json", 
        timestamp_granularities: ["segment"],
      });
    };

    console.log(`[Server Action] transcribed with actual model: "${modelToUse}"`);

    const transcription = await retryWithBackoff({
        operationName: `GroqAudioTranscription-${audioBlob.name.substring(0,20)}`, // Add some identifier
        operation,
        maxRetries: 2, // e.g., 2 retries (total 3 attempts)
        initialBackoffMs: 2000, // Start with 2s backoff
        maxBackoffMs: 45000,    // Max 45s backoff
    });

    console.log("[Server Action] Raw verbose_json response from Groq (first 500 chars):", JSON.stringify(transcription, null, 2).substring(0, 500) + "...");

    interface GroqTranscriptionResponse {
      text?: string;
      language?: string;
      duration?: number;
      segments?: Array<{
        id?: number;
        start?: number;
        end?: number;
        text?: string;
      }>;
    }

    const {
      text: rawText,
      language,
      duration,
      segments: segmentsFromApi,
    } = transcription as GroqTranscriptionResponse;

    if (rawText && Array.isArray(segmentsFromApi)) {
        const typedSegments: Segment[] = segmentsFromApi.map((s: { id?: number; start?: number; end?: number; text?: string }, index: number) => ({
          id: s.id ?? index, 
          start: s.start || 0,
          end: s.end || 0,
          text: s.text || "",
        }));

      const srt = generateSRT(typedSegments);
      const vtt = generateVTT(typedSegments);
      const result: DetailedTranscriptionResult = {
        text: rawText, language, duration, segments: typedSegments, 
        srtContent: srt, vttContent: vtt, extractedAudioSizeBytes: audioBlob.size,
      };
      return { success: true, data: result };
    } else {
      console.error("[Server Action] Groq response did not contain expected fields:", transcription);
      return { success: false, error: "Transcription failed: Unexpected response structure from Groq." };
    }

  } catch (error: unknown) {
    console.error(`[Server Action] Error during Groq API call for transcription (file: ${audioBlob.name}, size: ${audioBlobSizeMB}MB) after all retries:`, error);

    let userFriendlyError = "An unexpected error occurred during transcription.";
    let errorMessage = "";
    let errorCode: unknown = undefined;

    if (typeof error === "object" && error !== null) {
      if ("message" in error && typeof (error as { message: unknown }).message === "string") {
        errorMessage = (error as { message: string }).message;
        userFriendlyError = `An unexpected error occurred during transcription: ${errorMessage}`;
      }
      if ("code" in error) {
        errorCode = (error as { code: unknown }).code;
      }
    } else {
      userFriendlyError = `An unexpected error occurred during transcription: ${String(error)}`;
    }

    // Try to extract error.cause?.code if available
    if (
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof (error as { cause?: { code?: unknown } }).cause === "object" &&
      (error as { cause?: { code?: unknown } }).cause !== null &&
      "code" in (error as { cause?: { code?: unknown } }).cause!
    ) {
      errorCode = ((error as { cause?: { code?: unknown } }).cause as { code?: unknown }).code;
    }

    if (error instanceof Groq.APIConnectionTimeoutError) {
        userFriendlyError = `Groq API Error: Connection timed out after ${GROQ_REQUEST_TIMEOUT_MS / 1000}s. The audio file might be too large or processing took too long.`;
    } else if (error instanceof Groq.APIError) {
      if (error.status === 503) {
        userFriendlyError = "Groq’s transcription service is temporarily unavailable (503). This usually means the service is very busy or undergoing maintenance. Please try again in a few minutes.";
      } else if (errorCode === 'ECONNRESET') {
         userFriendlyError = `A connection error (ECONNRESET) occurred with the transcription service. This can happen with large files or network interruptions. Please try a smaller file or check your connection. File size: ${audioBlobSizeMB} MB.`;
      } else {
        userFriendlyError = `Groq API Error (Status: ${error.status || 'N/A'}): ${error.message}`;
      }
      console.error("[Server Action] Full Groq.APIError object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else if (errorCode === 'ECONNRESET') {
        userFriendlyError = `A direct connection error (ECONNRESET) occurred. This often happens with very large audio files. Please try a smaller file. File size: ${audioBlobSizeMB} MB.`;
    }
    
    return { success: false, error: userFriendlyError };
  }
}