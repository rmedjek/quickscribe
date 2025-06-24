// File: middleware.ts

import {auth} from "@/lib/auth";
import {NextResponse} from "next/server";

export default auth((req) => {
  const {pathname} = req.nextUrl;

  // This check will now execute correctly because the matcher below allows it to.
  if (pathname.startsWith("/api/inngest")) {
    // If the request is for the Inngest API, do nothing and let it pass through untouched.
    return NextResponse.next();
  }

  // For all other requests, apply our authentication security rules.
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && pathname !== "/signin") {
    return Response.redirect(new URL("/signin", req.nextUrl.origin));
  }

  if (isLoggedIn && pathname === "/signin") {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }

  // If none of the above conditions are met, allow the request to proceed.
  return NextResponse.next();
});

// --- THIS IS THE CRITICAL FIX ---
// We have REMOVED `?!api` from the matcher.
// The middleware will now run on all paths except for the ones listed,
// which is what we need for our bypass logic to work.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
