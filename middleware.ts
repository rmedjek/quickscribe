import {auth} from "@/lib/auth";

// This is the middleware function that will be executed for every request.
export default auth((req) => {
  // If the user is not authenticated and the requested path is not the sign-in page,
  // redirect them to the sign-in page.
  if (!req.auth && req.nextUrl.pathname !== "/signin") {
    const newUrl = new URL("/signin", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  // If the user IS authenticated and they try to visit the sign-in page,
  // redirect them to the main application page.
  if (req.auth && req.nextUrl.pathname === "/signin") {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }
});

// This config specifies which routes the middleware should apply to.
// We are protecting all routes except for API routes, Next.js internal routes,
// and static asset files.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
