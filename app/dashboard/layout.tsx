// File: app/dashboard/layout.tsx

// REMOVED "use client"
// A layout must be a Server Component to correctly wrap child Server Components.

import React from "react";
import {StepperProvider} from "../contexts/StepperContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This Server Component Layout renders the StepperProvider (a Client Component)
  // which then wraps all the child pages. This is the correct pattern.
  return <StepperProvider>{children}</StepperProvider>;
}
