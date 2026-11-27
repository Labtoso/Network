import type { FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { jwtVerify, SignJWT } from "jose";
import { config } from "./config.js";

const googleClient = new OAuth2Client();

function secret(): Uint8Array {
  if (config.jwtSecret.length < 32) throw new Error("JWT_SECRET ist nicht gesetzt.");
  return new TextEncoder().encode(config.jwtSecret);
}

export interface Session {
  email: string;
  name?: string;
  picture?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
  }
}

export class AuthError extends Error {
  constructor(message: string, public status: 401 | 403) {
    super(message);
  }
}

/** Prueft das Google ID-Token kryptografisch (Signatur, Audience, Ablauf) und die harte E-Mail-Policy. */
export async function verifyGoogleCredential(credential: string): Promise<Session> {
  if (!config.googleClientId) throw new AuthError("Google Login ist auf dem Server nicht konfiguriert (GOOGLE_CLIENT_ID).", 401);
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new AuthError("Das Google-Token ist ungueltig oder abgelaufen.", 401);
  }
  if (!payload?.email || payload.email_verified !== true) {
    throw new AuthError("Google hat keine bestaetigte E-Mail-Adresse geliefert.", 401);
  }
  const email = payload.email.toLowerCase();
  if (!config.allowedEmails.includes(email)) {
    throw new AuthError(`Der Google-Account ${email} ist nicht freigeschaltet.`, 403);
  }
  return { email, name: payload.name, picture: payload.picture };
}

export async function issueSessionToken(session: Session): Promise<{ token: string; expiresAt: string }> {
  const expires = new Date(Date.now() + config.sessionHours * 3600_000);
  const token = await new SignJWT({ name: session.name, picture: session.picture, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.email)
    .setIssuedAt()
    .setIssuer("network-admin")
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(secret());
  return { token, expiresAt: expires.toISOString() };
}

export async function verifySessionToken(token: string): Promise<Session> {
  const { payload } = await jwtVerify(token, secret(), { issuer: "network-admin" });
  if (payload.typ !== "session" || typeof payload.sub !== "string") throw new Error("Falscher Token-Typ.");
  const email = payload.sub.toLowerCase();
  // Policy wird bei jedem Request erneut geprueft: entfernte Adressen verlieren sofort den Zugang.
  if (!config.allowedEmails.includes(email)) throw new AuthError("Account nicht mehr freigeschaltet.", 403);
  return {
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Kurzlebiges Download-Token, z. B. fuer .mobileconfig-Links, die Safari ohne Header oeffnet. */
export async function issuePurposeToken(purpose: string, subject: string, minutes: number): Promise<string> {
  return new SignJWT({ typ: purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer("network-admin")
    .setExpirationTime(`${minutes}m`)
    .sign(secret());
}

export async function verifyPurposeToken(token: string, purpose: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret(), { issuer: "network-admin" });
  if (payload.typ !== purpose || typeof payload.sub !== "string") throw new Error("Falscher Token-Typ.");
  return payload.sub;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    await reply.code(401).send({ error: "Nicht angemeldet." });
    return;
  }
  try {
    request.session = await verifySessionToken(match[1]);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401;
    await reply.code(status).send({ error: status === 403 ? "Kein Zugriff." : "Sitzung abgelaufen, bitte neu anmelden." });
  }
}
