// auth.config.ts
import type {NextAuthConfig} from "next-auth";
import {NextResponse} from "next/server";

export const authConfig = {
  pages: {
    // This tells the middleware that our sign-in page is at '/signin'.
    signIn: "/signin",
  },
  callbacks: {
    // The 'authorized' callback is the core of our security.
    // It runs for every request that the matcher intercepts.
    authorized({auth, request: {nextUrl}}) {
      const isLoggedIn = !!auth?.user;
      const isOnSignInPage = nextUrl.pathname.startsWith("/signin");

      // Rule 1: If the user is logged in...
      if (isLoggedIn) {
        // ...and they are on the sign-in page, redirect them away to the dashboard.
        if (isOnSignInPage) {
          return NextResponse.redirect(new URL("/dashboard", nextUrl));
        }
        // ...and they are on any other page, allow them to proceed.
        return true;
      }

      // Rule 2: If the user is NOT logged in...
      if (!isLoggedIn) {
        // ...and they are already on the sign-in page, allow them to stay there.
        if (isOnSignInPage) {
          return true;
        }
        // ...and they are on ANY other page, redirect them TO the sign-in page.
        return false;
      }

      // Default case (should not be reached)
      return false;
    },
  },
  providers: [], // This can be empty because our main auth.ts handles providers.
} satisfies NextAuthConfig;
