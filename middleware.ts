// // middleware.ts
// import NextAuth from "next-auth";
// import {authConfig} from "./auth.config";

// export default NextAuth(authConfig).auth;

// export const config = {
//   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
// };

// ------------------------------------------------------------------------------------------------------------------------------------------------------------//

// middleware.ts
import {auth} from "@/lib/auth";

// This is the simplest and most robust pattern from next-auth.
// It automatically protects all routes in the matcher and redirects
// unauthenticated users to the login page defined in `lib/auth.ts`.
export default auth;

export const config = {
  // This regex protects all routes by default, except for specific system folders,
  // API routes, and the sign-in page itself.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|signin).*)"],
};
