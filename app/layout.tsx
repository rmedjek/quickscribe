// app/layout.tsx
import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "../styles/global.css";
// No need to import PageLayout here directly if page.tsx handles it,
// unless PageLayout contains elements that *must* be in the root layout (like <html>, <body> tags providers)
// For now, let's assume individual pages will use PageLayout for their main content area.

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "QuickScribe - Video Transcription",
  description: "Effortless transcripts for your videos.",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
