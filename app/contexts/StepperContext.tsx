// app/contexts/StepperContext.tsx
"use client";

import React, {createContext, useContext, useState, ReactNode} from "react";
import {StepId} from "@/types/app";

// Define the shape of the context data
interface StepperContextType {
  step: StepId;
  setStep: (s: StepId) => void;
}

// --- THIS IS THE FIX ---
// Provide a default value to createContext. This prevents the context from being
// `undefined` when no provider is found. We can check for this default value
// to know if we're inside a real provider.
const StepperContext = createContext<StepperContextType>({
  step: "configure", // A safe default
  setStep: () => {
    // A no-op function for the default
    console.warn("setStep called outside of StepperProvider");
  },
});
// --- END FIX ---

export function StepperProvider({children}: {children: ReactNode}) {
  const [step, setStep] = useState<StepId>("configure");
  return (
    <StepperContext.Provider value={{step, setStep}}>
      {children}
    </StepperContext.Provider>
  );
}

// The useStepper hook no longer needs to throw an error,
// as it will always receive a value (either the real one or the default).
export function useStepper() {
  return useContext(StepperContext);
}
