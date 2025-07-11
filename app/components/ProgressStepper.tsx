// app/components/ProgressStepper.tsx
"use client";
import React from "react";
import {AppStep, StepId} from "@/types/app";
import {useStepper} from "../contexts/StepperContext";
import clsx from "clsx";

interface ProgressStepperProps {
  steps: AppStep[];
  variant?: "in-progress" | "completed";
  currentStepId?: StepId;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  variant = "in-progress",
  currentStepId,
}) => {
  const {step: ctxStep} = useStepper();

  const isCompleted = variant === "completed";
  const activeId = currentStepId ?? ctxStep;
  const currentIdx = isCompleted
    ? -1
    : steps.findIndex((s) => s.id === activeId);

  return (
    <nav aria-label="Progress" className="mb-8 px-4 sm:px-0">
      <ol role="list" className="relative flex items-start justify-between">
        <div
          className={clsx(
            "absolute top-3.5 left-4 right-4 h-0.5",
            isCompleted
              ? "bg-gray-400 dark:bg-slate-600"
              : "bg-gray-200 dark:bg-slate-700"
          )}
          aria-hidden="true"
        />

        {steps.map((step, idx) => {
          if (isCompleted) {
            return (
              <li
                key={step.id}
                className="relative flex flex-col items-center w-1/3"
              >
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 dark:bg-slate-600 text-white">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="text-xs text-center mt-2 w-20 truncate text-gray-500 dark:text-slate-400 font-medium">
                  {step.name}
                </p>
              </li>
            );
          } else {
            // RENDER THE 'IN-PROGRESS' VARIANT
            const isCurrentStep = idx === currentIdx;
            const isPastStep = idx < currentIdx;

            return (
              <li
                key={step.id}
                className="relative flex flex-col items-center w-1/3"
              >
                {/* Active progress line segments */}
                {isPastStep && (
                  <div className="absolute top-3.5 left-0 w-full h-0.5 bg-gray-400 dark:bg-slate-500" />
                )}
                {isCurrentStep && idx > 0 && (
                  <div className="absolute top-3.5 right-1/2 w-1/2 h-0.5 bg-orange-500" />
                )}

                {/* Icon Circle */}
                <div
                  className={clsx(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                    {
                      "ring-2 ring-offset-2 ring-orange-500 bg-white text-orange-600 scale-110":
                        isCurrentStep,
                      "bg-gray-400 dark:bg-slate-500 text-white": isPastStep,
                      "bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-slate-400":
                        !isCurrentStep && !isPastStep,
                    }
                  )}
                >
                  <step.icon className="h-5 w-5" />
                </div>

                {/* Step Name Text */}
                <p
                  className={clsx(
                    "text-xs mt-2 w-20 truncate text-center font-medium",
                    {
                      "text-orange-600 dark:text-orange-400": isCurrentStep,
                      "text-slate-600 dark:text-slate-300": isPastStep,
                      "text-gray-500 dark:text-slate-500":
                        !isCurrentStep && !isPastStep,
                    }
                  )}
                >
                  {step.name}
                </p>
              </li>
            );
          }
          // --- END FIX ---
        })}
      </ol>
    </nav>
  );
};

export default ProgressStepper;
