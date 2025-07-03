// app/lib/auth.ts
import {PrismaAdapter} from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import {PrismaClient} from "@prisma/client";
import type {Adapter} from "next-auth/adapters";

const prisma = new PrismaClient();

export const {handlers, auth, signIn, signOut} = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  // We define the custom sign-in page directly here.
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    // The `authorized` callback IS the middleware logic.
    // It runs for every request matched by the `middleware.ts` config.
    authorized({auth, request: {nextUrl}}) {
      const isLoggedIn = !!auth?.user;
      const isTryingToAccessApp = nextUrl.pathname !== "/signin";

      if (isTryingToAccessApp) {
        // If they are trying to access any protected page and are not logged in,
        // redirect them to the login page.
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn) {
        // If they are logged in and try to visit the sign-in page,
        // redirect them to the main page.
        return Response.redirect(new URL("/", nextUrl));
      }
      // If they are not logged in and on the sign-in page, allow it.
      return true;
    },
    async jwt({token, user}) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({session, token}) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
