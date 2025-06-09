// app/components/DarkModeToggle.tsx
"use client";

import {MoonStar, Sun} from "lucide-react";
import StyledButton from "./StyledButton";
import {useTheme} from "../contexts/ThemeContext";

export default function DarkModeToggle() {
  const {dark, toggle} = useTheme();
  return (
    <StyledButton
      size="icon"
      variant="ghost"
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="fixed right-4 top-4 sm:right-6 sm:top-6 z-50 shadow-md bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-full"
    >
      {dark ? <Sun size={18} /> : <MoonStar size={18} />}
    </StyledButton>
  );
}
