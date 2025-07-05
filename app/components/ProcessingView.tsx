// app/components/ProcessingView.tsx
"use client";

import React from "react";
import ProgressStepper from "./ProgressStepper";
import {AppStep, StepId, type StageDisplayData} from "@/types/app";
import QuickScribeLogo from "./icons/QuickScribeLogo";

interface Props {
  stage: StageDisplayData | null;
  currentOverallStatusMessage: string;
  appSteps: AppStep[];
  currentAppStepId: StepId;
}

export default function ProcessingView({
  stage,
  currentOverallStatusMessage,
  appSteps,
  currentAppStepId,
}: Props) {
  return (
    <div className="bg-[var(--card-bg)] p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-[var(--text-primary)]">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold">QuickScribe</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Powered by Groq
        </p>
      </div>
      <ProgressStepper steps={appSteps} currentStepId={currentAppStepId} />
      <p className="text-lg font-semibold text-center mt-8 mb-2">
        {currentOverallStatusMessage}
      </p>
      <div className="flex justify-center my-4 h-12">
        <QuickScribeLogo color="#f97316" />
      </div>
      {stage && <StageRow stage={stage} />}
      <p className="text-xs text-[var(--text-secondary)] mt-8 text-center">
        Please keep this tab open while we work.
      </p>
    </div>
  );
}

function StageRow({stage}: {stage: StageDisplayData}) {
  const width = stage.isComplete
    ? "100%"
    : `${Math.max(0, Math.min(100, Math.round((stage.progress || 0) * 100)))}%`;

  // --- THIS IS THE FIX for the progress bar animation ---
  const barClass = stage.isComplete
    ? "bg-green-500"
    : stage.isIndeterminate
    ? "bg-gradient-to-r from-transparent via-orange-500 to-transparent bg-[length:200%_100%] animate-shimmer"
    : "bg-orange-500"; // Determinate bar is a solid orange

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-sm font-medium">
        <span className="text-[var(--text-secondary)]">{stage.label}</span>
        {stage.subText && (
          <div className="flex items-center justify-between mb-1.5 text-sm font-medium">
            <span className="text-[var(--text-secondary)]">{stage.label}</span>
          </div>
        )}
      </div>
      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        {/* We now use a single div and apply the correct animation class */}
        <div
          className={`h-full rounded-full ${barClass} transition-all duration-300 ease-out`}
          style={{width: stage.isIndeterminate ? "100%" : width}}
        />
      </div>
    </div>
  );
}
