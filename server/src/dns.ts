import dnsPacket from "dns-packet";
import { isCachedBlocked } from "./blockcache.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { getAdGuardConnection, getRoaming } from "./settings.js";

const CLIENT_ID = /^[a-z0-9-]{1,63}$/;

interface DeviceInfo {
  id: string;
  enabled: boolean;
  fetchedAt: number;
}

const deviceCache = new Map<string, DeviceInfo | null>();
const lastSeenWrite = new Map<string, number>();

export function isValidClientId(value: string): boolean {
  return CLIENT_ID.test(value) && !value.startsWith("-") && !value.endsWith("-");
}

export function invalidateDevice(clientId: string): void {
  deviceCache.delete(clientId);
}

async function lookupDevice(clientId: string): Promise<DeviceInfo | null> {
  const cached = deviceCache.get(clientId);
  if (cached !== undefined && (cached === null ? Date.now() : cached.fetchedAt) > Date.now() - 30_000) {
    return cached;
  }
  const row = await prisma.roamingDevice.findUnique({ where: { clientId }, select: { id: true, enabled: true } });
  const info = row ? { ...row, fetchedAt: Date.now() } : null;
  deviceCache.set(clientId, info);
  if (!row) setTimeout(() => deviceCache.delete(clientId), 30_000).unref();
  return info;
}

const FLAG_QR = 0x8000;
const FLAG_RD = 0x0100;
const FLAG_RA = 0x0080;
const RCODE = { NOERROR: 0, SERVFAIL: 2, NXDOMAIN: 3, REFUSED: 5 } as const;

function safeDecode(wire: Buffer): dnsPacket.Packet | null {
  try {
    return dnsPacket.decode(wire);
  } catch {
    return null;
  }
}

function errorResponse(query: dnsPacket.Packet | null, wire: Buffer, rcode: number): Buffer {
  const id = query?.id ?? (wire.length >= 2 ? wire.readUInt16BE(0) : 0);
  return dnsPacket.encode({
    type: "response",
    id,
    flags: FLAG_QR | FLAG_RD | FLAG_RA | rcode,
    questions: query?.questions ?? [],
  });
}

/** Antwort fuer eine offline gesperrte Domain: 0.0.0.0 bzw. :: (wie AdGuards Standard-Blockmodus). */
function blockedResponse(query: dnsPacket.Packet): Buffer {
  const answers: dnsPacket.Answer[] = [];
  for (const question of query.questions ?? []) {
    if (question.type === "A") answers.push({ type: "A", name: question.name, ttl: 10, data: "0.0.0.0" });
    if (question.type === "AAAA") answers.push({ type: "AAAA", name: question.name, ttl: 10, data: "::" });
  }
  return dnsPacket.encode({
    type: "response",
    id: query.id,
    flags: FLAG_QR | FLAG_RD | FLAG_RA | RCODE.NOERROR,
    questions: query.questions,
    answers,
  });
}

async function postDoh(url: string, wire: Buffer, timeoutMs: number): Promise<Buffer> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" },
    body: new Uint8Array(wire),
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/dns-message")) throw new Error(`Unerwarteter Content-Type ${type}`);
  return Buffer.from(await response.arrayBuffer());
}

export interface DnsResult {
  body: Buffer;
  offline: boolean;
  refused: boolean;
}

/**
 * Kern fuer DoH und DoT: leitet die DNS-Nachricht mit der ClientID an AdGuard Home weiter
 * (AdGuard ordnet sie so dem richtigen Client mit dessen Regeln zu). Faellt AdGuard aus,
 * werden die zuletzt bekannten Sperren lokal durchgesetzt und der Rest ueber FALLBACK_DOH aufgeloest.
 */
export async function resolveDns(clientId: string, wire: Buffer, protocol: "doh" | "dot"): Promise<DnsResult> {
  const query = safeDecode(wire);
  if (!query || query.type !== "query") {
    return { body: errorResponse(query, wire, RCODE.REFUSED), offline: false, refused: true };
  }
  const device = isValidClientId(clientId) ? await lookupDevice(clientId) : null;
  if (!device || !device.enabled) {
    return { body: errorResponse(query, wire, RCODE.REFUSED), offline: false, refused: true };
  }

  let body: Buffer;
  let offline = false;
  const conn = await getAdGuardConnection();
  try {
    if (!conn.url) throw new Error("AdGuard nicht konfiguriert");
    body = await postDoh(`${conn.url}/dns-query/${clientId}`, wire, 2500);
  } catch {
    offline = true;
    const roaming = await getRoaming();
    if (!roaming.offlineCache) {
      body = errorResponse(query, wire, RCODE.SERVFAIL);
    } else if ((query.questions ?? []).some((question) => isCachedBlocked(question.name))) {
      body = blockedResponse(query);
    } else {
      try {
        body = await postDoh(config.fallbackDoh, wire, 4000);
      } catch {
        body = errorResponse(query, wire, RCODE.SERVFAIL);
      }
    }
  }

  const now = Date.now();
  if ((lastSeenWrite.get(clientId) ?? 0) < now - 60_000) {
    lastSeenWrite.set(clientId, now);
    void prisma.roamingDevice
      .update({
        where: { clientId },
        data: {
          lastSeenAt: new Date(),
          lastProtocol: protocol,
          queryCount: { increment: 1 },
          ...(offline ? { offlineAnswers: { increment: 1 } } : {}),
        },
      })
      .catch(() => undefined);
  }
  return { body, offline, refused: false };
}
