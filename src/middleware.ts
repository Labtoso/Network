import { NextRequest, NextResponse } from "next/server";
import { resolveZeroTrustIdentity } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets, Roaming DoH endpoints, custom block page, and login route
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/dns-query") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/block") ||
    pathname.startsWith("/login") ||
    pathname === "/manifest.json" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookieEmail = request.cookies.get("labtoso_zt_email")?.value || null;
  const identity = resolveZeroTrustIdentity(request.headers, cookieEmail);

  if (!identity.authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Zero-Trust Access Denied",
          message: `Access restricted exclusively to ${identity.allowedEmail}`,
          provider: "Cloudflare Zero Trust",
        },
        { status: 403 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("X-Zero-Trust-Verified", identity.email);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
