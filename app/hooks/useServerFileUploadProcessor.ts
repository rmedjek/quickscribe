// app/hooks/useServerFileUploadProcessor.ts
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { processLargeVideoFileAction } from "@/actions/processLargeVideoFileAction";
import { TranscriptionMode } from "@/components/ConfirmationView";
import { StageDisplayData } from "@/components/ProcessingView";
import { DetailedTranscriptionResult } from "@/actions/transcribeAudioAction";

const TICK_MS               = 200;  // update every 0.2 s
const MAX_STAGE0_MS         = 45_000; // hard-cap “upload+extract” at 45 s
const MAX_STAGE1_MS         = 30_000; // hard-cap “Groq” at 30 s
const STAGE0_NAME           = "ServerFileExtract";
const STAGE1_NAME           = "ServerFileTranscription";

interface Opts {
  onProcessingComplete: (d: DetailedTranscriptionResult) => void;
  onError: (msg: string, fName?: string, fSizeMB?: string) => void;
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
}: Opts) {
  const [busy, setBusy] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /* ─ helpers ──────────────────────────────────────────────────────── */
  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const stageTemplate = useMemo<StageDisplayData[]>(() => [
    {
      name: STAGE0_NAME,
      label: "Uploading & Processing Audio",
      progress: 0,
      isActive: true,
      isComplete: false,
      isIndeterminate: false,
      subText: "Sending to server…",
    },
    {
      name: STAGE1_NAME,
      label: "Generating Transcript",
      progress: 0,
      isActive: false,
      isComplete: false,
      isIndeterminate: false,
      subText: "AI is transcribing…",
    },
  ], []);

  /* ─ main entry point ─────────────────────────────────────────────── */
  const processFile = useCallback(
    async (file: File, mode: TranscriptionMode) => {
      setBusy(true);
      onStatusUpdate("Uploading & extracting…");
      let stages = stageTemplate;
      onStagesUpdate([...stages]);

      /* 1. kick off server promise immediately (no await yet) */
      const fd = new FormData();
      fd.append("videoFile", file);
      const serverPromise = processLargeVideoFileAction(fd, mode);

      /* 2. animate Stage 0 until either A) timer hits MAX_STAGE0_MS
             or B) serverPromise resolves earlier (meaning FFmpeg+Groq done)         */
      let elapsed = 0;
      intervalRef.current = setInterval(() => {
        elapsed += TICK_MS;
        const pct = Math.min(0.98, elapsed / MAX_STAGE0_MS);
        stages = stages.map((s) =>
          s.name === STAGE0_NAME ? { ...s, progress: pct } : s
        );
        onStagesUpdate([...stages]);
      }, TICK_MS);

      let resp;
      try {
        resp = await serverPromise;          // wait for FFmpeg *plus* Groq
      } catch (err) {
        clear();
        const msg = err instanceof Error ? err.message : String(err);
        onError(msg, file.name, (file.size / 1_048_576).toFixed(2));
        setBusy(false);
        return;
      }

      /* serverPromise finished ─ could be before or after MAX_STAGE0_MS */
      clear();

      /* If Stage 0 isn’t 100 % yet, push it to 100 % and start Stage 1 */
      stages = stages.map((s) =>
        s.name === STAGE0_NAME
          ? { ...s, progress: 1, isActive: false, isComplete: true }
          : s
      );
      stages = stages.map((s) =>
        s.name === STAGE1_NAME ? { ...s, isActive: true } : s
      );
      onStagesUpdate([...stages]);
      onStatusUpdate("Transcribing…");

      /* 3. animate Stage 1 for up to MAX_STAGE1_MS or until results shown */
      elapsed = 0;
      intervalRef.current = setInterval(() => {
        elapsed += TICK_MS;
        const pct = Math.min(0.95, elapsed / MAX_STAGE1_MS);
        stages = stages.map((s) =>
          s.name === STAGE1_NAME ? { ...s, progress: pct } : s
        );
        onStagesUpdate([...stages]);
      }, TICK_MS);

      /* 4. we already HAVE Groq result (because serverPromise contained it) 
             so end Stage 1 immediately, then clear interval & finish.        */
      clear();
      stages = stages.map((s) =>
        s.name === STAGE1_NAME
          ? { ...s, progress: 1, isActive: false, isComplete: true }
          : s
      );
      onStagesUpdate([...stages]);

      if (!resp.success || !resp.data) {
        onError(resp.error ?? "Unknown server error");
        setBusy(false);
        return;
      }

      onStatusUpdate("Done!");
      onProcessingComplete(resp.data);
      setBusy(false);
    },
    [onProcessingComplete, onError, onStatusUpdate, onStagesUpdate, stageTemplate, clear]
  );

  return { processFile, isProcessing: busy };
}