// app/layout.tsx
import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "../styles/global.css";
import DarkModeToggle from "@/components/DarkModeToggle";
import {ThemeProvider} from "./contexts/ThemeContext";

// These imports will now work correctly
import SessionProvider from "./components/SessionProvider";
import AuthButtons from "./components/AuthButtons";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "QuickScribe – Video Transcription",
  description: "Effortless transcripts for your videos.",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* The `inter.className` is now correctly used here */}
      <body
        className={`${inter.className} antialiased bg-slate-100 dark:bg-slate-900 dark:text-slate-100 transition-colors`}
      >
        <SessionProvider>
          <ThemeProvider>
            <header className="absolute top-4 right-4 z-50">
              <div className="flex items-center gap-4">
                <AuthButtons />
                <DarkModeToggle />
              </div>
            </header>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
