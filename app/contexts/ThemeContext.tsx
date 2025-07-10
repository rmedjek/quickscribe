// app/contexts/ThemeContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({children}: {children: ReactNode}) {
  // Initialize state based on the class already set on the <html> tag by ThemeScript
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  const toggle = () => {
    setDark((prevDark) => {
      const newDark = !prevDark;
      const newTheme = newDark ? "dark" : "light";

      // Update localStorage with the user's explicit choice
      localStorage.setItem("theme", newTheme);

      // Update the class on the <html> element
      const root = document.documentElement;
      if (newDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      return newDark;
    });
  };

  // This effect is now just for safety/syncing, but the core logic is in toggle()
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{dark, toggle}}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside <ThemeProvider>");
  return ctx;
}
