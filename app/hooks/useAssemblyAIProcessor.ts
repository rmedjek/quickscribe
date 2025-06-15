// app/hooks/useAssemblyAIProcessor.ts
"use client";

import {useState, useCallback} from "react";
import {transcribeWithAssemblyAction} from "@/actions/transcribeWithAssemblyAction";
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {extractAudioAction} from "@/actions/extractAudioAction";
import {useStageUpdater} from "./useStageUpdater";
import {useStepper} from "../contexts/StepperContext";
import {StageDisplayData} from "@/components/ProcessingView";

interface Props {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
}

export function useAssemblyAIProcessor({
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: Props) {
  const {setStep} = useStepper();
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  const processFile = useCallback(
    async (file: File, isDirectAudio: boolean) => {
      setBusy(true);
      setStep("process");
      onStagesUpdate([
        {
          name: "prepare_audio",
          label: "Preparing Audio",
          progress: 0,
          isActive: true,
          isIndeterminate: true,
        },
        {
          name: "transcribe_assembly",
          label: "AI Transcribing (with Speaker Labels)",
          progress: 0,
          isActive: false,
          isIndeterminate: false,
        },
      ]);

      let audioBlob: Blob;
      if (isDirectAudio) {
        onStatusUpdate("Uploading audio file...");
        audioBlob = file;
        patch("prepare_audio", {
          isIndeterminate: false,
          progress: 1,
          label: "Audio ready",
        });
      } else {
        onStatusUpdate("Extracting audio from video...");
        patch("prepare_audio", {label: "Extracting audio from video..."});
        const fd = new FormData();
        fd.append("videoFile", file);
        const ex = await extractAudioAction(fd);
        if (!ex.success) {
          onError(ex.error, file.name);
          setBusy(false);
          return;
        }
        const bytes = Uint8Array.from(atob(ex.audioBase64), (c) =>
          c.charCodeAt(0)
        );
        audioBlob = new Blob([bytes], {type: "audio/opus"});
        patch("prepare_audio", {
          isIndeterminate: false,
          progress: 1,
          label: "Audio extracted",
        });
      }
      patch("prepare_audio", {isActive: false, isComplete: true});

      setStep("transcribe");
      onStatusUpdate("AI is transcribing your audio with speaker detection...");
      patch("transcribe_assembly", {
        isActive: true,
        isIndeterminate: true,
        subText: "This may take several minutes for long files...",
      });

      const formDataForAssembly = new FormData();
      formDataForAssembly.append("audioBlob", audioBlob, "audio.opus");

      const result = await transcribeWithAssemblyAction(formDataForAssembly);

      if (result.success && result.data) {
        patch("transcribe_assembly", {
          isIndeterminate: false,
          progress: 1,
          isActive: false,
          isComplete: true,
          subText: "Speaker analysis complete!",
        });
        onProcessingComplete(result.data);
      } else {
        onError(
          result.error || "Failed to transcribe with AssemblyAI",
          file.name
        );
        patch("transcribe_assembly", {isActive: false});
      }
      setBusy(false);
    },
    [
      onProcessingComplete,
      onError,
      onStatusUpdate,
      onStagesUpdate,
      patch,
      setStep,
    ]
  );

  return {processFile, isProcessing: busy};
}
