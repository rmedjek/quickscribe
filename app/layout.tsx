// app/layout.tsx
import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "../styles/global.css";
import DarkModeToggle from "@/components/DarkModeToggle";
import {ThemeProvider} from "./contexts/ThemeContext";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "QuickScribe – Video Transcription",
  description: "Effortless transcripts for your videos.",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased bg-slate-100 dark:bg-slate-900 dark:text-slate-100 transition-colors`}
      >
        <ThemeProvider>
          {children}
          <DarkModeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
