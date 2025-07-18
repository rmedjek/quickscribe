import {Inter} from "next/font/google";
import "../styles/global.css";
import {ThemeProvider} from "./contexts/ThemeContext";
import SessionProvider from "./components/SessionProvider";
import {auth} from "@/lib/auth";
import ThemeScript from "./components/ThemeScript";

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
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${inter.className} h-full bg-[var(--page-bg)] text-[var(--text-primary)]`}
      >
        <SessionProvider session={session}>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
