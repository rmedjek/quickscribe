import "next-auth";
import type {DefaultSession, User as DefaultUser} from "next-auth";

// By declaring the module, we are "merging" our own types
// with the original types from the next-auth library.

declare module "next-auth" {
  /**
   * We are extending the built-in `User` model to include our custom `role`.
   */
  interface User extends DefaultUser {
    role: string;
  }

  /**
   * We are extending the built-in `Session` object to include our custom properties
   * on the `session.user` object.
   */
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * We are extending the JWT to include the user's role and ID.
   */
  interface JWT {
    role: string;
    id: string;
  }
}
