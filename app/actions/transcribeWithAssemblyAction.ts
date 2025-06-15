/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/transcribeWithAssemblyAction.ts
"use server";

import {AssemblyAI} from "assemblyai"; // Correct import
import {DetailedTranscriptionResult} from "./transcribeAudioAction";
import {generateSRT, generateVTT, Segment} from "../lib/caption-utils";

if (!process.env.ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY environment variable is not set.");
}

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export async function transcribeWithAssemblyAction(
  formData: FormData
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  const audioBlob = formData.get("audioBlob") as File | null;
  if (!audioBlob) {
    return {success: false, error: "No audio file provided."};
  }

  const audioBlobSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
  console.log(
    `[AssemblyAI Action] Received audio blob: ${audioBlob.name}, Size: ${audioBlobSizeMB} MB`
  );

  try {
    console.log(
      "[AssemblyAI Action] Submitting transcription job with speaker labels (SDK handles upload and polling)..."
    );

    // The .transcribe() method is a high-level helper that handles upload, job submission, and polling for you.
    // It accepts a File object directly.
    const transcript = await assemblyClient.transcripts.transcribe({
      audio: audioBlob,
      speaker_labels: true, // This is the key feature we want!
    });

    if (transcript.status === "error") {
      // If the job fails, throw an error to be caught by the catch block.
      throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
    }

    if (!transcript.text || !transcript.utterances) {
      // This can happen if transcription completes but returns no content.
      throw new Error(
        "Transcription completed but the response from AssemblyAI was empty or in an unexpected format."
      );
    }

    console.log("[AssemblyAI Action] Transcription completed successfully!");

    // Format the text with speaker labels for the main transcript view
    const fullTextWithSpeakers = transcript.utterances
      .map((u) => `Speaker ${u.speaker}: ${u.text}`)
      .join("\n\n"); // Use double newline for better paragraph separation

    // Create SRT/VTT compatible segments. Here we can use the speaker and text together.
    const srtAndVttSegments: Segment[] = transcript.utterances.map(
      (utterance, index) => ({
        id: index,
        start: utterance.start / 1000, // Convert milliseconds to seconds
        end: utterance.end / 1000,
        text: `Speaker ${utterance.speaker}: ${utterance.text}`,
      })
    );

    const result: DetailedTranscriptionResult = {
      text: fullTextWithSpeakers,
      language: transcript.language_code || "unknown",
      duration: transcript.audio_duration || undefined,
      segments: transcript.utterances.map((u, i) => ({
        id: i,
        start: u.start / 1000,
        end: u.end / 1000,
        text: `Speaker ${u.speaker}: ${u.text}`, // Storing with speaker label for potential future use
      })),
      srtContent: generateSRT(srtAndVttSegments),
      vttContent: generateVTT(srtAndVttSegments),
      extractedAudioSizeBytes: audioBlob.size,
    };

    return {success: true, data: result};
  } catch (error: any) {
    console.error("[AssemblyAI Action] An error occurred:", error);
    return {
      success: false,
      error: error.message || "An unknown error occurred with AssemblyAI.",
    };
  }
}
