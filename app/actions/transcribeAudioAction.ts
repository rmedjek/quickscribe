/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/transcribeAudioAction.ts
"use server"; 

import Groq from 'groq-sdk';
import { generateSRT, generateVTT,Segment } from '../lib/caption-utils';

if (!process.env.GROQ_API_KEY) {
  // In a real app, you might want a less abrupt way to handle this,
  // but for development, an error is fine.
  throw new Error("GROQ_API_KEY environment variable is not set.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Define what our ideal transcription result includes
export interface DetailedTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Segment[]; // Use our defined Segment interface
  srtContent?: string;
  vttContent?: string;
}

export async function transcribeAudioAction(
  formData: FormData
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log("[Server Action] transcribeAudioAction called");

  const audioBlob = formData.get("audioBlob") as File | null;

  if (!audioBlob) {
    console.error("[Server Action] No audio blob found in FormData");
    return { success: false, error: "No audio data received." };
  }

  console.log(`[Server Action] Received audio blob: ${audioBlob.name}, size: ${audioBlob.size}, type: ${audioBlob.type}`);

  try {
    console.log("[Server Action] Sending audio to Groq for transcription (requesting verbose_json)...");
    
    // Attempt to get verbose_json. Groq might also support 'srt' or 'vtt' directly for Whisper.
    // You might need to experiment with what `response_format` Groq supports for its Whisper models.
    // Common options for Whisper APIs are: 'json' (default, text only), 'text', 'srt', 'vtt', 'tsv', 'verbose_json'.
    const transcription = await groq.audio.transcriptions.create({
        file: audioBlob,
        model: "whisper-large-v3",
        response_format: "verbose_json", 
        timestamp_granularities: ["segment"], // Request segment-level timestamps
      });

    // Log the raw response to inspect its structure thoroughly
    console.log("[Server Action] Raw verbose_json response from Groq:", JSON.stringify(transcription, null, 2));

    // IMPORTANT: Adapt this parsing based on the actual structure logged by Groq
    // This assumes 'transcription' itself is the verbose_json object.
    const rawText = (transcription as any).text as string | undefined;
    const language = (transcription as any).language as string | undefined;
    const duration = (transcription as any).duration as number | undefined;
    const segmentsFromApi = (transcription as any).segments as Array<any> | undefined;
    
    if (rawText && Array.isArray(segmentsFromApi)) {
        const typedSegments: Segment[] = segmentsFromApi.map((s: any, index: number) => ({
          id: index,
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
        };
        return { success: true, data: result };
      } else {
        console.error("[Server Action] Groq response (verbose_json) did not contain expected fields (text/segments):", transcription);
        return { success: false, error: "Transcription failed: Unexpected response structure from Groq (verbose_json)." };
      }
  
    } catch (error) {
      // ... (error handling as before) ...
      console.error("[Server Action] Error during Groq API call:", error);
      if (error instanceof Groq.APIError) { 
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