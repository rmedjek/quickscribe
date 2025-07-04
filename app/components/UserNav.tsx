// app/components/UserNav.tsx
"use client";

import {signOut, useSession} from "next-auth/react";
import {useState, useRef, useEffect} from "react";
import {LogOut, MoonStar, Sun} from "lucide-react";
import Image from "next/image";
import {useTheme} from "../contexts/ThemeContext";

export default function UserNav() {
  const {data: session} = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const {dark, toggle} = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  if (!session?.user) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* --- AVATAR AS THE TRIGGER BUTTON --- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full overflow-hidden w-10 h-10 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-[var(--header-bg)]"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={40}
            height={40}
          />
        ) : (
          <div className="w-10 h-10 bg-slate-300 flex items-center justify-center text-slate-600 font-bold">
            {session.user.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* --- DROPDOWN MENU --- */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-56 origin-top-right rounded-md shadow-xl
                     bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)]
                     focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
          tabIndex={-1}
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <p className="text-sm font-semibold truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {session.user.email}
            </p>
          </div>

          <div className="py-1" role="none">
            {/* Theme Toggle Item */}
            <button
              onClick={toggle}
              className="w-full text-left flex items-center px-4 py-2 text-sm hover:bg-slate-300 dark:hover:bg-slate-700"
              role="menuitem"
              tabIndex={-1}
            >
              {dark ? (
                <Sun size={16} className="mr-3" />
              ) : (
                <MoonStar size={16} className="mr-3" />
              )}
              <span>{dark ? "Light" : "Dark"} Mode</span>
            </button>
          </div>

          <div
            className="py-1 border-t border-[var(--border-color)]"
            role="none"
          >
            {/* Sign Out Item */}
            <button
              onClick={() => signOut({callbackUrl: "/signin"})}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              role="menuitem"
              tabIndex={-1}
            >
              <LogOut size={16} className="mr-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
