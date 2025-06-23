"use client";

import {signOut, useSession} from "next-auth/react";
import StyledButton from "./StyledButton";
import {LogOut} from "lucide-react";
import Image from "next/image";

export default function UserNav() {
  const {data: session} = useSession();

  if (!session?.user) {
    // This component should only be rendered for authenticated users,
    // so this is a fallback.
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name || "User avatar"}
          width={40}
          height={40}
          className="rounded-full"
        />
      )}
      <StyledButton onClick={() => signOut()} variant="secondary" size="sm">
        <LogOut size={16} className="mr-1.5" />
        Sign Out
      </StyledButton>
    </div>
  );
}
