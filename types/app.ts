// types/app.ts
import type {ElementType} from "react";
import {Settings, Waves, FileText} from "lucide-react";
import {TranscriptionMode} from "@/components/ConfirmationView";
import {AIInteractionTaskType} from "@/actions/interactWithTranscriptAction";
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
  {id: "configure", name: "Configure", icon: Settings},
  {id: "process", name: "Process Audio", icon: Waves},
  {id: "transcribe", name: "Get Transcripts", icon: FileText},
];

// Record to map the internal `TranscriptionMode` type to the model display name.
export const TRANSCRIPTION_MODEL_DISPLAY_NAMES: Record<
  TranscriptionMode,
  string
> = {
  core: "Whisper Large v3",
  turbo: "Whisper Large v3 (Turbo)", // Or whatever you want the turbo display name to be
};

export const TRANSCRIPTION_MODELS: Record<TranscriptionMode, string> = {
  core: process.env.GROQ_TRANSCRIPTION_MODEL_CORE || "whisper-large-v3",
  turbo: process.env.GROQ_TRANSCRIPTION_MODEL_TURBO || "whisper-large-v3-turbo",
};

export const parseListItems = (text: string): string[] => {
  if (!text) return [];
  // This regex now tries to anchor to the start and looks for markdown list syntax specifically
  const listRegex = /^\s*(?:\*|-|\d+\.)\s+(.*)/gm;
  const matches = [...text.matchAll(listRegex)];
  if (matches.length > 0) {
    return matches.map((match) => match[1].trim());
  }
  // Fallback for non-markdown lists, but less likely to be hit by our prompts
  return text
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("Speaker "));
};

export const LIST_TASK_TYPES = new Set<AIInteractionTaskType>([
  "extract_key_points",
  "extract_action_items",
  "identify_topics",
]);
export interface AiResultItem {
  id: string;
  taskType: AIInteractionTaskType;
  text: string;
  wasTruncated: boolean;
  error?: string;
  isStreaming?: boolean;
}
