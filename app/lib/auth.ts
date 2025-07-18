// app/lib/auth.ts
import NextAuth from "next-auth";
import {PrismaAdapter} from "@auth/prisma-adapter";
import prisma from "./prisma";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import {env} from "./env.mjs";
import {authConfig} from "@/auth.config";

export const {handlers, auth, signIn, signOut} = NextAuth({
  ...authConfig, // Use the base config
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", // <-- We are now definitively using JWT strategy
  },
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({token, user}) {
      if (user) {
        token.id = user.id;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: {id: token.id as string},
        });
        if (!dbUser) {
          token = {};
        }
      }

      return token;
    },

    async session({session, token}) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
