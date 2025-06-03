// app/hooks/useServerFileUploadProcessor.ts
"use client";

import { useState, useCallback } from "react";
import {
  extractAudioAction,
  ExtractAudioResponse,
} from "@/actions/extractAudioAction";
import { transcribeAudioAction } from "@/actions/transcribeAudioAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { DetailedTranscriptionResult } from "@/actions/transcribeAudioAction";
import { useStageUpdater } from "./useStageUpdater";

/* ------------ props -------------------------------------------- */
interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
  /** advance stepper ("configure" | "process" | "transcribe") */
  onStepChange?: (id: "configure" | "process" | "transcribe") => void;
}

/* ================================================================= */
export function useServerFileUploadProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  /* ---------------------------------------------------------------- */
  const processFile = useCallback(
    async (file: File, mode: TranscriptionMode) => {
      setBusy(true);
      onStepChange?.("process");

      /* ---------------------- initialise stages -------------------- */
      onStagesUpdate([
        {
          name: "extract",
          label: "Uploading & Processing Audio",
          progress: 0,
          isActive: true,
          isComplete: false,
          isIndeterminate: true,
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

      /* ---------------------- phase 1: extract -------------------- */
      onStatusUpdate("Uploading & extracting…");
      const fd = new FormData();
      fd.append("videoFile", file);

      const ex = (await extractAudioAction(fd)) as ExtractAudioResponse;

      if (!ex.success) {
        onError(ex.error, file.name);
        setBusy(false);
        return;
      }

      patch("extract", {
        isIndeterminate: false,
        progress: 1,
        isActive: false,
        isComplete: true,
      });

      /* 🔔 move stepper from “process” -> “transcribe” */
      onStepChange?.("transcribe");

      /* ---------------------- phase 2: Groq ----------------------- */
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

      const bytes = Uint8Array.from(
        atob(ex.audioBase64),
        (c) => c.charCodeAt(0)
      );
      const blob = new Blob([bytes], { type: "audio/opus" });
      const fd2 = new FormData();
      fd2.append("audioBlob", blob, ex.fileName);

      const tr = await transcribeAudioAction(fd2, mode);

      if (!tr.success || !tr.data) {
        patch("groq", { isActive: false, isIndeterminate: false });
        onError(tr.error ?? "Transcription failed", file.name);
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

      onProcessingComplete(tr.data);
      setBusy(false);
    },
    [
      onError,
      onProcessingComplete,
      onStatusUpdate,
      onStagesUpdate,
      patch,
      onStepChange,
    ]
  );

  return { processFile, isProcessing: busy };
}
