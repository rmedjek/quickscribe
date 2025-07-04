// app/layout.tsx
import {Inter} from "next/font/google";
import "../styles/global.css";
import {ThemeProvider} from "./contexts/ThemeContext";
import SessionProvider from "./components/SessionProvider";
import {auth} from "@/lib/auth";
import HistorySidebar from "@/components/HistorySidebar";
import prisma from "@/lib/prisma";
import UserNav from "@/components/UserNav";
// REMOVED: No longer importing DarkModeToggle here
// import DarkModeToggle from "@/components/DarkModeToggle";

const inter = Inter({subsets: ["latin"]});

export const metadata = {
  title: "QuickScribe",
  description: "Audio & Video Transcription",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const jobs = session?.user?.id
    ? await prisma.transcriptionJob.findMany({
        where: {userId: session.user.id},
        orderBy: {createdAt: "desc"},
      })
    : [];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased bg-slate-50 dark:bg-slate-900`}
      >
        <SessionProvider session={session}>
          <ThemeProvider>
            {session?.user ? (
              <div className="flex h-screen w-full overflow-hidden">
                <HistorySidebar jobs={jobs} />
                <div className="flex-1 flex flex-col h-screen">
                  {/* --- THIS IS THE FIX: The header is now simpler --- */}
                  <header className="flex h-16 items-center justify-end gap-4 border-b border-[var(--border-color)] bg-[var(--header-bg)] px-6 flex-shrink-0 z-10 drop-shadow-md">
                    <UserNav />
                  </header>
                  {/* --- END FIX --- */}
                  <main className="flex-1 overflow-y-auto">{children}</main>
                </div>
              </div>
            ) : (
              <div className="w-full h-screen">{children}</div>
            )}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
