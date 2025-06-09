// app/hooks/useServerFileUploadProcessor.ts
"use client";

import { useState, useCallback } from "react";
import {
  extractAudioAction, // Used for video files
  ExtractAudioResponse,
} from "@/actions/extractAudioAction";
import {
    transcribeAudioAction, // Used for all transcriptions
    DetailedTranscriptionResult
} from "@/actions/transcribeAudioAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { useStageUpdater } from "./useStageUpdater";
import { useStepper } from "../contexts/StepperContext";

interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
}

export function useServerFileUploadProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: Props) {
  const { setStep } = useStepper();
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  const processFile = useCallback(
    async (file: File, mode: TranscriptionMode, isDirectAudio: boolean) => {
      setBusy(true);
      setStep?.("process"); // Move to "Process Audio" step

      let audioBlobForGroq: Blob;
      const originalFileName = file.name;
      const originalFileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      let audioFileNameForGroq = file.name; // Default to original, override if extracted

      if (isDirectAudio) {
        console.log("[ServerProc] Processing direct audio file on server:", originalFileName);
        onStagesUpdate([ // Simplified stages for direct audio
          { name: "upload_audio", label: "Uploading Audio", progress: 0, isActive: true, isComplete: false, isIndeterminate: true, subText: "Preparing audio for transcription..." },
          { name: "groq", label: "AI Transcribing…", progress: 0, isActive: false, isComplete: false, isIndeterminate: false, subText: ""},
        ]);
        onStatusUpdate("Uploading audio for transcription…");

        // The file itself is the audio blob we need for Groq.
        // No server-side FFmpeg extraction needed.
        audioBlobForGroq = file;
        // No specific action needed for "upload_audio" progress here as it's just passing the file object.
        // We can mark it complete before calling Groq.
        patch("upload_audio", { isIndeterminate: false, progress: 1, isActive: false, isComplete: true, label: "Audio ready for transcription" });

      } else { // It's a video file, use existing server-side FFmpeg extraction logic
        console.log("[ServerProc] Extracting audio from video file on server:", originalFileName);
        onStagesUpdate([
          { name: "extract_server", label: "Uploading & Extracting Audio (Server)", progress: 0, isActive: true, isComplete: false, isIndeterminate: true, subText: "Server is processing video..." },
          { name: "groq", label: "AI Transcribing…", progress: 0, isActive: false, isComplete: false, isIndeterminate: false, subText: "" },
        ]);
        onStatusUpdate("Server is extracting audio from video…");

        const formDataForExtraction = new FormData();
        formDataForExtraction.append("videoFile", file);

        const extractionResult = (await extractAudioAction(formDataForExtraction)) as ExtractAudioResponse;

        if (!extractionResult.success) {
          onError(extractionResult.error, originalFileName, originalFileSizeMB);
          setBusy(false);
          return;
        }

        // Convert base64 Opus audio from server back to a Blob
        const byteString = atob(extractionResult.audioBase64);
        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        audioBlobForGroq = new Blob([ia], { type: "audio/opus" }); // Extracted audio is always Opus
        audioFileNameForGroq = extractionResult.fileName; // Usually "audio.opus"

        patch("extract_server", { isIndeterminate: false, progress: 1, isActive: false, isComplete: true, label: "Audio Extracted (Server)" });
      }

      // --- Common part: Groq Transcription ---
      setStep?.("transcribe"); // Move to "Get Transcripts" step
      const modelName = mode === "turbo" ? "Whisper Large v3" : "Distil-Whisper Large-v3-en";
      onStatusUpdate("AI is transcribing your audio…");
      patch("groq", { isActive: true, isIndeterminate: true, subText: `Processing using Groq's ${modelName} model` });

      const formDataForTranscription = new FormData();
      formDataForTranscription.append("audioBlob", audioBlobForGroq, audioFileNameForGroq);

      console.log(`[ServerProc] Sending audio to transcribeAudioAction. Type: ${audioBlobForGroq.type}, Name: ${audioFileNameForGroq}`);
      const transcriptionResult = await transcribeAudioAction(formDataForTranscription, mode);

      if (!transcriptionResult.success || !transcriptionResult.data) {
        patch("groq", { isActive: false, isIndeterminate: false });
        onError(transcriptionResult.error ?? "Transcription failed", audioFileNameForGroq, (audioBlobForGroq.size / (1024*1024)).toFixed(2));
        setBusy(false);
        return;
      }

      patch("groq", { isIndeterminate: false, progress: 1, isActive: false, isComplete: true, subText: `Processed with Groq's ${modelName} model` });
      onProcessingComplete(transcriptionResult.data);
      setBusy(false);
    },
    [onError, onProcessingComplete, onStatusUpdate, onStagesUpdate, patch, setStep]
  );

  return { processFile, isProcessing: busy };
}