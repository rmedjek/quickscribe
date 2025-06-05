// app/hooks/useClientFileProcessor.ts
"use client";

import { useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { extractAudio } from "@/lib/ffmpeg-utils"; // Ensure ExtractAudioOptions is exported if needed by extractAudio
import {
  transcribeAudioAction,
  DetailedTranscriptionResult,
} from "@/actions/transcribeAudioAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { useStageUpdater } from "./useStageUpdater";

interface Props {
  ffmpeg: FFmpeg | null; // Renamed in calling component to ffmpegFromProp for clarity if preferred
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fn?: string, sizeMB?: string) => void;
  onStatusUpdate: (msg: string) => void;
  onStagesUpdate: (
    s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
  ) => void;
  onStepChange?: (id: "configure" | "process" | "transcribe") => void;
}

export function useClientFileProcessor({
  ffmpeg: ffmpegFromProp, // Use the passed FFmpeg instance
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const patch = useStageUpdater(onStagesUpdate);

  const processFile = useCallback(
    async (file: File, mode: TranscriptionMode, isDirectAudio: boolean) => {
      setBusy(true);
      onStepChange?.("process");

      let audioBlob: Blob;
      const originalFileName = file.name;
      const originalFileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      // Check if FFmpeg is needed and if it's ready
      const needsConversionOrExtraction = !isDirectAudio || (isDirectAudio && file.type !== "audio/opus");
      if (needsConversionOrExtraction) {
        if (!ffmpegFromProp || (typeof ffmpegFromProp.isLoaded === 'function' && !ffmpegFromProp.isLoaded())) {
          onError(
            "FFmpeg is not loaded or ready. Cannot process this file in the browser.",
            originalFileName,
            originalFileSizeMB
          );
          setBusy(false);
          return;
        }
      }

      if (isDirectAudio) {
        console.log("[ClientProc] Processing direct audio file:", originalFileName);
        onStagesUpdate([
          { name: "audio_prep", label: "Preparing audio", progress: 0, isActive: true, isComplete: false, isIndeterminate: true, subText: "Checking audio format..." },
          { name: "groq", label: "AI Transcribing…", progress: 0, isActive: false, isComplete: false, isIndeterminate: false, subText: ""},
        ]);
        onStatusUpdate("Preparing audio…");

        if (file.type === "audio/opus") {
            audioBlob = file;
            patch("audio_prep", { progress: 1, isActive: false, isComplete: true, isIndeterminate: false, label: "Audio ready (Opus)" });
        } else {
            // Requires conversion, ffmpegFromProp should be loaded due to check above
            patch("audio_prep", { label: "Converting to Opus audio...", isIndeterminate: false, progress: 0.1 });
            onStatusUpdate("Converting audio to Opus format in your browser...");
            try {
                const inputFileName = `input.${originalFileName.split('.').pop()?.toLowerCase() || 'audio'}`;
                const outputFileName = `output.opus`;

                await ffmpegFromProp!.writeFile(inputFileName, await fetchFile(file)); // Non-null assertion as it's checked
                patch("audio_prep", { progress: 0.3, subText: "File loaded into FFmpeg..." });

                const conversionArgs = ['-i', inputFileName, '-y', '-vn', '-acodec', 'libopus', '-b:a', '64k', '-ar', '16000', '-ac', '1', outputFileName];
                console.log(`[ClientProc] Running FFmpeg for audio conversion: ffmpeg ${conversionArgs.join(' ')}`);
                
                let lastReportedProgress = 0.3;
                ffmpegFromProp!.on("progress", (pEvent) => { // Non-null assertion
                    if ('progress' in pEvent && pEvent.progress > 0 && pEvent.progress < 1) {
                         const currentProgress = 0.3 + (pEvent.progress * 0.6);
                         if (currentProgress > lastReportedProgress) { // Only update if progress increases
                            patch("audio_prep", { progress: currentProgress });
                            lastReportedProgress = currentProgress;
                         }
                    }
                });

                await ffmpegFromProp!.exec(conversionArgs); // Non-null assertion
                patch("audio_prep", { progress: 0.9, subText: "Conversion complete, reading file..." });

                const data = await ffmpegFromProp!.readFile(outputFileName); // Non-null assertion
                audioBlob = new Blob([data], { type: "audio/opus" });

                if (ffmpegFromProp!.FS && typeof ffmpegFromProp!.FS === 'function') { // Non-null assertion
                    try {
                        ffmpegFromProp!.FS('unlink', inputFileName); // Non-null assertion
                        ffmpegFromProp!.FS('unlink', outputFileName); // Non-null assertion
                    } catch (fsErr) { console.warn("FFmpeg FS unlink error:", fsErr); }
                }
                patch("audio_prep", { progress: 1, isActive: false, isComplete: true, isIndeterminate: false, label: "Audio converted to Opus" });
                ffmpegFromProp!.on("progress", () => {}); // Clear progress handler

            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                onError(`FFmpeg audio conversion failed: ${msg}`, originalFileName, originalFileSizeMB);
                if (ffmpegFromProp && typeof ffmpegFromProp.on === 'function') ffmpegFromProp.on("progress", () => {}); // Ensure progress handler is cleared on error too
                setBusy(false);
                return;
            }
        }
      } else { // It's a video file, proceed with FFmpeg audio extraction
        // ffmpegFromProp must be loaded and ready here due to the check at the start of the function.
        console.log("[ClientProc] Extracting audio from video file:", originalFileName);
        onStagesUpdate([
          { name: "audio_extract", label: "Extracting audio from video", progress: 0, isActive: true, isComplete: false, isIndeterminate: false, subText: "Using FFmpeg in browser..." },
          { name: "groq", label: "AI Transcribing…", progress: 0, isActive: false, isComplete: false, isIndeterminate: false, subText: ""},
        ]);
        onStatusUpdate("Extracting audio from video…");
        try {
          audioBlob = await extractAudio({
            ffmpeg: ffmpegFromProp!, // Pass the hook's ffmpeg instance (non-null asserted)
            file,
            outputFormat: "opus",
            onProgress: (p) => patch("audio_extract", { progress: p }),
             onLog: (logMessage) => { // This onLog is crucial
                console.log("ClientHook_FFmpegLog:", logMessage);
            },
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          onError(msg, originalFileName, originalFileSizeMB);
          setBusy(false);
          return;
        }
        patch("audio_extract", { progress: 1, isActive: false, isComplete: true });
      }

      // --- Common part: Groq Transcription ---
      onStepChange?.("transcribe");
      const modelName = mode === "turbo" ? "Whisper Large v3" : "Distil-Whisper Large-v3-en";
      onStatusUpdate("AI is transcribing your audio…");
      patch("groq", { isActive: true, isIndeterminate: true, subText: `Processing using Groq's ${modelName} model` });

      const formData = new FormData();
      const blobFileName = audioBlob.type === "audio/opus" ? "audio.opus" : originalFileName;
      formData.append("audioBlob", audioBlob, blobFileName);

      console.log(`[ClientProc] Sending audio to transcribeAudioAction. Type: ${audioBlob.type}, Name: ${blobFileName}`);
      const res = await transcribeAudioAction(formData, mode);

      if (!res.success || !res.data) {
        patch("groq", { isActive: false, isIndeterminate: false });
        onError(res.error ?? "Transcription failed", blobFileName, (audioBlob.size / (1024*1024)).toFixed(2) );
        setBusy(false);
        return;
      }

      patch("groq", { isIndeterminate: false, progress: 1, isActive: false, isComplete: true, subText: `Processed with Groq's ${modelName} model` });
      onProcessingComplete(res.data);
      setBusy(false);
    },
    [ffmpegFromProp, onError, onProcessingComplete, onStatusUpdate, onStagesUpdate, patch, onStepChange] // Added ffmpegFromProp to dependency array
  );

  return { processFile, isProcessing: busy };
}