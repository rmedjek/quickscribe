// app/components/ProcessingView.tsx
"use client";

import React from "react";
import {CheckCircle} from "lucide-react";
import ProgressStepper, {Step} from "./ProgressStepper";

export interface StageDisplayData {
  name: string;
  label: string;
  progress: number; // 0-1
  isIndeterminate?: boolean;
  isComplete?: boolean;
  isActive?: boolean;
  subText?: string;
}

interface Props {
  stages: StageDisplayData[];
  currentOverallStatusMessage: string;
  appSteps: Step[];
  currentAppStepId: string;
}

export default function ProcessingView({
  stages,
  currentOverallStatusMessage,
  appSteps,
  currentAppStepId,
}: Props) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700">
      {/* -------------------------------------------------- header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>

      <ProgressStepper
        steps={appSteps}
        currentStepId={currentAppStepId ?? "configure"}
      />

      <p className="text-lg font-semibold text-center mt-8 mb-6">
        {currentOverallStatusMessage}
      </p>

      {/* -------------------------------------------------- stage list */}
      <div className="space-y-5">
        {stages.map((stage) => (
          <StageRow key={stage.name} stage={stage} />
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-8 text-center">
        Please keep this tab open while we work.
      </p>
    </div>
  );
}

/* =================================================================== */
/* sub-component for a single stage                                    */

function StageRow({stage}: {stage: StageDisplayData}) {
  /* determinate width (will be ignored for indeterminate) */
  const width =
    stage.isComplete || stage.isIndeterminate
      ? "100%"
      : `${Math.round(stage.progress * 100)}%`;

  /* choose bar class */
  const barClass = stage.isComplete
    ? "bg-gray-400"
    : stage.isIndeterminate
    ? "bg-orange-500 barberpole-stripes"
    : "bg-orange-500";

  return (
    <div>
      {/* ---- label row ---- */}
      <div className="flex items-center mb-1.5 text-sm font-medium">
        {stage.isComplete && (
          <CheckCircle size={16} className="inline mr-2 mb-0.5 text-gray-500" />
        )}
        <span
          className={
            stage.isComplete
              ? "text-gray-600"
              : stage.isActive
              ? "text-orange-600"
              : "text-slate-500"
          }
        >
          {stage.label}
        </span>
      </div>

      {/* ---- progress bar ---- */}
      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`${barClass} h-full transition-[width] duration-500 ease-linear`}
          style={{width}}
        />
      </div>

      {/* ---- optional subtext ---- */}
      {stage.subText && stage.isActive && !stage.isComplete && (
        <p className="text-xs text-slate-400 text-center mt-1.5">
          {stage.subText}
        </p>
      )}
    </div>
  );
}
