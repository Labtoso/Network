import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ag, normalizeDomain, type AdGuardClient } from "../src/adguard.js";
import { audit } from "../src/audit.js";
import { requireAdmin } from "../src/auth.js";
import { blockCacheInfo, refreshBlockCache } from "../src/blockcache.js";
import { prisma } from "../src/db.js";
import { dotStatus } from "../src/dot.js";
import { primeSeen, subscribe } from "../src/querylog-stream.js";
import { readDuckDnsStatus } from "../src/system.js";
import { HttpError, clientModifier, parse } from "./util.js";

const scheduleSpan = z.object({ start: z.number().int().min(0).max(86_400_000), end: z.number().int().min(0).max(86_400_000) });
const scheduleSchema = z
  .object({
    time_zone: z.string().max(64).optional(),
    sun: scheduleSpan.optional(),
    mon: scheduleSpan.optional(),
    tue: scheduleSpan.optional(),
    wed: scheduleSpan.optional(),
    thu: scheduleSpan.optional(),
    fri: scheduleSpan.optional(),
    sat: scheduleSpan.optional(),
  })
  .optional();

const clientSchema = z.object({
  name: z.string().min(1).max(128),
  ids: z.array(z.string().min(1).max(128)).min(1).max(50),
  use_global_settings: z.boolean(),
  filtering_enabled: z.boolean(),
  parental_enabled: z.boolean(),
  safebrowsing_enabled: z.boolean(),
  safe_search: z.record(z.boolean()).optional(),
  use_global_blocked_services: z.boolean(),
  blocked_services: z.array(z.string()).max(500),
  blocked_services_schedule: scheduleSchema,
  upstreams: z.array(z.string().max(512)).max(50),
  tags: z.array(z.string().max(64)).max(50),
  ignore_querylog: z.boolean().optional(),
  ignore_statistics: z.boolean().optional(),
  upstreams_cache_enabled: z.boolean().optional(),
  upstreams_cache_size: z.number().int().min(0).optional(),
});

const filterBody = z.object({ url: z.string().min(1).max(2048), whitelist: z.boolean() });

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function settledError(result: PromiseSettledResult<unknown>): string | null {
  return result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : null;
}

