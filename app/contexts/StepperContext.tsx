// app/contexts/StepperContext.tsx
"use client";

import React, {createContext, useContext, useState, ReactNode} from "react";
import {StepId} from "@/types/app";

const StepperContext = createContext<
  {step: StepId; setStep: (s: StepId) => void} | undefined
>(undefined);

export function StepperProvider({children}: {children: ReactNode}) {
  const [step, setStep] = useState<StepId>("configure");
  return (
    <StepperContext.Provider value={{step, setStep}}>
      {children}
    </StepperContext.Provider>
  );
}

export function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error("useStepper must be used within <StepperProvider>");
  return ctx;
}
