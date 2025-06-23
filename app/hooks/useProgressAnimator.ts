// // app/hooks/useProgressAnimator.ts
// import { useRef, useEffect } from "react";
// import { StageDisplayData } from "@/components/ProcessingView";

// /**
//  * useProgressAnimator
//  *   animate(name, target, ms)    – tween once
//  *   cancel()                     – stop tween
//  *   The hook automatically cancels on:
//  *      • React unmount
//  *      • window 'beforeunload'  (tab close / refresh)
//  *      • document 'visibilitychange' → hidden
//  */
// export function useProgressAnimator(
//   setStages: (
//     s:
//       | StageDisplayData[]
//       | ((p: StageDisplayData[]) => StageDisplayData[])
//   ) => void
// ) {
//   const raf = useRef<number>(0);

//   const cancel = () => {
//     if (raf.current) cancelAnimationFrame(raf.current);
//     raf.current = 0;
//   };

//   const animate = (name: string, target = 1, duration = 800) => {
//     cancel();
//     let startValue = 0;
//     setStages((prev) => {
//       startValue = prev.find((s) => s.name === name)?.progress ?? 0;
//       return prev;
//     });
//     const delta = target - startValue;
//     const t0 = performance.now();

//     const tick = (now: number) => {
//       const t = Math.min(1, (now - t0) / duration);
//       const value = startValue + delta * t;
//       setStages((prev) =>
//         prev.map((s) =>
//           s.name === name && value > s.progress
//             ? { ...s, progress: value }
//             : s
//         )
//       );
//       if (t < 1) raf.current = requestAnimationFrame(tick);
//     };
//     raf.current = requestAnimationFrame(tick);
//   };

//   /* ---- global cleanup ---- */
//   useEffect(() => {
//     const handleUnload = () => cancel();
//     const handleHide   = () => document.hidden && cancel();

//     window.addEventListener("beforeunload", handleUnload);
//     document.addEventListener("visibilitychange", handleHide);
//     return () => {
//       cancel();                                // React unmount
//       window.removeEventListener("beforeunload", handleUnload);
//       document.removeEventListener("visibilitychange", handleHide);
//     };
//   }, []);

//   return { animate, cancel };
// }
