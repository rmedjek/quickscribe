// app/components/ProgressStepper.tsx
"use client";
import React from "react";
import {AppStep, StepId} from "@/types/app";
import {useStepper} from "../contexts/StepperContext";

interface ProgressStepperProps {
  steps: AppStep[];
  /**
   * Optional – if omitted the component pulls the current step from context.
   */
  currentStepId?: StepId;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStepId,
}) => {
  const {step: ctxStep} = useStepper();
  const activeId = currentStepId ?? ctxStep;
  const currentIdx = steps.findIndex((s) => s.id === activeId);

  return (
    <nav aria-label="Progress" className="mb-8 px-4 sm:px-0">
      <ol role="list" className="relative flex items-start justify-between">
        <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-gray-200" />
        {steps.map((step, idx) => (
          <li
            key={step.id}
            className="relative flex flex-col items-center w-1/3"
          >
            {idx < currentIdx && (
              <div className="absolute top-3.5 left-0 w-full h-0.5 bg-gray-400" />
            )}
            {idx === currentIdx && idx > 0 && (
              <div className="absolute top-3.5 right-1/2 w-1/2 h-0.5 bg-orange-500" />
            )}
            {idx === currentIdx && idx < steps.length - 1 && (
              <div className="absolute top-3.5 left-1/2 w-1/2 h-0.5 bg-orange-500 opacity-50" />
            )}

            <div
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                idx < currentIdx
                  ? "bg-gray-400 text-white"
                  : idx === currentIdx
                  ? "ring-2 ring-offset-2 ring-orange-500 bg-white text-orange-600 scale-110"
                  : "bg-gray-300 text-gray-500"
              }`}
            >
              <step.icon className="h-5 w-5" />
            </div>

            <p
              className={`text-xs mt-2 w-20 truncate text-center font-medium ${
                idx < currentIdx
                  ? "text-gray-500"
                  : idx === currentIdx
                  ? "text-orange-600"
                  : "text-gray-500"
              }`}
            >
              {step.name}
            </p>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default ProgressStepper;
