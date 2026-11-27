export const ALLOWED_OWNER_EMAIL =
  process.env.ALLOWED_EMAIL ||
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL ||
  "sebirauch2022@gmail.com";

export const PUBLIC_ZERO_TRUST_DOMAIN =
  process.env.PUBLIC_DOMAIN ||
  process.env.NEXT_PUBLIC_DOMAIN ||
  "admin.labtoso.de";

export interface ZeroTrustIdentity {
  authenticated: boolean;
  email: string;
  provider: "cloudflare-access" | "tailscale-direct" | "local-session";
  accessVector: string;
  cfRay: string | null;
  country: string | null;
  clientIp: string;
  strictPolicy: boolean;
  allowedEmail: string;
  timestamp: string;
}

/**
 * Decodes a Cloudflare Access JWT assertion payload (`Cf-Access-Jwt-Assertion`)
 * without external dependencies to extract the verified email claim.
 */
export function extractEmailFromCfJwt(jwt: string | null): string | null {
  if (!jwt) return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    if (typeof payload?.email === "string" && payload.email.includes("@")) {
      return payload.email.trim().toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates incoming request headers against the Hard Access-Policy
 * (`sebirauch2022@gmail.com`) via Cloudflare Zero Trust or Tailnet fallback.
 */
export function resolveZeroTrustIdentity(
  headers: Headers,
  cookieEmail?: string | null
): ZeroTrustIdentity {
  const allowed = ALLOWED_OWNER_EMAIL.trim().toLowerCase();
  const strict = process.env.CF_ZERO_TRUST_STRICT === "true";

  const cfEmailHeader = headers
    .get("cf-access-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  const cfJwtHeader = headers.get("cf-access-jwt-assertion");
  const jwtEmail = extractEmailFromCfJwt(cfJwtHeader);
  const resolvedCfEmail = cfEmailHeader || jwtEmail;

  const cfRay = headers.get("cf-ray");
  const country = headers.get("cf-ipcountry");
  const clientIp =
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "127.0.0.1";
  const host = headers.get("host") || "";

  // 1. Direct Cloudflare Access Zero-Trust header present
  if (resolvedCfEmail) {
    const isOwner = resolvedCfEmail === allowed;
    return {
      authenticated: isOwner,
      email: resolvedCfEmail,
      provider: "cloudflare-access",
      accessVector: `Cloudflare Zero Trust (${PUBLIC_ZERO_TRUST_DOMAIN})`,
      cfRay,
      country,
      clientIp,
      strictPolicy: true,
      allowedEmail: allowed,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Check if request comes via Tailscale CGNAT subnet (100.64.0.0/10)
  const isTailscaleIp =
    clientIp.startsWith("100.") || host.endsWith(".ts.net");
  if (isTailscaleIp && !strict) {
    return {
      authenticated: true,
      email: allowed,
      provider: "tailscale-direct",
      accessVector: "Tailscale Mesh VPN (Tailnet Direct)",
      cfRay: null,
      country: "TAILNET",
      clientIp,
      strictPolicy: false,
      allowedEmail: allowed,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Local LAN / Session fallback (when testing or accessing directly via Proxmox LXC IP)
  if (!strict) {
    const normalizedCookie = cookieEmail?.trim().toLowerCase();
    const isAcceptedEmail = !normalizedCookie || normalizedCookie === allowed;
    return {
      authenticated: isAcceptedEmail,
      email: isAcceptedEmail ? allowed : normalizedCookie || "unauthorized",
      provider: "local-session",
      accessVector: `Direct LXC / LAN (${host || "localhost"})`,
      cfRay: null,
      country: "LAN",
      clientIp,
      strictPolicy: false,
      allowedEmail: allowed,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    authenticated: false,
    email: "unauthenticated",
    provider: "cloudflare-access",
    accessVector: "Blocked by Zero-Trust Gate",
    cfRay,
    country,
    clientIp,
    strictPolicy: true,
    allowedEmail: allowed,
    timestamp: new Date().toISOString(),
  };
}
