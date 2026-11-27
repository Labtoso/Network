import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../src/audit.js";
import { AuthError, issueSessionToken, requireAdmin, verifyGoogleCredential } from "../src/auth.js";
import { parse } from "./util.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/auth/google", async (request, reply) => {
    const now = Date.now();
    const bucket = attempts.get(request.ip);
    if (bucket && bucket.resetAt > now && bucket.count >= 20) {
      return reply.code(429).send({ error: "Zu viele Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen." });
    }
    attempts.set(request.ip, bucket && bucket.resetAt > now ? { ...bucket, count: bucket.count + 1 } : { count: 1, resetAt: now + 10 * 60_000 });

    const { credential } = parse(z.object({ credential: z.string().min(20).max(4096) }), request.body);
    try {
      const session = await verifyGoogleCredential(credential);
      const issued = await issueSessionToken(session);
      await audit(session.email, "auth.login", { ip: request.ip });
      return { ...issued, email: session.email, name: session.name ?? null, picture: session.picture ?? null };
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.status === 403) await audit("anonymous", "auth.forbidden", { ip: request.ip, reason: error.message });
        return reply.code(error.status).send({ error: error.message, forbidden: error.status === 403 });
      }
      throw error;
    }
  });

  app.get("/api/auth/me", { preHandler: requireAdmin }, async (request) => request.session);
}
