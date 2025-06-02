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
  // Add a prop for completed steps if you want to show checkmarks
  // completedSteps?: string[];
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStepId,
}) => {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <nav aria-label="Progress" className="mb-8 px-4 sm:px-0">
      {" "}
      {/* Added padding for outer edges */}
      <ol role="list" className="relative flex items-start justify-between">
        {" "}
        {/* Changed to justify-between */}
        {/* Background line for all steps */}
        <div
          className="absolute top-3.5 left-4 right-4 h-0.5 bg-gray-200"
          aria-hidden="true"
        />
        {steps.map((step, stepIdx) => (
          <li
            key={step.name}
            className="relative flex flex-col items-center w-1/3"
          >
            {" "}
            {/* Each step takes ~1/3 for 3 steps */}
            {/* Foreground line for completed/current steps */}
            {stepIdx < currentStepIndex && ( // Fully completed step line
              <div
                className="absolute top-3.5 left-0 w-full h-0.5 bg-orange-500"
                aria-hidden="true"
              />
            )}
            {stepIdx === currentStepIndex &&
              stepIdx > 0 && ( // Line leading to current step (if not first)
                <div
                  className="absolute top-3.5 right-1/2 w-1/2 h-0.5 bg-orange-500"
                  aria-hidden="true"
                />
              )}
            {stepIdx === currentStepIndex &&
              stepIdx < steps.length - 1 && ( // Line partially from current step (if not last)
                <div
                  className="absolute top-3.5 left-1/2 w-1/2 h-0.5 bg-orange-500 opacity-50"
                  aria-hidden="true"
                /> // Example: current step's outgoing line is lighter/shorter
              )}
            <div
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full font-medium
                          ${
                            stepIdx < currentStepIndex
                              ? "bg-orange-500 text-white"
                              : ""
                          }
                          ${
                            stepIdx === currentStepIndex
                              ? "ring-2 ring-offset-2 ring-orange-500 bg-white text-orange-600 scale-110"
                              : ""
                          }
                          ${
                            stepIdx > currentStepIndex
                              ? "bg-gray-300 text-gray-500"
                              : ""
                          }
                        `}
            >
              <step.icon className="h-5 w-5" />
            </div>
            <p
              className={`text-xs text-center mt-2 font-medium w-20 truncate ${
                stepIdx <= currentStepIndex
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
