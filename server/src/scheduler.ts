import { ag } from "./adguard.js";
import { refreshBlockCache } from "./blockcache.js";
import { prisma } from "./db.js";
import { audit } from "./audit.js";

type Logger = { info: (msg: string) => void; warn: (msg: string) => void };

/** Entfernt abgelaufene temporaere Freigaben wieder aus den AdGuard-Benutzerregeln. */
export async function expireAccessGrants(log: Logger): Promise<void> {
  const expired = await prisma.accessRequest.findMany({
    where: { status: "approved", expiresAt: { lte: new Date() } },
  });
  if (expired.length === 0) return;
  try {
    const filtering = await ag.filtering();
    const remove = new Set(expired.map((row) => row.ruleText).filter((rule): rule is string => Boolean(rule)));
    const still = new Set(
      (
        await prisma.accessRequest.findMany({
          where: { status: "approved", expiresAt: { gt: new Date() } },
          select: { ruleText: true },
        })
      ).map((row) => row.ruleText),
    );
    const next = (filtering.user_rules ?? []).filter((rule) => !remove.has(rule) || still.has(rule));
    if (next.length !== (filtering.user_rules ?? []).length) await ag.setUserRules(next);
    await prisma.accessRequest.updateMany({
      where: { id: { in: expired.map((row) => row.id) } },
      data: { status: "expired" },
    });
    for (const row of expired) await audit("system", "access.expired", { domain: row.domain, client: row.clientName });
  } catch (error) {
    log.warn(`Freigaben konnten nicht zurueckgenommen werden: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function timed(target: string, fn: () => Promise<unknown>): Promise<void> {
  const start = performance.now();
  try {
    await fn();
    await prisma.latencySample.create({ data: { target, ms: Math.round(performance.now() - start), ok: true } });
  } catch (error) {
    await prisma.latencySample.create({
      data: { target, ms: Math.round(performance.now() - start), ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 300) },
    });
  }
}

/** Misst AdGuard selbst und jeden konfigurierten Upstream einzeln (ueber AdGuards test_upstream_dns). */
export async function sampleLatency(): Promise<void> {
  await timed("adguard", () => ag.status());
  try {
    const info = await ag.dnsInfo();
    const upstreams = (info.upstream_dns ?? []).filter((line) => line && !line.startsWith("#")).slice(0, 8);
    for (const upstream of upstreams) {
      await timed(upstream, async () => {
        const result = await ag.testUpstream([upstream], info.bootstrap_dns ?? []);
        const verdict = result[upstream];
        if (verdict && verdict !== "OK") throw new Error(verdict);
      });
    }
  } catch {
    /* AdGuard nicht erreichbar: bereits als "adguard"-Fehler protokolliert. */
  }
  await prisma.latencySample.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
}

export function startScheduler(log: Logger): void {
  const every = (ms: number, fn: () => Promise<void>, name: string) => {
    const wrapped = () => fn().catch((error) => log.warn(`${name}: ${error instanceof Error ? error.message : String(error)}`));
    setTimeout(wrapped, 5000).unref();
    setInterval(wrapped, ms).unref();
  };
  every(30_000, () => expireAccessGrants(log), "Freigaben");
  every(5 * 60_000, refreshBlockCache, "Sperr-Cache");
  every(5 * 60_000, sampleLatency, "Latenz");
  every(24 * 3600_000, async () => {
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
    await prisma.accessRequest.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) }, status: { not: "pending" } } });
  }, "Aufraeumen");
}
