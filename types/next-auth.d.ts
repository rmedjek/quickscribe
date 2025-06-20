// /types/next-auth.d.ts

import "next-auth";

declare module "next-auth" {
  /**
   * Extends the built-in session.user type to include the 'id' property.
   */
  interface Session {
    user: {
      id: string; // Add the 'id' property here
    } & DefaultSession["user"];
  }
}
