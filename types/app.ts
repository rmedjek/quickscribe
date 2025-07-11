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

export interface StageDisplayData {
  name: string;
  label: string;
  progress: number;
  isActive?: boolean;
  isComplete?: boolean;
  isIndeterminate?: boolean;
  subText?: string;
}

// Record to map the internal `TranscriptionMode` type to the model display name.
export const TRANSCRIPTION_MODEL_DISPLAY_NAMES: Record<
  TranscriptionMode,
  string
> = {
  core: "Whisper Large v3",
  turbo: "Whisper Large v3 (Turbo)", // Or whatever you want the turbo display name to be
};

export const parseListItems = (text: string): string[] => {
  if (!text) return [];
  const potentialItems = text
    .split("\n")
    .filter((line) => /^\s*(\*|-|\d+\.)\s+/.test(line));
  if (potentialItems.length > 0) {
    return potentialItems.map((line) =>
      line.replace(/^\s*(\*|-|\d+\.)\s+/, "").trim()
    );
  }
  return text.split("\n").filter((line) => line.trim() !== "");
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

// Accepted MIME types for file uploads
export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "video/x-flv",
];

export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a
  "audio/aac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
  "audio/webm",
];

// A combined string for use in the <input type="file" accept="..."> attribute
export const ALL_ACCEPTED_MIME_TYPES_STRING = [
  ...ACCEPTED_VIDEO_TYPES,
  ...ACCEPTED_AUDIO_TYPES,
  "video/*", // Generic fallbacks
  "audio/*",
].join(",");
