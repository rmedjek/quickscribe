// types/app.ts
import type { ElementType } from "react";
// ---------------------------------------------------------------------
//  Common, shareable application‑level types.
// ---------------------------------------------------------------------

/**
 * What kind of input the user has provided.
 * – "video"  = any recognised video container (mp4, mov, …)
 * – "audio"  = standalone audio file (mp3, wav, opus …)
 * – "link"   = URL that will be downloaded / processed server‑side
 */
export type SelectedInputType = "video" | "audio" | "link";

// ---------------------------------------------------------------------------
// App‑wide stepper types
export type StepId = "configure" | "process" | "transcribe";

export interface AppStep {
  id: StepId;
  name: string;
  icon: ElementType;
}