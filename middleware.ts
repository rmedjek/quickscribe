// middleware.ts
import {auth} from "@/lib/auth";

export default auth;

// This config ensures the middleware runs on all paths,
// allowing the `authorized` callback to protect them.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
