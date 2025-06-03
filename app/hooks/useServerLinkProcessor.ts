// app/hooks/useServerLinkProcessor.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { processVideoLinkAction } from "@/actions/processVideoLinkAction";
import { DetailedTranscriptionResult } from "@/actions/transcribeAudioAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { useStageUpdater } from "./useStageUpdater";

const AUDIO_EST_MS = 12_000;

/* ------------ props -------------------------------------------- */
interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
  /** advance stepper */
  onStepChange?: (id: "configure" | "process" | "transcribe") => void;
}

/* ================================================================= */
export function useServerLinkProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  /* ---------------------------------------------------------------- */
  const processLink = useCallback(
    async (link: string, mode: TranscriptionMode) => {
      setBusy(true);
      onStepChange?.("process");

      onStagesUpdate([
        {
          name: "audio",
          label: "Downloading & Processing Audio",
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

      const modelName =
        mode === "turbo"
          ? "Whisper Large v3"
          : "Distil-Whisper Large-v3-en";

      /* ---------------- fake progress while server extracts ------- */
      timer.current = setTimeout(() => {
        patch("audio", {
          isIndeterminate: false,
          progress: 1,
          isActive: false,
          isComplete: true,
        });

        patch("groq", {
          isActive: true,
          isIndeterminate: true,
          subText: `Processing using Groq's ${modelName} model`,
        });

        /* 🔔 stepper advance */
        onStepChange?.("transcribe");
      }, AUDIO_EST_MS);

      onStatusUpdate("Server is processing the link…");
      const res = await processVideoLinkAction(link, mode);
      clearTimeout(timer.current!);

      if (!res.success || !res.data) {
        patch("audio", { isIndeterminate: false });
        patch("groq", { isIndeterminate: false });
        onError(res.error ?? "Failed to process link");
        setBusy(false);
        return;
      }

      /* ---------------- mark both bars complete ------------------- */
      patch("audio", {
        isIndeterminate: false,
        progress: 1,
        isActive: false,
        isComplete: true,
      });
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
    [
      patch,
      onError,
      onProcessingComplete,
      onStatusUpdate,
      onStagesUpdate,
      onStepChange,
    ]
  );

  return { processLink, isProcessing: busy };
}
