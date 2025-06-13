// types/app.ts
import type { ElementType } from "react";
import { Settings, Waves, FileText } from "lucide-react";
import { TranscriptionMode } from "@/components/ConfirmationView";
// ---------------------------------------------------------------------
//  Common, shareable application‑level types.
// ---------------------------------------------------------------------

export type SelectedInputType = "video" | "audio" | "link";

// ---------------------------------------------------------------------------
// App‑wide stepper types
export type StepId = "configure" | "process" | "transcribe";

export interface AppStep {
  id: StepId;
  name: string;
  icon: ElementType;
}

export const APP_STEPS: AppStep[] = [
  { id: "configure", name: "Configure", icon: Settings },
  { id: "process", name: "Process Audio", icon: Waves },
  { id: "transcribe", name: "Get Transcripts", icon: FileText },
];

// Record to map the internal `TranscriptionMode` type to the model display name.
export const TRANSCRIPTION_MODEL_DISPLAY_NAMES: Record<TranscriptionMode, string> = {
  core: "Whisper Large v3",
  turbo: "Whisper Large v3 (Turbo)", // Or whatever you want the turbo display name to be
};

export const TRANSCRIPTION_MODELS: Record<TranscriptionMode, string> = {
  core: process.env.GROQ_TRANSCRIPTION_MODEL_CORE || 'whisper-large-v3',
  turbo: process.env.GROQ_TRANSCRIPTION_MODEL_TURBO || 'whisper-large-v3-turbo',
};