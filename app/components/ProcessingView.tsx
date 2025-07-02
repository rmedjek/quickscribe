// app/components/ProcessingView.tsx
"use client";

import React from "react";
import {CheckCircle} from "lucide-react";
import ProgressStepper from "./ProgressStepper";
import {AppStep, StepId, type StageDisplayData} from "@/types/app";

interface Props {
  activeStage: StageDisplayData | null;
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
    // --- THIS IS THE FIX ---
    // Using our CSS variables for a consistent multi-toned dark theme.
    // Removed the explicit border class.
    <div className="bg-[var(--card-bg)] p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-[var(--text-primary)]">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold">QuickScribe</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Powered by Groq
        </p>
      </div>

      <ProgressStepper steps={appSteps} currentStepId={currentAppStepId} />

      <p className="text-lg font-semibold text-center mt-8 mb-6">
        {currentOverallStatusMessage}
      </p>

      {activeStage && (
        <div className="space-y-1">
          <StageRow stage={activeStage} />
        </div>
      )}

      <p className="text-xs text-[var(--text-secondary)] mt-8 text-center">
        Please keep this tab open while we work.
      </p>
    </div>
  );
}

function StageRow({stage}: {stage: StageDisplayData}) {
  const width =
    stage.isComplete || stage.isIndeterminate
      ? "100%"
      : `${Math.max(0, Math.min(100, Math.round(stage.progress * 100)))}%`;

  const barClass = stage.isComplete
    ? "bg-green-500" // A satisfying green for completed stages
    : stage.isIndeterminate
    ? "bg-orange-500 barberpole-stripes"
    : "bg-sky-600";

  return (
    <div>
      {/* --- THIS IS THE FIX --- */}
      {/* All text colors now correctly inherit or use the CSS variables. */}
      <div className="flex items-center justify-between mb-1.5 text-sm font-medium">
        <div className="flex items-center">
          {stage.isComplete && (
            <CheckCircle
              size={16}
              className="inline mr-2 mb-0.5 text-green-500"
            />
          )}
          <span
            className={
              stage.isActive
                ? "text-[var(--text-secondary)]"
                : "text-[var(--text-secondary)]"
            }
          >
            {stage.label}
          </span>
        </div>
        {/* The subText (percentage) is removed from here to prevent it showing up next to the label */}
      </div>

      <div className="w-full h-2.5 bg-[var(--card-secondary-bg)] rounded-full overflow-hidden">
        <div
          className={`${barClass} h-full transition-[width] duration-300 ease-out`}
          style={{width}}
        />
      </div>

      {/* --- THIS IS THE FIX --- */}
      {/* We now only show the subText if it's NOT a percentage, or we can remove it entirely */}
      {/* This implementation removes the percentage sign completely as requested. */}
      {stage.subText &&
        !stage.subText.includes("%") &&
        stage.isActive &&
        !stage.isComplete && (
          <p className="text-xs text-[var(--text-secondary)] text-center mt-1.5">
            {stage.subText}
          </p>
        )}
      {/* --- END FIX --- */}
    </div>
  );
}
