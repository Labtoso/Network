import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Projektwurzel: funktioniert aus server/src (tsx) und dist-server/server/src (kompiliert). */
function findRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "prisma"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export const ROOT_DIR = findRoot(here);
loadDotenv({ path: path.join(ROOT_DIR, ".env") });

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value.trim();
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = (process.env[name] ?? "").toLowerCase();
  if (["1", "true", "yes", "ja", "on"].includes(value)) return true;
  if (["0", "false", "no", "nein", "off"].includes(value)) return false;
  return fallback;
}

const duckdnsDomain = str("DUCKDNS_DOMAIN").replace(/\.duckdns\.org$/i, "");
const customDomain = str("CUSTOM_DOMAIN");
const primaryHost = customDomain || (duckdnsDomain ? `${duckdnsDomain}.duckdns.org` : "localhost");

export const config = {
  rootDir: ROOT_DIR,
  host: str("HOST", "127.0.0.1"),
  port: int("PORT", 8787),
  publicUrl: str("PUBLIC_URL", `https://${primaryHost}`).replace(/\/+$/, ""),
  primaryHost,
  duckdnsDomain,
  customDomain,
  duckdnsStatusFile: str("DUCKDNS_STATUS_FILE", "/var/lib/network-admin/duckdns.json"),
  googleClientId: str("GOOGLE_CLIENT_ID"),
  allowedEmails: str("ALLOWED_EMAIL", "sebirauch2022@gmail.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
  jwtSecret: str("JWT_SECRET"),
  encryptionKey: str("ENCRYPTION_KEY"),
  sessionHours: int("SESSION_HOURS", 12),
  corsOrigins: str("CORS_ORIGINS", "https://admin.labtoso.de,https://labtoso.github.io")
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  adguardUrl: str("ADGUARD_URL").replace(/\/+$/, ""),
  adguardUser: str("ADGUARD_USER"),
  adguardPass: str("ADGUARD_PASS"),
  fallbackDoh: str("FALLBACK_DOH", "https://dns.quad9.net/dns-query"),
  dotEnabled: bool("DOT_ENABLED", true),
  dotPort: int("DOT_PORT", 853),
  caddyCertDir: str(
    "CADDY_CERT_DIR",
    "/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory",
  ),
  staticDir: str("STATIC_DIR", path.join(ROOT_DIR, "out")),
  trustProxy: bool("TRUST_PROXY", true),
  version: "3.0.0",
};

export function assertProductionConfig(): string[] {
  const problems: string[] = [];
  if (config.jwtSecret.length < 32) problems.push("JWT_SECRET fehlt oder ist kuerzer als 32 Zeichen.");
  if (config.encryptionKey.length < 32) problems.push("ENCRYPTION_KEY fehlt oder ist kuerzer als 32 Zeichen.");
  if (!config.googleClientId) problems.push("GOOGLE_CLIENT_ID fehlt, Google Login ist deaktiviert.");
  return problems;
}
