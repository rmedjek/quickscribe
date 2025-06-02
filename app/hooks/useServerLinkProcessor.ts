// app/hooks/useServerLinkProcessor.ts
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { processVideoLinkAction } from '@/actions/processVideoLinkAction';
import { TranscriptionMode } from '@/components/ConfirmationView';
import { StageDisplayData } from '@/components/ProcessingView';
import { DetailedTranscriptionResult } from '@/actions/transcribeAudioAction';

const ESTIMATED_DOWNLOAD_AND_EXTRACT_MS = 60000; // e.g. 60s total for link→audio
const ESTIMATED_SERVER_GROQ_MS       = 20000;
const PROGRESS_INTERVAL_MS           = 250;

interface ServerLinkProcessorOptions {
  onProcessingComplete: (data: DetailedTranscriptionResult) => void;
  onError: (errorMessage: string) => void;
  onStatusUpdate: (message: string) => void;
  onStagesUpdate: (stages: StageDisplayData[] | ((prevStages: StageDisplayData[]) => StageDisplayData[])) => void;
}

export function useServerLinkProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: ServerLinkProcessorOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const simulateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearSimInterval = useCallback(() => {
    if (simulateIntervalRef.current) {
      clearInterval(simulateIntervalRef.current);
      simulateIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearSimInterval();
  }, [clearSimInterval]);

  const STAGES_TEMPLATE = useMemo(() => [
    {
      name: "ServerLinkExtract",
      label: "Downloading & Extracting Audio",
      subText: "Fetching from link…",
    },
    {
      name: "ServerLinkTranscription",
      label: "Generating Transcript",
      subText: "AI is transcribing…",
    },
  ] as const, []);

  const processLink = useCallback(async (link: string, mode: TranscriptionMode) => {
    setIsProcessing(true);
    onStatusUpdate("Server: Downloading & extracting audio…");

    // Initialize both stages:
    let currentStages: StageDisplayData[] = STAGES_TEMPLATE.map((tmpl, idx) => ({
      name: tmpl.name,
      label: tmpl.label,
      progress: 0,
      isActive: idx === 0,
      isComplete: false,
      isIndeterminate: false,
      subText: tmpl.subText,
    }));
    onStagesUpdate([...currentStages]);

    // Simulate Stage 0 progress (download + ffmpeg)
    let downloadStep = 0;
    const downloadTotalSteps = Math.max(1, ESTIMATED_DOWNLOAD_AND_EXTRACT_MS / PROGRESS_INTERVAL_MS);

    simulateIntervalRef.current = setInterval(() => {
      downloadStep++;
      const fraction = Math.min(0.98, downloadStep / downloadTotalSteps);
      currentStages = currentStages.map(s =>
        s.name === "ServerLinkExtract"
          ? { ...s, progress: fraction, subText: `Downloading & extracting… ${Math.round(fraction * 100)}%` }
          : s
      );
      onStagesUpdate([...currentStages]);
      if (fraction >= 0.98) {
        clearSimInterval();
      }
    }, PROGRESS_INTERVAL_MS);

    try {
      // Actually call your server action:
      const response = await processVideoLinkAction(link, mode);

      // As soon as that promise resolves, kill the Stage 0 interval
      clearSimInterval();
      currentStages = currentStages.map(s =>
        s.name === "ServerLinkExtract"
          ? { ...s, progress: 1, isActive: false, isComplete: true, subText: "✓ Audio Ready" }
          : s
      );
      onStagesUpdate([...currentStages]);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Server‐side link processing failed.");
      }

      // Stage 1: “Generating Transcript”
      onStatusUpdate("Server: Generating transcript…");
      currentStages = currentStages.map(s =>
        s.name === "ServerLinkTranscription"
          ? { ...s, isActive: true, progress: 0, isComplete: false, isIndeterminate: false, subText: "AI is transcribing…" }
          : s
      );
      onStagesUpdate([...currentStages]);

      // Simulate transcription progress:
      let transcriptStep = 0;
      const transcriptTotalSteps = Math.max(1, ESTIMATED_SERVER_GROQ_MS / PROGRESS_INTERVAL_MS);
      simulateIntervalRef.current = setInterval(() => {
        transcriptStep++;
        const fraction = Math.min(0.95, transcriptStep / transcriptTotalSteps);
        currentStages = currentStages.map(s =>
          s.name === "ServerLinkTranscription"
            ? { ...s, progress: fraction, subText: `Transcribing… ${Math.round(fraction * 100)}%` }
            : s
        );
        onStagesUpdate([...currentStages]);
        if (fraction >= 0.95) {
          clearSimInterval();
        }
      }, PROGRESS_INTERVAL_MS);

      // Once the server action has returned (including Groq), finish Stage 1:
      clearSimInterval();
      currentStages = currentStages.map(s =>
        s.name === "ServerLinkTranscription"
          ? { ...s, progress: 1, isActive: false, isComplete: true, subText: "✓ Done" }
          : s
      );
      onStagesUpdate([...currentStages]);

      onStatusUpdate("Transcription complete!");
      onProcessingComplete(response.data);

    } catch (err) {
      clearSimInterval();
      const rawMsg = err instanceof Error ? err.message : String(err);
      onError(rawMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [
    onError,
    onStagesUpdate,
    onStatusUpdate,
    onProcessingComplete,
    clearSimInterval,
    STAGES_TEMPLATE,
  ]);

  return { processLink, isProcessing };
}
