// app/layout.tsx
import {Inter} from "next/font/google";
import "../styles/global.css"; // The global CSS import belongs HERE.
import {ThemeProvider} from "./contexts/ThemeContext";
import SessionProvider from "./components/SessionProvider";
import {auth} from "@/lib/auth";
import HistorySidebar from "@/components/HistorySidebar";
import {PrismaClient} from "@prisma/client";

const inter = Inter({subsets: ["latin"]});
const prisma = new PrismaClient();

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
      <body className={`${inter.className} antialiased`}>
        <SessionProvider session={session}>
          <ThemeProvider>
            <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
              {session?.user ? (
                <>
                  <HistorySidebar jobs={jobs} />
                  <main className="flex-1 flex flex-col h-screen">
                    {children}
                  </main>
                </>
              ) : (
                <main className="w-full h-full">{children}</main>
              )}
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
