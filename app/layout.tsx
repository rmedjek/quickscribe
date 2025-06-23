// app/layout.tsx
import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "../styles/global.css";
import DarkModeToggle from "@/components/DarkModeToggle";
import {ThemeProvider} from "./contexts/ThemeContext";
import SessionProvider from "./components/SessionProvider";
import {auth} from "@/lib/auth"; // We can get the session on the server
import UserNav from "@/components/UserNav"; // Import our new component

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "QuickScribe – Video Transcription",
  description: "Effortless transcripts for your videos.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We can fetch the session on the server to decide what to render
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased bg-slate-100 dark:bg-slate-900 dark:text-slate-100 transition-colors`}
      >
        <SessionProvider session={session}>
          <ThemeProvider>
            <header className="absolute top-4 right-4 z-50">
              <div className="flex items-center gap-4">
                {/* Conditionally render UserNav if the user is logged in */}
                {session?.user && <UserNav />}
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
