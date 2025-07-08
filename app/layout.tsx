// app/layout.tsx
import {Inter} from "next/font/google";
import "../styles/global.css";
import {ThemeProvider} from "./contexts/ThemeContext";
import SessionProvider from "./components/SessionProvider";
import {auth} from "@/lib/auth";
import HistorySidebar from "@/components/HistorySidebar";
import prisma from "@/lib/prisma";
import UserNav from "@/components/UserNav";

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
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${inter.className} h-full bg-[var(--page-bg)] text-[var(--text-primary)]`}
      >
        <SessionProvider session={session}>
          <ThemeProvider>
            <div className="h-full w-full overflow-hidden">
              {session?.user ? (
                <div className="flex h-full w-full">
                  <HistorySidebar jobs={jobs} />
                  <div
                    id="main-content-scroll-container"
                    className="flex-1 overflow-y-auto"
                  >
                    <header
                      id="page-header"
                      className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-end bg-[var(--header-bg)] px-6"
                    >
                      <UserNav />
                    </header>
                    <main>{children}</main>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {children}
                </div>
              )}
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
