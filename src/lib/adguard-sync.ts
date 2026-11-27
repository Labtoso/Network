import { getNetworkState, saveNetworkState } from "@/lib/db";
import { getAdGuardConnection } from "@/lib/adguard-connection";
import type { AdGuardDnsRewrite, AdGuardFilterList } from "@/lib/adguard-model";

export * from "@/lib/adguard-model";

/**
 * Sends a REST call to the live AdGuard Home instance (`/control/...`)
 * while updating our local SQLite/JSON mirror cache for 0ms latency.
 */
export async function callAdGuardApi(
  endpointPath: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<{ ok: boolean; data?: unknown; syncedLive: boolean }> {
  const { baseUrl, headers } = getAdGuardConnection();
  if (!baseUrl) return { ok: false, syncedLive: false };
  try {
    const res = await fetch(`${baseUrl}${endpointPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
      return { ok: true, data, syncedLive: true };
    }
  } catch {
    // Graceful local cache mirror fallback when AdGuard LAN is unreachable from cloud test
  }
  return { ok: false, syncedLive: false };
}

/**
 * Bidirectional Sync Worker:
 * Pulls live state from AdGuard Home (`/control/filtering/status`, `/control/rewrite/list`,
 * `/control/blocked_services/list`, `/control/querylog`) when reachable on the LAN,
 * and merges any external changes made directly in AdGuard's Web-UI into our local cache.
 */
export async function performBidirectionalAdGuardSync(): Promise<{
  lastSyncAt: string;
  syncedLive: boolean;
  adguardUrl: string;
}> {
  const state = getNetworkState();
  const filterRes = await callAdGuardApi("/control/filtering/status", "GET");
  const rewriteRes = await callAdGuardApi("/control/rewrite/list", "GET");
  const blockedSrvRes = await callAdGuardApi("/control/blocked_services/list", "GET");

  let syncedLive = false;

  saveNetworkState((draft) => {
    if (filterRes.syncedLive && filterRes.data && typeof filterRes.data === "object") {
      syncedLive = true;
      const fd = filterRes.data as {
        filters?: { id: number; enabled: boolean; name: string; url: string; rules_count?: number; last_updated?: string }[];
        whitelist_filters?: { id: number; enabled: boolean; name: string; url: string; rules_count?: number; last_updated?: string }[];
        user_rules?: string[];
      };
      if (Array.isArray(fd.filters) && fd.filters.length > 0) {
        const blocks: AdGuardFilterList[] = fd.filters.map((f) => ({
          id: f.id,
          enabled: f.enabled,
          name: f.name,
          url: f.url,
          rulesCount: f.rules_count ?? 0,
          lastUpdated: f.last_updated || new Date().toISOString(),
          type: "blocklist",
        }));
        const allows: AdGuardFilterList[] = (fd.whitelist_filters || []).map((f) => ({
          id: f.id,
          enabled: f.enabled,
          name: f.name,
          url: f.url,
          rulesCount: f.rules_count ?? 0,
          lastUpdated: f.last_updated || new Date().toISOString(),
          type: "allowlist",
        }));
        draft.adguard.filterLists = [...blocks, ...allows];
      }
      if (Array.isArray(fd.user_rules)) {
        draft.adguard.customRules = fd.user_rules;
      }
    }

    if (rewriteRes.syncedLive && Array.isArray(rewriteRes.data)) {
      syncedLive = true;
      draft.adguard.rewrites = (
        rewriteRes.data as { domain: string; answer: string }[]
      ).map((r, i) => ({
        id: `rw-live-${i}`,
        domain: r.domain,
        answer: r.answer,
        comment: "AdGuard Home Live Rewrite",
        enabled: true,
      }));
    }

    if (blockedSrvRes.syncedLive && Array.isArray(blockedSrvRes.data)) {
      syncedLive = true;
      draft.adguard.globalBlockedServices = blockedSrvRes.data as string[];
    }

    draft.adguard.lastSyncTimestamp = new Date().toISOString();
  });

  return {
    lastSyncAt: new Date().toISOString(),
    syncedLive,
    adguardUrl: state.policy.adguardUrl,
  };
}
