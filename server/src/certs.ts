import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export interface CertPair {
  certPem: string;
  keyPem: string;
  certPath: string;
  keyPath: string;
  mtimeMs: number;
}

/**
 * Sucht das von Caddy ausgestellte Zertifikat (Wildcard bevorzugt) im Caddy-Speicher.
 * Caddy legt pro Name einen Ordner an, z. B. "wildcard_.labtoso.duckdns.org".
 */
export function findCaddyCertificate(): CertPair | null {
  const base = config.caddyCertDir;
  if (!existsSync(base)) return null;
  const candidates = [`wildcard_.${config.primaryHost}`, config.primaryHost];
  if (config.duckdnsDomain) {
    candidates.push(`wildcard_.${config.duckdnsDomain}.duckdns.org`, `${config.duckdnsDomain}.duckdns.org`);
  }
  let entries: string[] = [];
  try {
    entries = readdirSync(base);
  } catch {
    return null;
  }
  for (const name of candidates) {
    if (!entries.includes(name)) continue;
    const certPath = path.join(base, name, `${name}.crt`);
    const keyPath = path.join(base, name, `${name}.key`);
    if (!existsSync(certPath) || !existsSync(keyPath)) continue;
    try {
      return {
        certPem: readFileSync(certPath, "utf8"),
        keyPem: readFileSync(keyPath, "utf8"),
        certPath,
        keyPath,
        mtimeMs: statSync(certPath).mtimeMs,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Trennt eine PEM-Kette in Einzelzertifikate (Leaf zuerst). */
export function splitPemChain(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}

/** Liefert die Wildcard-faehigen Hostnamen, unter denen DoT-Clients ihre ClientID als erstes Label senden. */
export function dotBaseHosts(): string[] {
  const hosts = new Set<string>([config.primaryHost]);
  if (config.duckdnsDomain) hosts.add(`${config.duckdnsDomain}.duckdns.org`);
  return [...hosts].filter((host) => host !== "localhost");
}
