// File: app/components/AuthButtons.tsx
"use client";

import {signIn, signOut, useSession} from "next-auth/react";
import StyledButton from "./StyledButton";
import {LogIn, LogOut} from "lucide-react";
import Image from "next/image"; // Import the next/image component

export default function AuthButtons() {
  const {data: session, status} = useSession();

  if (status === "loading") {
    return (
      <div className="w-24 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        {session.user?.image && (
          // CORRECTED: Replaced <img> with next/image <Image />
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={40} // Required property for layout stability
            height={40} // Required property for layout stability
            className="rounded-full" // Tailwind classes still work for styling
          />
        )}
        <StyledButton onClick={() => signOut()} variant="secondary" size="sm">
          <LogOut size={16} className="mr-1.5" />
          Sign Out
        </StyledButton>
      </div>
    );
  }

  return (
    <StyledButton onClick={() => signIn()} variant="primary" size="sm">
      <LogIn size={16} className="mr-1.5" />
      Sign In
    </StyledButton>
  );
}
