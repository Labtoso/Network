import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issuePurposeToken, verifyPurposeToken } from "../src/auth.js";
import { normalizeDomain } from "../src/adguard.js";
import { identifyClient, remainingFromSchedule, renderBlockPage } from "../src/blockpage.js";
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import { buildMobileconfig, signMobileconfig } from "../src/mobileconfig.js";
import { notifyAdmin } from "../src/notify.js";
import { getBlockPage, getGeneral, getRoaming } from "../src/settings.js";
import { readDuckDnsStatus } from "../src/system.js";
import { HttpError, parse } from "./util.js";

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, user.length - 2))}${user.slice(-1)}@${domain}`;
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true, version: config.version, time: new Date().toISOString() }));

  app.get("/api/public/config", async () => {
    const general = await getGeneral();
    const duckdns = await readDuckDnsStatus();
    return {
      version: config.version,
      googleClientId: config.googleClientId || null,
      allowedEmailHint: config.allowedEmails.map(maskEmail),
      setupComplete: general.setupComplete,
      theme: general.theme,
      publicUrl: config.publicUrl,
      duckdns: { domain: config.duckdnsDomain ? `${config.duckdnsDomain}.duckdns.org` : null, ok: duckdns.ok, checkedAt: duckdns.checkedAt },
    };
  });

  /* ---------- Sperrseite: Caddy leitet jeden HTTP-Request auf Port 80 mit fremdem Host hierher ---------- */
  app.get("/blocked", async (request, reply) => {
    const query = request.query as { domain?: string };
    const hostHeader = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].split(":")[0];
    let domain = hostHeader;
    if (!domain || domain === config.primaryHost || /^[0-9.]+$/.test(domain)) domain = query.domain ?? "unbekannt";
    try {
      domain = normalizeDomain(domain);
    } catch {
      domain = "unbekannt";
    }
    const cfg = await getBlockPage();
    const who = await identifyClient(request.ip);
    const remainingMs = remainingFromSchedule(who.schedule);

    if (cfg.mode === "redirect" && /^https?:\/\//i.test(cfg.redirectUrl)) {
      const target = cfg.redirectUrl
        .replace(/\{domain\}/g, encodeURIComponent(domain))
        .replace(/\{client_name\}/g, encodeURIComponent(who.name))
        .replace(/\{time_remaining\}/g, encodeURIComponent(remainingMs === null ? "" : String(Math.round(remainingMs / 1000))));
      return reply.redirect(target, 302);
    }
    reply.header("Cache-Control", "no-store");
    reply.type("text/html; charset=utf-8");
    return renderBlockPage(cfg, { domain, clientName: who.name, remainingMs }, { preview: false });
  });

  app.post("/api/public/access-request", async (request, reply) => {
    const body = parse(z.object({ domain: z.string().min(1).max(253), message: z.string().max(300).optional() }), request.body);
    const domain = normalizeDomain(body.domain);
    const ip = request.ip;
    const pending = await prisma.accessRequest.count({ where: { clientIp: ip, status: "pending" } });
    if (pending >= 5) throw new HttpError(429, "Es sind schon 5 Anfragen von diesem Geraet offen.");
    const existing = await prisma.accessRequest.findFirst({ where: { clientIp: ip, domain, status: "pending" } });
    if (existing) return reply.code(200).send({ id: existing.id, status: existing.status });
    const who = await identifyClient(ip);
    const created = await prisma.accessRequest.create({
      data: { domain, clientIp: ip, clientName: who.client ? who.name : who.name !== ip ? who.name : null, message: body.message?.trim() || null },
    });
    await notifyAdmin(
      "Freigabe angefragt",
      `${who.name} moechte ${domain} aufrufen.${body.message ? `\nGrund: ${body.message}` : ""}`,
      `${config.publicUrl}/#settings`,
    );
    return reply.code(201).send({ id: created.id, status: created.status });
  });

  app.get("/api/public/access-request/:id", async (request) => {
    const { id } = request.params as { id: string };
    const row = await prisma.accessRequest.findUnique({ where: { id } });
    if (!row || row.clientIp !== request.ip) throw new HttpError(404, "Anfrage nicht gefunden.");
    return { status: row.status, expiresAt: row.expiresAt };
  });

  /* ---------- .mobileconfig-Download mit kurzlebigem Token (iOS Safari sendet keine Header) ---------- */
  app.get("/api/public/profile/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    let deviceId: string;
    try {
      deviceId = await verifyPurposeToken(token.replace(/\.mobileconfig$/, ""), "profile");
    } catch {
      throw new HttpError(410, "Der Profil-Link ist abgelaufen. Bitte im Panel einen neuen erzeugen.");
    }
    const device = await prisma.roamingDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new HttpError(404, "Geraet existiert nicht mehr.");
    const plain = buildMobileconfig(device, await getRoaming());
    const { body } = await signMobileconfig(plain);
    reply.header("Content-Type", "application/x-apple-aspen-config");
    reply.header("Content-Disposition", `attachment; filename="network-${device.clientId}.mobileconfig"`);
    reply.header("Cache-Control", "no-store");
    return reply.send(body);
  });
}

export async function createProfileLink(deviceId: string): Promise<{ url: string; expiresAt: string }> {
  const minutes = 30;
  const token = await issuePurposeToken("profile", deviceId, minutes);
  return {
    url: `${config.publicUrl}/api/public/profile/${token}.mobileconfig`,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  };
}
