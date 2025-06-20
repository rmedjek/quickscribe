// /auth.ts

import NextAuth from "next-auth";
import {PrismaAdapter} from "@auth/prisma-adapter";
import {PrismaClient} from "@prisma/client";
import Google from "next-auth/providers/google";

const prisma = new PrismaClient();

// Throw an error if the Google client ID or secret is missing
if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  throw new Error("Missing Google OAuth credentials in .env.local");
}

export const {handlers, auth, signIn, signOut} = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Include user.id on session
    async session({session, token}) {
      // The `sub` property of the token is the user's ID
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
