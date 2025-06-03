// app/hooks/useClientFileProcessor.ts
"use client";

import { useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { extractAudio } from "@/lib/ffmpeg-utils";
import {
  transcribeAudioAction,
  DetailedTranscriptionResult,
} from "@/actions/transcribeAudioAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { useStageUpdater } from "./useStageUpdater";

/* -------------------------------- props ------------------------ */
interface Props {
  ffmpeg: FFmpeg | null;
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
  /** tell the parent stepper to advance ("configure" | "process" | "transcribe") */
  onStepChange?: (id: "configure" | "process" | "transcribe") => void;
}

/* ===================================================================== */
export function useClientFileProcessor({
  ffmpeg,
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  /* ------------------------------------------------------------------- */
  const processFile = useCallback(
    async (file: File, mode: TranscriptionMode) => {
      if (!ffmpeg) {
        onError("FFmpeg not loaded");
        return;
      }
      setBusy(true);
      onStepChange?.("process");

      /* --------------------------- initialise stages ------------------ */
      onStagesUpdate([
        {
          name: "audio",
          label: "Extracting audio",
          progress: 0,
          isActive: true,
          isComplete: false,
          isIndeterminate: false,
        },
        {
          name: "groq",
          label: "AI Transcribing…",
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: false,
          subText: "",
        },
      ]);

      /* --------------------------- audio extraction ------------------ */
      onStatusUpdate("Extracting audio…");
      let audioBlob: Blob;
      try {
        audioBlob = await extractAudio({
          file,
          outputFormat: "opus",
          onProgress: (p) => patch("audio", { progress: p }),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        onError(msg);
        setBusy(false);
        return;
      }
      patch("audio", { progress: 1, isActive: false, isComplete: true });

      /* --------------------------- stepper advance ------------------- */
      onStepChange?.("transcribe"); // 🔔 move to "Get Transcripts"

      /* --------------------------- Groq transcription ---------------- */
      const modelName =
        mode === "turbo"
          ? "Whisper Large v3"
          : "Distil-Whisper Large-v3-en";

      onStatusUpdate("AI is transcribing your audio…");
      patch("groq", {
        isActive: true,
        isIndeterminate: true,
        subText: `Processing using Groq's ${modelName} model`,
      });

      const form = new FormData();
      form.append("audioBlob", audioBlob, "audio.opus");
      const res = await transcribeAudioAction(form, mode);

      if (!res.success || !res.data) {
        patch("groq", { isActive: false, isIndeterminate: false });
        onError(res.error ?? "Transcription failed");
        setBusy(false);
        return;
      }

      patch("groq", {
        isIndeterminate: false,
        progress: 1,
        isActive: false,
        isComplete: true,
        subText: `Processed with Groq's ${modelName} model`,
      });

      onProcessingComplete(res.data);
      setBusy(false);
    },
    [ffmpeg, onError, onProcessingComplete, onStatusUpdate, onStagesUpdate, patch, onStepChange]
  );

  return { processFile, isProcessing: busy };
}
