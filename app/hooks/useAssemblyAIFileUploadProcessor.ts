// app/hooks/useAssemblyAIFileUploadProcessor.ts
"use client";

import {useState, useCallback} from "react";
import {
  extractAudioAction,
  ExtractAudioResponse,
} from "@/actions/extractAudioAction";
import {transcribeWithAssemblyAiAction} from "@/actions/transcribeWithAssemblyAiAction";
import {StageDisplayData} from "@/components/ProcessingView";
import {useStageUpdater} from "./useStageUpdater";
import {useStepper} from "../contexts/StepperContext";
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";

interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
}

export function useAssemblyAIFileUploadProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: Props) {
  const {setStep} = useStepper();
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  const processFileWithAssemblyAI = useCallback(
    // AssemblyAI doesn't use the 'core'/'turbo' mode like Groq,
    // so the `mode` parameter is not strictly needed here unless you plan to pass other options.
    // We'll keep `isDirectAudio` to distinguish file types.
    async (file: File, isDirectAudio: boolean) => {
      setBusy(true);
      setStep("process");

      const originalFileName = file.name;
      const originalFileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      let audioBlobForAssembly: Blob;

      if (isDirectAudio) {
        console.log(
          "[AssemblyFileProc] Processing direct audio file with AssemblyAI:",
          originalFileName
        );
        onStagesUpdate([
          {
            name: "assembly_prep_audio",
            label: "Preparing Audio for AssemblyAI",
            progress: 0,
            isActive: true,
            isComplete: false,
            isIndeterminate: true,
          },
          {
            name: "assembly_transcribe",
            label: "Transcribing with AssemblyAI",
            progress: 0,
            isActive: false,
            isComplete: false,
            isIndeterminate: true,
          },
        ]);
        onStatusUpdate("Preparing your audio file for AssemblyAI...");
        audioBlobForAssembly = file; // Use the original audio file directly
        patch("assembly_prep_audio", {
          progress: 1,
          isIndeterminate: false,
          isActive: false,
          isComplete: true,
          label: "Audio Ready for AssemblyAI",
        });
      } else {
        // It's a video file, extract audio first using server-side FFmpeg
        console.log(
          "[AssemblyFileProc] Video file detected. Extracting audio for AssemblyAI:",
          originalFileName
        );
        onStagesUpdate([
          {
            name: "assembly_extract_audio",
            label: "Server: Extracting Audio for AssemblyAI",
            progress: 0,
            isActive: true,
            isComplete: false,
            isIndeterminate: true,
          },
          {
            name: "assembly_transcribe",
            label: "Transcribing with AssemblyAI",
            progress: 0,
            isActive: false,
            isComplete: false,
            isIndeterminate: true,
          },
        ]);
        onStatusUpdate("Server is extracting audio from your video...");

        const formDataForExtraction = new FormData();
        formDataForExtraction.append("videoFile", file);
        const extractionResult = (await extractAudioAction(
          formDataForExtraction
        )) as ExtractAudioResponse;

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
        audioBlobForAssembly = new Blob([ia], {type: "audio/opus"}); // Extracted audio is Opus
        patch("assembly_extract_audio", {
          progress: 1,
          isIndeterminate: false,
          isActive: false,
          isComplete: true,
          label: "Audio Extracted for AssemblyAI",
        });
      }

      // --- Transcription with AssemblyAI ---
      setStep("transcribe");
      onStatusUpdate(
        "Submitting audio to AssemblyAI for transcription with speaker labels..."
      );
      patch("assembly_transcribe", {
        isActive: true,
        subText: "This may take a few minutes for longer audio...",
      });

      const formDataForTranscription = new FormData();
      formDataForTranscription.append(
        "audioBlob",
        audioBlobForAssembly,
        isDirectAudio ? originalFileName : "audio_for_assembly.opus"
      );

      const transcriptionResult = await transcribeWithAssemblyAiAction(
        formDataForTranscription
      );

      if (!transcriptionResult.success || !transcriptionResult.data) {
        patch("assembly_transcribe", {
          isActive: false,
          isIndeterminate: false,
          label: "AssemblyAI Transcription Failed",
        });
        onError(
          transcriptionResult.error ?? "AssemblyAI transcription failed.",
          originalFileName,
          (audioBlobForAssembly.size / (1024 * 1024)).toFixed(2)
        );
        setBusy(false);
        return;
      }

      patch("assembly_transcribe", {
        isIndeterminate: false,
        progress: 1,
        isActive: false,
        isComplete: true,
        subText: `Processed with AssemblyAI. Language: ${
          transcriptionResult.data.language || "N/A"
        }`,
      });
      onProcessingComplete(transcriptionResult.data);
      setBusy(false);
    },
    [
      onError,
      onProcessingComplete,
      onStatusUpdate,
      onStagesUpdate,
      patch,
      setStep,
    ]
  );

  return {processFileWithAssemblyAI, isProcessingAssemblyAI: busy};
}
