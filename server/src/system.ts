import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { config } from "./config.js";

const run = promisify(execFile);

async function safe(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run(cmd, args, { timeout: 3000, cwd: config.rootDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

export interface DuckDnsStatus {
  ok: boolean;
  ipv4: string | null;
  ipv6: string | null;
  changed: boolean;
  checkedAt: string | null;
  message: string;
}

export async function readDuckDnsStatus(): Promise<DuckDnsStatus> {
  try {
    const raw = JSON.parse(await readFile(config.duckdnsStatusFile, "utf8"));
    return {
      ok: raw.ok === true,
      ipv4: raw.ipv4 || null,
      ipv6: raw.ipv6 || null,
      changed: raw.changed === true,
      checkedAt: raw.checkedAt ?? null,
      message: String(raw.message ?? ""),
    };
  } catch {
    return { ok: false, ipv4: null, ipv6: null, changed: false, checkedAt: null, message: "Noch kein DuckDNS-Update gelaufen." };
  }
}

function localIps(): string[] {
  const result: string[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (name.startsWith("tailscale") || name === "lo") continue;
    for (const addr of list ?? []) if (addr.family === "IPv4" && !addr.internal) result.push(addr.address);
  }
  return result;
}

export async function systemInfo() {
  const [commit, branch, tailscaleIp] = await Promise.all([
    safe("git", ["rev-parse", "--short", "HEAD"]),
    safe("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    safe("tailscale", ["ip", "-4"]),
  ]);
  const memory = process.memoryUsage();
  return {
    version: config.version,
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    hostname: os.hostname(),
    uptimeSeconds: Math.round(process.uptime()),
    systemUptimeSeconds: Math.round(os.uptime()),
    load: os.loadavg(),
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, systemTotal: os.totalmem(), systemFree: os.freemem() },
    git: { commit, branch },
    network: {
      localIps: localIps(),
      tailscaleIp: tailscaleIp?.split("\n")[0] ?? null,
      publicUrl: config.publicUrl,
      duckdnsDomain: config.duckdnsDomain ? `${config.duckdnsDomain}.duckdns.org` : null,
      customDomain: config.customDomain || null,
    },
  };
}