export async function adguardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);
  const actor = (request: { session?: { email: string } }) => request.session?.email ?? "unknown";

  /* ---------- Dashboard ---------- */
  app.get("/api/dashboard", async () => {
    const [status, stats] = await Promise.allSettled([ag.status(), ag.stats()]);
    const [duckdns, pending, devices, latency] = await Promise.all([
      readDuckDnsStatus(),
      prisma.accessRequest.count({ where: { status: "pending" } }),
      prisma.roamingDevice.findMany({ orderBy: { name: "asc" } }),
      prisma.$queryRaw<{ target: string; ms: number; ok: number; createdAt: string }[]>`
        SELECT l.target, l.ms, l.ok, l.createdAt FROM LatencySample l
        JOIN (SELECT target, MAX(id) AS id FROM LatencySample GROUP BY target) m ON m.id = l.id`,
    ]);
    const staleBefore = Date.now() - 24 * 3600_000;
    return {
      adguard: settledValue(status),
      adguardError: settledError(status),
      stats: settledValue(stats),
      duckdns,
      dot: dotStatus(),
      blockCache: blockCacheInfo(),
      pendingRequests: pending,
      roaming: {
        total: devices.length,
        active: devices.filter((d) => d.lastSeenAt && d.lastSeenAt.getTime() > staleBefore).length,
        stale: devices
          .filter((d) => d.enabled && (!d.lastSeenAt || d.lastSeenAt.getTime() <= staleBefore))
          .map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt })),
      },
      latency: latency.map((row) => ({ target: row.target, ms: Number(row.ms), ok: Boolean(Number(row.ok)), at: row.createdAt })),
    };
  });

  app.post("/api/protection", async (request) => {
    const body = parse(z.object({ enabled: z.boolean(), minutes: z.number().int().min(1).max(1440).optional() }), request.body);
    await ag.setProtection(body.enabled, !body.enabled && body.minutes ? body.minutes * 60_000 : undefined);
    await audit(actor(request), "protection.set", body);
    return ag.status();
  });

  /* ---------- Query-Log ---------- */
  app.get("/api/querylog", async (request) => {
    const q = parse(
      z.object({
        limit: z.coerce.number().int().min(1).max(500).default(100),
        older_than: z.string().max(64).optional(),
        search: z.string().max(253).optional(),
        status: z.enum(["all", "filtered", "blocked", "blocked_services", "blocked_safebrowsing", "blocked_parental", "whitelisted", "rewritten", "safe_search", "processed"]).optional(),
      }),
      request.query,
    );
    return ag.queryLog({ limit: q.limit, older_than: q.older_than, search: q.search, response_status: q.status === "all" ? undefined : q.status });
  });

  app.get("/api/querylog/stream", async (request, reply) => {
    const initial = await ag.queryLog({ limit: 50 }).catch(() => ({ data: [] as never[], oldest: "" }));
    primeSeen(initial.data ?? []);
    const headers = { ...reply.getHeaders() } as Record<string, string>;
    reply.hijack();
    reply.raw.writeHead(200, {
      ...headers,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("snapshot", initial.data ?? []);
    const unsubscribe = subscribe(
      (entries) => send("entries", entries),
      (message) => send("upstream-error", { message }),
    );
    const ping = setInterval(() => reply.raw.write(`: ping ${Date.now()}\n\n`), 15_000);
    request.raw.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  app.post("/api/quick-rule", async (request) => {
    const body = parse(
      z.object({ domain: z.string().min(1).max(253), action: z.enum(["block", "allow"]), client: z.string().max(128).optional() }),
      request.body,
    );
    const domain = normalizeDomain(body.domain);
    const suffix = body.client ? `$client=${clientModifier(body.client)}` : "";
    const blockRule = `||${domain}^${suffix}`;
    const allowRule = `@@||${domain}^${suffix ? `${suffix},important` : "$important"}`;
    const wanted = body.action === "block" ? blockRule : allowRule;
    const opposite = body.action === "block" ? allowRule : blockRule;
    const filtering = await ag.filtering();
    const rules = (filtering.user_rules ?? []).filter((rule) => rule !== opposite);
    if (!rules.includes(wanted)) rules.push(wanted);
    await ag.setUserRules(rules);
    await audit(actor(request), `rule.quick.${body.action}`, { rule: wanted });
    void refreshBlockCache();
    return { rule: wanted, rules };
  });

  /* ---------- Filterlisten ---------- */
  app.get("/api/filters", async () => ag.filtering());

  app.post("/api/filters", async (request) => {
    const body = parse(z.object({ name: z.string().min(1).max(256), url: z.string().min(1).max(2048), whitelist: z.boolean() }), request.body);
    await ag.addFilter(body.name, body.url, body.whitelist);
    await audit(actor(request), "filter.add", body);
    return ag.filtering();
  });

  app.patch("/api/filters", async (request) => {
    const body = parse(
      filterBody.extend({ name: z.string().min(1).max(256), enabled: z.boolean(), newUrl: z.string().min(1).max(2048).optional() }),
      request.body,
    );
    await ag.setFilter(body.url, body.whitelist, { name: body.name, url: body.newUrl ?? body.url, enabled: body.enabled });
    await audit(actor(request), "filter.update", body);
    return ag.filtering();
  });

  app.post("/api/filters/remove", async (request) => {
    const body = parse(filterBody, request.body);
    await ag.removeFilter(body.url, body.whitelist);
    await audit(actor(request), "filter.remove", body);
    return ag.filtering();
  });

  app.post("/api/filters/refresh", async (request) => {
    const body = parse(z.object({ whitelist: z.boolean().default(false) }), request.body);
    const result = await ag.refreshFilters(body.whitelist);
    await audit(actor(request), "filter.refresh", result);
    void refreshBlockCache();
    return { ...result, status: await ag.filtering() };
  });

  app.put("/api/filters/config", async (request) => {
    const body = parse(z.object({ enabled: z.boolean(), interval: z.union([z.literal(0), z.literal(1), z.literal(12), z.literal(24), z.literal(72), z.literal(168)]) }), request.body);
    await ag.setFilteringConfig(body.enabled, body.interval);
    await audit(actor(request), "filter.config", body);
    return ag.filtering();
  });

  /* ---------- Benutzerregeln ---------- */
  app.get("/api/rules", async () => ({ rules: (await ag.filtering()).user_rules ?? [] }));

  app.put("/api/rules", async (request) => {
    const body = parse(z.object({ rules: z.array(z.string().max(4096)).max(50_000) }), request.body);
    const rules = body.rules.map((rule) => rule.replace(/\r/g, ""));
    await ag.setUserRules(rules);
    await audit(actor(request), "rules.save", { count: rules.length });
    void refreshBlockCache();
    return { rules };
  });

  app.post("/api/rules/check", async (request) => {
    const body = parse(z.object({ name: z.string().min(1).max(253), client: z.string().max(128).optional() }), request.body);
    return ag.checkHost(normalizeDomain(body.name), body.client || undefined);
  });

  /* ---------- Gesperrte Dienste ---------- */
  app.get("/api/services", async () => {
    const [all, current] = await Promise.all([ag.servicesAll(), ag.servicesGet()]);
    return { services: all.blocked_services ?? [], groups: all.groups ?? [], ids: current.ids ?? [], schedule: current.schedule ?? null };
  });

  app.put("/api/services", async (request) => {
    const body = parse(z.object({ ids: z.array(z.string().max(64)).max(500), schedule: scheduleSchema }), request.body);
    const current = await ag.servicesGet();
    await ag.servicesUpdate(body.ids, body.schedule ?? current.schedule);
    await audit(actor(request), "services.global", { ids: body.ids });
    void refreshBlockCache();
    return ag.servicesGet();
  });

  /* ---------- Clients ---------- */
  app.get("/api/clients", async () => {
    const result = await ag.clients();
    return { clients: result.clients ?? [], autoClients: result.auto_clients ?? [], supportedTags: result.supported_tags ?? [] };
  });

  app.post("/api/clients", async (request) => {
    const body = parse(clientSchema, request.body) as AdGuardClient;
    await ag.addClient(body);
    await audit(actor(request), "client.add", { name: body.name, ids: body.ids });
    return { ok: true };
  });

  app.put("/api/clients/:name", async (request) => {
    const { name } = request.params as { name: string };
    const body = parse(clientSchema, request.body) as AdGuardClient;
    await ag.updateClient(name, body);
    await audit(actor(request), "client.update", { name, next: body.name });
    return { ok: true };
  });

  app.post("/api/clients/:name/delete", async (request) => {
    const { name } = request.params as { name: string };
    await ag.deleteClient(name);
    await audit(actor(request), "client.delete", { name });
    return { ok: true };
  });

  app.patch("/api/clients/:name/services", async (request) => {
    const { name } = request.params as { name: string };
    const body = parse(z.object({ useGlobal: z.boolean(), ids: z.array(z.string().max(64)).max(500), schedule: scheduleSchema }), request.body);
    const list = await ag.clients();
    const client = (list.clients ?? []).find((entry) => entry.name === name);
    if (!client) throw new HttpError(404, `Client "${name}" existiert in AdGuard nicht.`);
    await ag.updateClient(name, {
      ...client,
      use_global_blocked_services: body.useGlobal,
      blocked_services: body.ids,
      blocked_services_schedule: body.schedule ?? client.blocked_services_schedule ?? { time_zone: "Local" },
    });
    await audit(actor(request), "client.services", { name, ...body });
    return { ok: true };
  });

  /* ---------- DNS-Rewrites ---------- */
  const rewrite = z.object({ domain: z.string().min(1).max(253), answer: z.string().min(1).max(253) });

  app.get("/api/rewrites", async () => ({ rewrites: (await ag.rewrites()) ?? [] }));
  app.post("/api/rewrites", async (request) => {
    const body = parse(rewrite, request.body);
    await ag.addRewrite(body.domain.trim().toLowerCase(), body.answer.trim());
    await audit(actor(request), "rewrite.add", body);
    return { rewrites: (await ag.rewrites()) ?? [] };
  });
  app.put("/api/rewrites", async (request) => {
    const body = parse(z.object({ target: rewrite, update: rewrite }), request.body);
    await ag.updateRewrite(body.target, { domain: body.update.domain.trim().toLowerCase(), answer: body.update.answer.trim() });
    await audit(actor(request), "rewrite.update", body);
    return { rewrites: (await ag.rewrites()) ?? [] };
  });
  app.post("/api/rewrites/delete", async (request) => {
    const body = parse(rewrite, request.body);
    await ag.deleteRewrite(body.domain, body.answer);
    await audit(actor(request), "rewrite.delete", body);
    return { rewrites: (await ag.rewrites()) ?? [] };
  });

  /* ---------- DNS-Einstellungen & Latenz ---------- */
  app.get("/api/dns", async () => {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [info, samples] = await Promise.all([
      ag.dnsInfo(),
      prisma.latencySample.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
    ]);
    const series: Record<string, { at: string; ms: number; ok: boolean; error: string | null }[]> = {};
    for (const sample of samples) {
      (series[sample.target] ??= []).push({ at: sample.createdAt.toISOString(), ms: sample.ms, ok: sample.ok, error: sample.error });
    }
    return { info, series };
  });

  app.post("/api/dns/test", async (request) => {
    const body = parse(z.object({ upstreams: z.array(z.string().min(1).max(512)).min(1).max(20) }), request.body);
    const info = await ag.dnsInfo();
    const results: { upstream: string; ok: boolean; ms: number; message: string }[] = [];
    for (const upstream of body.upstreams) {
      const start = performance.now();
      try {
        const result = await ag.testUpstream([upstream], info.bootstrap_dns ?? []);
        const verdict = result[upstream] ?? "OK";
        results.push({ upstream, ok: verdict === "OK", ms: Math.round(performance.now() - start), message: verdict });
      } catch (error) {
        results.push({ upstream, ok: false, ms: Math.round(performance.now() - start), message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { results };
  });
}
