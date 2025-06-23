// File: app/lib/auth.ts
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
  // --- THIS IS THE NEW SECTION ---
  pages: {
    signIn: "/signin", // Tells Auth.js to use our custom sign-in page
    // You can also add custom pages for error, signout, etc.
    // error: '/auth/error',
  },
  // --- END NEW SECTION ---
  callbacks: {
    async jwt({token, user}) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({session, token}) {
      if (session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }
        if (typeof token.role === "string") {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
});
