import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_OWNER_EMAIL,
  resolveZeroTrustIdentity,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const cookieEmail = request.cookies.get("labtoso_zt_email")?.value || null;
  const identity = resolveZeroTrustIdentity(request.headers, cookieEmail);
  return NextResponse.json(identity);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedEmail = (body?.email || "").trim().toLowerCase();
    const allowed = ALLOWED_OWNER_EMAIL.trim().toLowerCase();

    if (requestedEmail !== allowed) {
      return NextResponse.json(
        {
          authenticated: false,
          error: `Zugriff verweigert: Nur ${ALLOWED_OWNER_EMAIL} ist autorisiert.`,
        },
        { status: 403 }
      );
    }

    const res = NextResponse.json({
      authenticated: true,
      email: allowed,
      provider: "cloudflare-access",
    });

    res.cookies.set("labtoso_zt_email", allowed, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json(
      { authenticated: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
