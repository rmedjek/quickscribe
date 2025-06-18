/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/transcribeWithAssemblyAiAction.ts
"use server";

import {AssemblyAI, TranscriptUtterance} from "assemblyai";
import {generateSRT, generateVTT, Segment} from "../lib/caption-utils";
import {DetailedTranscriptionResult} from "./transcribeAudioAction";
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
      const audioData = await audioBlob.arrayBuffer();
      return await assemblyClient.transcripts.transcribe({
        audio: Buffer.from(audioData),
        speaker_labels: true,
      });
    };

    const transcript = await retryWithBackoff({
      operationName: `AssemblyAITranscription-${audioBlob.name.substring(
        0,
        20
      )}`,
      operation,
      maxRetries: 1,
      initialBackoffMs: 3000,
    });

    console.log(
      "[AssemblyAI Action] Full transcript object status:",
      transcript.status
    );
    if (transcript.status === "completed") {
      console.log(
        "[AssemblyAI Action] Detected Language Code from AssemblyAI:",
        transcript.language_code
      );
      console.log(
        "[AssemblyAI Action] Full transcript text (from AssemblyAI - raw):",
        transcript.text?.substring(0, 300) + "..."
      ); // This is raw text
      if (transcript.utterances && transcript.utterances.length > 0) {
        console.log(
          `[AssemblyAI Action] Number of utterances: ${transcript.utterances.length}`
        );
        transcript.utterances.slice(0, 3).forEach((utt, idx) => {
          // Use TranscriptUtterance type if possible
          console.log(
            `[AssemblyAI Action] Utterance ${idx} speaker: ${
              utt.speaker
            }, text: "${utt.text.substring(0, 30)}..."`
          );
        });
      } else {
        console.log(
          "[AssemblyAI Action] No utterances found in AssemblyAI response."
        );
      }
    } else if (transcript.status === "error") {
      console.error(
        "[AssemblyAI Action] Transcription job failed:",
        transcript.error
      );
      return {
        success: false,
        error: `AssemblyAI transcription failed: ${transcript.error}`,
      };
    }

    // Ensure utterances are present for further processing
    if (!transcript.utterances || transcript.utterances.length === 0) {
      console.error(
        "[AssemblyAI Action] No utterances available to process speaker labels."
      );
      // Fallback to using the raw text if no utterances, though it won't have speaker labels
      return {
        success: true, // Or false if this is considered a failure of diarization
        data: {
          text:
            transcript.text ||
            "Transcription complete but no speaker segments found.",
          language: transcript.language_code,
          duration: transcript.audio_duration ?? undefined,
          segments: [],
          srtContent: "",
          vttContent: "",
          extractedAudioSizeBytes: audioBlob.size,
        },
      };
    }

    const typedSegments: Segment[] = transcript.utterances.map(
      (utterance: TranscriptUtterance, index: number) => ({
        id: index,
        start: utterance.start / 1000,
        end: utterance.end / 1000,
        text: utterance.text || "",
        speaker: utterance.speaker || undefined, // Speaker will be 'A', 'B', etc. or undefined
      })
    );

    // Reconstruct the full text WITH speaker labels
    const fullTextWithSpeakers = typedSegments
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)) // Prepend speaker if available
      .join("\n");

    console.log(
      "[AssemblyAI Action] Constructed fullTextWithSpeakers (first 500 chars):",
      fullTextWithSpeakers.substring(0, 500)
    );

    const srt = generateSRT(typedSegments); // These utils already handle speaker field
    const vtt = generateVTT(typedSegments);

    const result: DetailedTranscriptionResult = {
      text: fullTextWithSpeakers, // *** USE THE TEXT WITH SPEAKERS ***
      language: transcript.language_code,
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
    return {success: false, error: userFriendlyError};
  }
}
