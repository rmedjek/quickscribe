/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/transcribeWithAssemblyAiAction.ts
"use server";

import {AssemblyAI} from "assemblyai";
import {generateSRT, generateVTT, Segment} from "../lib/caption-utils";
import {DetailedTranscriptionResult} from "./transcribeAudioAction"; // Reusing this type
import {retryWithBackoff} from "@/lib/api-utils";

if (!process.env.ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY environment variable is not set.");
}

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export async function transcribeWithAssemblyAiAction(
  formData: FormData
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  const audioBlob = formData.get("audioBlob") as File | null;

  if (!audioBlob) {
    return {success: false, error: "No audio file provided in form data."};
  }

  const audioBlobSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
  console.log(
    `[AssemblyAI Action] Received audio blob: ${audioBlob.name}, Size: ${audioBlobSizeMB} MB`
  );

  try {
    const operation = async () => {
      // AssemblyAI requires the audio data, not a direct File object from FormData in this context.
      const audioData = await audioBlob.arrayBuffer();

      // The 'transcribe' method handles both uploading and polling for the result.
      return await assemblyClient.transcripts.transcribe({
        audio: Buffer.from(audioData), // Pass the audio data
        speaker_labels: true, // This is the key feature we want
      });
    };

    const transcript = await retryWithBackoff({
      operationName: `AssemblyAITranscription-${audioBlob.name.substring(
        0,
        20
      )}`,
      operation,
      maxRetries: 1, // AssemblyAI polling can be long, so limit retries on hard failures.
      initialBackoffMs: 3000,
    });

    if (transcript.status === "error") {
      console.error(
        "[AssemblyAI Action] Transcription job failed with error:",
        transcript.error
      );
      return {
        success: false,
        error: `AssemblyAI transcription failed: ${transcript.error}`,
      };
    }

    if (!transcript.utterances || !transcript.text) {
      console.error(
        "[AssemblyAI Action] AssemblyAI response did not contain expected fields (utterances, text)."
      );
      return {
        success: false,
        error:
          "Transcription failed: Unexpected response structure from AssemblyAI.",
      };
    }

    console.log("[AssemblyAI Action] Transcription successful.");

    // Convert AssemblyAI's 'utterances' into our standard 'Segment' format
    const typedSegments: Segment[] = transcript.utterances.map(
      (utterance, index) => ({
        id: index,
        start: utterance.start / 1000, // AssemblyAI uses milliseconds
        end: utterance.end / 1000,
        text: utterance.text,
        speaker: utterance.speaker, // Speaker label, e.g., 'A', 'B'
      })
    );

    // Reconstruct the full text with speaker labels for display
    const fullTextWithSpeakers = typedSegments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n");

    const srt = generateSRT(typedSegments);
    const vtt = generateVTT(typedSegments);

    const result: DetailedTranscriptionResult = {
      text: fullTextWithSpeakers,
      language: transcript.language_code, // e.g., "en_us"
      duration: transcript.audio_duration ?? undefined,
      segments: typedSegments,
      srtContent: srt,
      vttContent: vtt,
      extractedAudioSizeBytes: audioBlob.size,
    };

    return {success: true, data: result};
  } catch (error: any) {
    console.error(
      `[AssemblyAI Action] Error during AssemblyAI API call after all retries:`,
      error
    );
    const userFriendlyError = `An unexpected error occurred during transcription with AssemblyAI: ${
      error.message || String(error)
    }`;
    // Add more specific error handling if needed, similar to the Groq action
    return {success: false, error: userFriendlyError};
  }
}
