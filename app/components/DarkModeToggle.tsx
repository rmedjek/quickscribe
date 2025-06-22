// File: app/components/DarkModeToggle.tsx
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
      // CORRECTED: The conflicting positioning classes have been removed from here.
      // The positioning is now handled entirely by the header in app/layout.tsx.
      className="shadow-md bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-full"
    >
      {dark ? <Sun size={18} /> : <MoonStar size={18} />}
    </StyledButton>
  );
}
