// app/components/ProcessingView.tsx
"use client";

import React from "react";
import {CheckCircle} from "lucide-react";
import ProgressStepper from "./ProgressStepper";
import {AppStep, StepId, type StageDisplayData} from "@/types/app";

// Props are simplified
interface Props {
  activeStage: StageDisplayData | null; // Can be null if only showing overall message
  currentOverallStatusMessage: string;
  appSteps: AppStep[];
  currentAppStepId: StepId;
}

export default function ProcessingView({
  activeStage,
  currentOverallStatusMessage,
  appSteps,
  currentAppStepId,
}: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700 dark:text-slate-200">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Powered by Groq
        </p>
      </div>

      <ProgressStepper steps={appSteps} currentStepId={currentAppStepId} />

      <p className="text-lg font-semibold text-center mt-8 mb-6 text-slate-800 dark:text-slate-100">
        {currentOverallStatusMessage}
      </p>

      {/* Render only if there's an active stage to display */}
      {activeStage && (
        <div className="space-y-1">
          {" "}
          {/* Reduced spacing as there's only one bar */}
          <StageRow stage={activeStage} />
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-8 text-center">
        Please keep this tab open while we work.
      </p>
    </div>
  );
}

// StageRow remains largely the same, but it's now used for a single active stage
function StageRow({stage}: {stage: StageDisplayData}) {
  const width =
    stage.isComplete || stage.isIndeterminate
      ? "100%"
      : `${Math.max(0, Math.min(100, Math.round(stage.progress * 100)))}%`; // Ensure progress is between 0-100

  const barClass = stage.isComplete
    ? "bg-gray-400 dark:bg-slate-600"
    : stage.isIndeterminate
    ? "bg-orange-500 barberpole-stripes"
    : "bg-sky-600";

  return (
    <div>
      <div className="flex items-center mb-1.5 text-sm font-medium">
        {stage.isComplete && (
          <CheckCircle
            size={16}
            className="inline mr-2 mb-0.5 text-gray-500 dark:text-slate-400"
          />
        )}
        <span
          className={
            stage.isComplete
              ? "text-gray-600 dark:text-slate-400"
              : stage.isActive
              ? "text-gray-600 dark:text-gray-400"
              : "text-slate-500 dark:text-slate-400"
          }
        >
          {stage.label}
        </span>
      </div>

      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`${barClass} h-full transition-[width] duration-300 ease-out`}
          style={{width}}
        />
      </div>

      {/* Show subText if provided and the stage is active & not complete */}
      {stage.subText && stage.isActive && !stage.isComplete && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1.5">
          {stage.subText}
        </p>
      )}
    </div>
  );
}
