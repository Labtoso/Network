import { getNetworkState } from "@/lib/db";

const defaultUrl = "http://192.168.178.67:3001";

export function normalizeAdGuardUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getAdGuardConnection(url?: string, username?: string) {
  const policy = getNetworkState().policy;
  const configuredUrl = normalizeAdGuardUrl(process.env.ADGUARD_URL || defaultUrl);
  const baseUrl = normalizeAdGuardUrl(url || policy.adguardUrl || configuredUrl || defaultUrl);
  const user = process.env.ADGUARD_USER || username || policy.adguardUsername || "admin";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const password = process.env.ADGUARD_PASSWORD;
  if (password && baseUrl && baseUrl === configuredUrl) {
    headers.Authorization = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  }
  return { baseUrl, user, headers };
}
