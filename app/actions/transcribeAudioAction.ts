// app/actions/transcribeAudioAction.ts
"use server";

import Groq from "groq-sdk";
import {generateSRT, generateVTT, Segment} from "../lib/caption-utils";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {env} from "@/lib/env.mjs";

const TRANSCRIPTION_MODELS: Record<TranscriptionMode, string> = {
  core: env.GROQ_TRANSCRIPTION_MODEL_CORE,
  turbo: env.GROQ_TRANSCRIPTION_MODEL_TURBO,
};
const GROQ_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

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
  audioBuffer: Buffer,
  fileName: string,
  mode: TranscriptionMode
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  const modelToUse = TRANSCRIPTION_MODELS[mode];

  if (!audioBuffer || audioBuffer.length === 0) {
    return {success: false, error: "Provided audio buffer is empty."};
  }
  const audioBlobSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(
    `[transcribeAudioAction] Attempting to transcribe buffer. Name: "${fileName}", Size: ${audioBlobSizeMB} MB`
  );

  try {
    const groq = new Groq({
      apiKey: env.GROQ_API_KEY,
      timeout: GROQ_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });

    const audioFile = new File([audioBuffer], fileName, {type: "audio/opus"});

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: modelToUse,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });
    console.log("[transcribeAudioAction] Groq API call successful.");

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
      const typedSegments: Segment[] = segmentsFromApi.map((s, index) => ({
        id: s.id ?? index,
        start: s.start || 0,
        end: s.end || 0,
        text: s.text || "",
      }));

      const result: DetailedTranscriptionResult = {
        text: rawText,
        language,
        duration,
        segments: typedSegments,
        srtContent: generateSRT(typedSegments),
        vttContent: generateVTT(typedSegments),
        extractedAudioSizeBytes: audioBuffer.length,
      };
      return {success: true, data: result};
    } else {
      console.error(
        "[transcribeAudioAction] Groq response did not contain expected fields:",
        transcription
      );
      return {
        success: false,
        error: "Transcription failed: Unexpected response structure from Groq.",
      };
    }
  } catch (error: unknown) {
    console.error(
      `[transcribeAudioAction] FAILED for file: "${fileName}", Size: ${audioBuffer.length}. Full Error:`,
      error
    );

    let userFriendlyError =
      "An unexpected error occurred during transcription.";
    if (error instanceof Groq.APIError) {
      // Create a more specific error message based on the Groq error.
      userFriendlyError = `Groq API Error (Status: ${error.status || "N/A"}): ${
        error.message
      }`;
    } else if (error instanceof Error) {
      userFriendlyError = error.message;
    }

    return {success: false, error: userFriendlyError};
  }
}
