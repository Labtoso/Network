import { ag } from "./adguard.js";
import { prisma } from "./db.js";

/**
 * Speichert die zuletzt bekannten Sperren lokal. Wird genutzt, wenn AdGuard Home
 * nicht erreichbar ist und "Letzte Sperren offline cachen & durchsetzen" aktiv ist.
 */
const blocked = new Set<string>();
let lastRefresh: Date | null = null;
let lastError: string | null = null;

const BLOCK_RULE = /^\|\|([a-z0-9.*_-]+)\^(\$important)?$/i;
const ALLOW_RULE = /^@@\|\|([a-z0-9._-]+)\^(\$important)?$/i;

export async function loadBlockCache(): Promise<void> {
  const rows = await prisma.blockCache.findMany({ select: { domain: true } });
  blocked.clear();
  for (const row of rows) blocked.add(row.domain);
}

export function isCachedBlocked(name: string): boolean {
  let domain = name.toLowerCase().replace(/\.$/, "");
  while (domain.includes(".")) {
    if (blocked.has(domain)) return true;
    domain = domain.slice(domain.indexOf(".") + 1);
  }
  return blocked.has(domain);
}

export function blockCacheInfo() {
  return { size: blocked.size, lastRefresh: lastRefresh?.toISOString() ?? null, lastError };
}

export function rememberBlocked(domain: string, source: string): void {
  const clean = domain.toLowerCase().replace(/\.$/, "");
  if (!clean || blocked.has(clean)) return;
  blocked.add(clean);
  void prisma.blockCache
    .upsert({ where: { domain: clean }, create: { domain: clean, source }, update: { source } })
    .catch(() => undefined);
}

function parseRules(rules: string[], source: string, target: Map<string, string>, allows: Set<string>): void {
  for (const raw of rules) {
    const rule = raw.trim();
    if (!rule || rule.startsWith("!") || rule.startsWith("#")) continue;
    const allow = ALLOW_RULE.exec(rule);
    if (allow) {
      allows.add(allow[1].toLowerCase());
      continue;
    }
    const block = BLOCK_RULE.exec(rule);
    if (block && !block[1].includes("*")) target.set(block[1].toLowerCase(), source);
  }
}

export async function refreshBlockCache(): Promise<void> {
  try {
    const next = new Map<string, string>();
    const allows = new Set<string>();
    const [filtering, services, all, log] = await Promise.all([
      ag.filtering(),
      ag.servicesGet(),
      ag.servicesAll(),
      ag.queryLog({ limit: 1000, response_status: "blocked" }),
    ]);
    parseRules(filtering.user_rules ?? [], "user_rules", next, allows);
    const activeIds = new Set(services.ids ?? []);
    for (const service of all.blocked_services ?? []) {
      if (activeIds.has(service.id)) parseRules(service.rules, `service:${service.id}`, next, allows);
    }
    for (const entry of log.data ?? []) {
      if (entry.reason.startsWith("Filtered") && entry.reason !== "FilteredSafeSearch") {
        next.set(entry.question.name.toLowerCase().replace(/\.$/, ""), "querylog");
      }
    }
    for (const domain of allows) next.delete(domain);

    await prisma.$transaction([
      prisma.blockCache.deleteMany({ where: { domain: { notIn: [...next.keys()] } } }),
      ...[...next.entries()].map(([domain, source]) =>
        prisma.blockCache.upsert({ where: { domain }, create: { domain, source }, update: { source } }),
      ),
    ]);
    blocked.clear();
    for (const domain of next.keys()) blocked.add(domain);
    lastRefresh = new Date();
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
}
