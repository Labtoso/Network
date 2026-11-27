import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import dnsPacket from "dns-packet";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ag } from "../src/adguard.js";
import { audit } from "../src/audit.js";
import { requireAdmin } from "../src/auth.js";
import { blockCacheInfo, refreshBlockCache } from "../src/blockcache.js";
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import { dotStatus } from "../src/dot.js";
import {
  generalSchema,
  getAdGuardConnection,
  getGeneral,
  getRoaming,
  normalizeAdGuardUrl,
  setAdGuardConnection,
  setGeneral,
  type AdGuardConnection,
} from "../src/settings.js";
import { readDuckDnsStatus, systemInfo } from "../src/system.js";
import { HttpError, parse } from "./util.js";

const run = promisify(execFile);

/** Prueft, ob AdGuard unverschluesseltes DoH annimmt (Voraussetzung fuer Roaming ueber Caddy/Backend). */
async function testAdGuardDoh(url: string): Promise<{ ok: boolean; message: string }> {
  const query = dnsPacket.encode({ type: "query", id: 4242, flags: dnsPacket.RECURSION_DESIRED, questions: [{ type: "A", name: "example.org" }] });
  try {
    const response = await fetch(`${url}/dns-query`, {
      method: "POST",
      headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" },
      body: new Uint8Array(query),
      signal: AbortSignal.timeout(4000),
      redirect: "error",
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `AdGuard antwortet auf /dns-query mit HTTP ${response.status}. In AdGuardHome.yaml unter tls: "allow_unencrypted_doh: true" setzen und AdGuard neu starten.`,
      };
    }
    const decoded = dnsPacket.decode(Buffer.from(await response.arrayBuffer()));
    return { ok: decoded.id === 4242, message: decoded.id === 4242 ? "DoH-Weiterleitung funktioniert." : "Unerwartete DNS-Antwort." };
  } catch (error) {
    return { ok: false, message: `DoH-Test fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const adguardInput = z.object({ url: z.string().min(1).max(512), user: z.string().max(256), password: z.string().max(512).nullable().optional() });

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);
  const actor = (request: { session?: { email: string } }) => request.session?.email ?? "unknown";

  app.get("/api/settings", async () => {
    const [general, roaming, conn] = await Promise.all([getGeneral(), getRoaming(), getAdGuardConnection()]);
    return {
      general,
      roaming,
      adguard: { url: conn.url, user: conn.user, hasPassword: Boolean(conn.pass), source: conn.source },
      allowedEmails: config.allowedEmails,
      corsOrigins: config.corsOrigins,
      publicUrl: config.publicUrl,
    };
  });

  app.put("/api/settings/general", async (request) => {
    const current = await getGeneral();
    const body = parse(generalSchema.partial(), request.body);
    const next = { ...current, ...body };
    if (next.notifyUrl && !/^https?:\/\//i.test(next.notifyUrl)) throw new HttpError(400, "Die Benachrichtigungs-URL muss mit http(s):// beginnen.");
    await setGeneral(next);
    await audit(actor(request), "settings.general", body);
    return next;
  });

  const resolveInput = async (body: z.infer<typeof adguardInput>): Promise<AdGuardConnection> => {
    const current = await getAdGuardConnection();
    let url: string;
    try {
      url = normalizeAdGuardUrl(body.url);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Ungueltige URL.");
    }
    return { url, user: body.user, pass: body.password ?? current.pass, source: "database" };
  };

  app.post("/api/settings/adguard/test", async (request) => {
    const conn = await resolveInput(parse(adguardInput, request.body));
    const start = performance.now();
    try {
      const status = await ag.status(conn);
      return { ok: true, ms: Math.round(performance.now() - start), status, doh: await testAdGuardDoh(conn.url) };
    } catch (error) {
      return { ok: false, ms: Math.round(performance.now() - start), error: error instanceof Error ? error.message : String(error) };
    }
  });

  app.put("/api/settings/adguard", async (request) => {
    const body = parse(adguardInput, request.body);
    const conn = await resolveInput(body);
    try {
      await ag.status(conn);
    } catch (error) {
      throw new HttpError(400, `Nicht gespeichert: ${error instanceof Error ? error.message : String(error)}`);
    }
    await setAdGuardConnection(conn.url, conn.user, body.password ?? null);
    await audit(actor(request), "settings.adguard", { url: conn.url, user: conn.user });
    void refreshBlockCache();
    return { ok: true };
  });

  app.post("/api/setup/complete", async (request) => {
    const general = await getGeneral();
    await setGeneral({ ...general, setupComplete: true });
    await audit(actor(request), "setup.complete", {});
    return { ok: true };
  });

  app.get("/api/system", async () => ({
    ...(await systemInfo()),
    duckdns: await readDuckDnsStatus(),
    dot: dotStatus(),
    blockCache: blockCacheInfo(),
    database: { devices: await prisma.roamingDevice.count(), auditEntries: await prisma.auditLog.count() },
  }));

  app.post("/api/system/duckdns-refresh", async (request) => {
    const script = path.join(config.rootDir, "duckdns-update.sh");
    if (!existsSync(script)) throw new HttpError(404, "duckdns-update.sh nicht gefunden.");
    try {
      await run("bash", [script], { timeout: 30_000, cwd: config.rootDir });
    } catch (error) {
      request.log.warn({ err: error }, "DuckDNS-Update meldet Fehler");
    }
    await audit(actor(request), "duckdns.refresh", {});
    return readDuckDnsStatus();
  });

  app.get("/api/audit", async (request) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), request.query);
    return { entries: await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: limit }) };
  });
}
