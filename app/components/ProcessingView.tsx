// app/components/ProcessingView.tsx
"use client";

import React, {useEffect, useState} from "react";
import {CheckCircle} from "lucide-react"; // Removed unused icons
import ProgressStepper, {Step} from "./ProgressStepper"; // Assuming Step type is exported

export interface StageDisplayData {
  name: string;
  label: string;
  progress: number; // 0-1 for this stage
  isIndeterminate?: boolean;
  isComplete?: boolean;
  isActive?: boolean;
  subText?: string; // For messages like "Let me cook" or "Processing with Groq..."
}

interface ProcessingViewProps {
  stages: StageDisplayData[];
  currentOverallStatusMessage: string;
  appSteps: Step[];
  currentAppStepId: string;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({
  stages,
  currentOverallStatusMessage,
  appSteps,
  currentAppStepId,
}) => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(
      () => setDots((prev) => (prev.length >= 3 ? "" : prev + ".")),
      500
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>

      <ProgressStepper steps={appSteps} currentStepId={currentAppStepId} />

      <div className="text-center mt-8 mb-4">
        <p className="text-lg font-semibold text-slate-700">
          {currentOverallStatusMessage}
          {stages.some((s) => s.isActive && s.isIndeterminate && !s.isComplete)
            ? dots
            : ""}
        </p>
      </div>

      <div className="space-y-5 mt-6">
        {" "}
        {/* Increased space between stage bars */}
        {stages.map((stage) => {
          const progressPercent = Math.min(
            100,
            Math.max(0, stage.progress * 100)
          );
          return (
            <div key={stage.name}>
              <div className="flex justify-between items-center mb-1.5">
                {" "}
                {/* Increased bottom margin */}
                <p
                  className={`text-sm font-medium flex items-center
                                ${stage.isComplete ? "text-green-600" : ""}
                                ${
                                  stage.isActive && !stage.isComplete
                                    ? "text-orange-600"
                                    : ""
                                }
                                ${
                                  !stage.isActive && !stage.isComplete
                                    ? "text-slate-500"
                                    : ""
                                }
                              `}
                >
                  {stage.isComplete && (
                    <CheckCircle size={16} className="inline mr-2 mb-0.5" />
                  )}
                  {stage.label} {/* Label no longer includes percentage */}
                  {stage.isActive &&
                    stage.isIndeterminate &&
                    !stage.isComplete &&
                    dots}
                </p>
                {/* Optionally show percentage next to label ONLY if determinate and active */}
                {stage.isActive &&
                  !stage.isIndeterminate &&
                  !stage.isComplete && (
                    <span className="text-xs text-orange-600 font-medium">
                      {Math.round(progressPercent)}%
                    </span>
                  )}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden relative">
                <div
                  className={`
                  h-2.5 rounded-full
                  ${stage.isComplete ? "bg-green-500" : ""}
                  ${
                    stage.isActive && !stage.isComplete && stage.isIndeterminate
                      ? "bg-orange-500 animate-pulse"
                      : ""
                  }
                  ${
                    stage.isActive &&
                    !stage.isComplete &&
                    !stage.isIndeterminate
                      ? "bg-orange-500 transition-width duration-200 ease-linear"
                      : ""
                  }
                  ${!stage.isActive && !stage.isComplete ? "bg-slate-200" : ""} 
                `}
                  style={{
                    width: `${
                      stage.isComplete ||
                      (stage.isActive && stage.isIndeterminate)
                        ? "100%" // Full width if complete or active & indeterminate
                        : (stage.isActive
                            ? Math.min(100, Math.max(0, stage.progress * 100))
                            : 0) + "%" // Fill based on progress if active & determinate
                    }`,
                  }}
                />
              </div>
              {stage.subText && stage.isActive && !stage.isComplete && (
                <p className="text-xs text-slate-400 mt-1.5 text-center">
                  {stage.subText}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 mt-8 text-center">
        This might take a few moments... Please keep this tab open.
      </p>
    </div>
  );
};

export default ProcessingView;
