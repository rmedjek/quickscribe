// app/hooks/useServerLinkProcessor.ts
"use client";

import {useState, useCallback, useRef, useEffect} from "react";
import {processVideoLinkAction} from "@/actions/processVideoLinkAction";
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {StageDisplayData} from "@/components/ProcessingView";
import {useStageUpdater} from "./useStageUpdater";
import {useStepper} from "../contexts/StepperContext";
import {
  TRANSCRIPTION_MODEL_DISPLAY_NAMES,
  TranscriptionEngine,
  TranscriptionMode,
} from "@/types/app";

const AUDIO_EST_MS = 12_000;

interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
}

export function useServerLinkProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: Props) {
  const {setStep} = useStepper();
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const processLink = useCallback(
    // Ensure this signature matches the call from page.tsx
    async (
      link: string,
      mode: TranscriptionMode,
      engine: TranscriptionEngine
    ) => {
      console.log("====================================================");
      console.log("      REBUILT useServerLinkProcessor - processLink     ");
      console.log("====================================================");
      console.log("Received Link:", link);
      console.log("Received Mode:", mode);
      console.log("Received Engine:", engine); // <<< VERIFY THIS STILL SHOWS "assembly"
      console.log("====================================================");

      setBusy(true);
      setStep?.("process");

      const engineDisplayName =
        engine === "assembly" ? "AssemblyAI" : "Groq (Whisper)";
      const modelForDisplay =
        engine === "groq"
          ? TRANSCRIPTION_MODEL_DISPLAY_NAMES[mode]
          : // For AssemblyAI, the "mode" (core/turbo) isn't directly applicable to its model choice.
            // We can show a generic label or eventually derive it from AssemblyAI's response if needed.
            "Diarization Model";

      onStagesUpdate([
        {
          name: "link_prep", // Changed stage name for clarity
          label: `Server: Downloading & Preparing Audio for ${engineDisplayName}`,
          progress: 0,
          isActive: true,
          isComplete: false,
          isIndeterminate: true,
          subText: "This may take some time for longer videos...",
        },
        {
          name: "link_transcribe",
          label: `AI Transcribing with ${engineDisplayName}`,
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: false,
          subText: "",
        },
      ]);

      onStatusUpdate(
        `Server is processing the link using ${engineDisplayName}...`
      );

      // Fake progress timer - can be adjusted or made smarter
      // For AssemblyAI, the processing time can be much longer than Groq's.
      // This timer might need to be different or disabled based on the engine.
      const estimateMs =
        engine === "assembly" ? AUDIO_EST_MS * 3 : AUDIO_EST_MS; // Longer estimate for AssemblyAI
      timer.current = setTimeout(() => {
        patch("link_prep", {
          isIndeterminate: false,
          progress: 1,
          isActive: false,
          isComplete: true,
          label: `Server: Audio Ready for ${engineDisplayName}`,
        });
        patch("link_transcribe", {
          isActive: true,
          isIndeterminate: true,
          subText: `Using ${modelForDisplay}...`,
        });
        setStep?.("transcribe");
      }, estimateMs);

      // THE CRUCIAL LINE: Pass the `engine` parameter to processVideoLinkAction
      const res = await processVideoLinkAction(link, mode, engine);

      if (timer.current) clearTimeout(timer.current);

      if (!res.success || !res.data) {
        patch("link_prep", {
          isIndeterminate: false,
          isActive: false,
          isComplete: true,
        }); // Mark prep as done
        patch("link_transcribe", {
          isActive: false,
          isIndeterminate: false,
          label: `AI Transcription Failed (${engineDisplayName})`,
        });
        onError(
          res.error ?? `Failed to process link with ${engineDisplayName}`
        );
        setBusy(false);
        return;
      }

      patch("link_prep", {progress: 1, isActive: false, isComplete: true});
      patch("link_transcribe", {
        isIndeterminate: false,
        progress: 1,
        isActive: false,
        isComplete: true,
        subText: `Processed with ${modelForDisplay}`,
      });
      onProcessingComplete(res.data);
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

  return {processLink, isProcessing: busy};
}
