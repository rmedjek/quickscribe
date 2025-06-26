// middleware.ts
import {NextResponse} from "next/server";
import {auth} from "@/lib/auth"; // Assuming this is your NextAuth config

export default auth((req) => {
  const {pathname} = req.nextUrl;

  // Allow all requests to the Inngest API route to pass through *without* authentication.
  // This MUST come before any auth checks.
  if (pathname.startsWith("/api/inngest")) {
    return NextResponse.next();
  }

  // If not trying to access the sign-in page, and not authenticated, redirect to sign-in.
  if (pathname !== "/signin" && !req.auth) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // If authenticated and trying to access sign-in, redirect to dashboard or home.
  if (pathname === "/signin" && req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // For all other cases, allow the request.
  return NextResponse.next();
});

// The matcher should apply to all routes except for static assets and Next.js internals.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
