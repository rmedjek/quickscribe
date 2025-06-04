// app/components/ProgressStepper.tsx
"use client";
import React from "react";

export interface Step {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStepId: string;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStepId,
}) => {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <nav aria-label="Progress" className="mb-8 px-4 sm:px-0">
      <ol role="list" className="relative flex items-start justify-between">
        {/* neutral baseline */}
        <div
          className="absolute top-3.5 left-4 right-4 h-0.5 bg-gray-200"
          aria-hidden="true"
        />

        {steps.map((step, idx) => (
          <li
            key={step.id}
            className="relative flex flex-col items-center w-1/3"
          >
            {/* completed segment */}
            {idx < currentStepIndex && (
              <div className="absolute top-3.5 left-0 w-full h-0.5 bg-gray-400" />
            )}
            {/* orange leading line into current step */}
            {idx === currentStepIndex && idx > 0 && (
              <div className="absolute top-3.5 right-1/2 w-1/2 h-0.5 bg-orange-500" />
            )}
            {/* faint outgoing line from current step */}
            {idx === currentStepIndex && idx < steps.length - 1 && (
              <div className="absolute top-3.5 left-1/2 w-1/2 h-0.5 bg-orange-500 opacity-50" />
            )}

            {/* circle */}
            <div
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full
                ${
                  idx < currentStepIndex
                    ? "bg-gray-400 text-white" /* completed – grey */
                    : idx === currentStepIndex
                    ? "ring-2 ring-offset-2 ring-orange-500 bg-white text-orange-600 scale-110"
                    : "bg-gray-300 text-gray-500" /* upcoming – grey */
                }`}
            >
              <step.icon className="h-5 w-5" />
            </div>

            {/* label */}
            <p
              className={`text-xs text-center mt-2 font-medium w-20 truncate ${
                idx < currentStepIndex
                  ? "text-gray-500" /* completed */
                  : idx === currentStepIndex
                  ? "text-orange-600" /* active   */
                  : "text-gray-500" /* upcoming */
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
