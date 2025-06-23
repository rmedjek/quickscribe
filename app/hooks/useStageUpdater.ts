// // app/hooks/useStageUpdater.ts
// import { useCallback } from "react";
// import { StageDisplayData } from "@/components/ProcessingView";

// /**
//  * Simple helper: “patch this stage’s props”.
//  * No timers, no rAF, no lag.
//  */
// export function useStageUpdater(
//   setStages: (
//     s:
//       | StageDisplayData[]
//       | ((p: StageDisplayData[]) => StageDisplayData[])
//   ) => void
// ) {
//   return useCallback(
//     (name: string, partial: Partial<Omit<StageDisplayData, "name">>) =>
//       setStages((prev) =>
//         prev.map((s) => (s.name === name ? { ...s, ...partial } : s))
//       ),
//     [setStages]
//   );
// }
