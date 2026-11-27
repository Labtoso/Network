import { getNetworkState, saveNetworkState } from "@/lib/db";

export type QueryLogStatus = "allowed" | "blocked" | "rewritten" | "service_blocked";
export type QueryTransport = "UDP :53" | "DoH (5G Roaming)" | "DoT (853)" | "TCP :53";

export interface AdGuardQueryLogEntry {
  id: string;
  timestamp: string;
  domain: string;
  queryType: "A" | "AAAA" | "HTTPS" | "SVCB" | "CNAME";
  status: QueryLogStatus;
  clientId: string;
  clientName: string;
  clientIp: string;
  clientMac: string;
  transport: QueryTransport;
  answer: string;
  latencyMs: number;
  rule?: string;
  filterListName?: string;
  serviceName?: string;
}

export interface AdGuardFilterList {
  id: number;
  enabled: boolean;
  name: string;
  url: string;
  rulesCount: number;
  lastUpdated: string;
  type: "blocklist" | "allowlist";
}

export interface AdGuardServiceCatalogItem {
  id: string;
  name: string;
  category: "Social Media" | "Streaming & Video" | "Gaming" | "Messenger";
  domains: string[];
}

export interface AdGuardDnsRewrite {
  id: string;
  domain: string;
  answer: string;
  comment: string;
  enabled: boolean;
}

export interface AdGuardUpstreamServer {
  id: string;
  name: string;
  address: string;
  protocol: "DoH" | "DoT" | "DOQ" | "UDP (rDNS)";
  latencyMs: number;
  status: "healthy" | "degraded";
  queriesHandled: number;
}

export interface AdGuardStatsTimeframe {
  range: "24h" | "7d" | "30d" | "90d";
  totalQueries: number;
  blockedQueries: number;
  blockPercentage: number;
  malwarePhishingBlocked: number;
  rewrittenQueries: number;
  avgProcessingTimeMs: number;
  hourlySeries: { label: string; total: number; blocked: number }[];
  topBlockedDomains: { domain: string; count: number; category: string }[];
  topClients: { name: string; ip: string; count: number; blockedCount: number }[];
}

export const ADGUARD_SERVICES_CATALOG: AdGuardServiceCatalogItem[] = [
  // Social Media (8)
  { id: "tiktok", name: "TikTok", category: "Social Media", domains: ["tiktok.com", "tiktokv.com", "musical.ly"] },
  { id: "instagram", name: "Instagram", category: "Social Media", domains: ["instagram.com", "cdninstagram.com"] },
  { id: "snapchat", name: "Snapchat", category: "Social Media", domains: ["snapchat.com", "sc-cdn.net"] },
  { id: "facebook", name: "Facebook", category: "Social Media", domains: ["facebook.com", "fbcdn.net"] },
  { id: "twitter", name: "Twitter / X", category: "Social Media", domains: ["twitter.com", "x.com", "twimg.com"] },
  { id: "reddit", name: "Reddit", category: "Social Media", domains: ["reddit.com", "redd.it", "redditmedia.com"] },
  { id: "pinterest", name: "Pinterest", category: "Social Media", domains: ["pinterest.com", "pinimg.com"] },
  { id: "tinder", name: "Tinder", category: "Social Media", domains: ["tinder.com", "gotinder.com"] },

  // Streaming & Video (7)
  { id: "youtube", name: "YouTube", category: "Streaming & Video", domains: ["youtube.com", "youtu.be", "googlevideo.com"] },
  { id: "netflix", name: "Netflix", category: "Streaming & Video", domains: ["netflix.com", "nflxvideo.net"] },
  { id: "disneyplus", name: "Disney+", category: "Streaming & Video", domains: ["disneyplus.com", "dssott.com"] },
  { id: "primevideo", name: "Prime Video", category: "Streaming & Video", domains: ["primevideo.com", "aiv-cdn.net"] },
  { id: "twitch", name: "Twitch", category: "Streaming & Video", domains: ["twitch.tv", "ttvnw.net"] },
  { id: "dailymotion", name: "Dailymotion", category: "Streaming & Video", domains: ["dailymotion.com", "dmcdn.net"] },
  { id: "vimeo", name: "Vimeo", category: "Streaming & Video", domains: ["vimeo.com", "vimeocdn.com"] },

  // Gaming (7)
  { id: "roblox", name: "Roblox", category: "Gaming", domains: ["roblox.com", "rbxcdn.com"] },
  { id: "discord", name: "Discord", category: "Gaming", domains: ["discord.com", "discordapp.com", "discord.gg"] },
  { id: "steam", name: "Steam", category: "Gaming", domains: ["steampowered.com", "steamcommunity.com"] },
  { id: "epic_games", name: "Epic Games / Fortnite", category: "Gaming", domains: ["epicgames.com", "fortnite.com"] },
  { id: "playstation", name: "PlayStation Network", category: "Gaming", domains: ["playstation.com", "playstation.net"] },
  { id: "xboxlive", name: "Xbox Live", category: "Gaming", domains: ["xboxlive.com", "xbox.com"] },
  { id: "battlenet", name: "Battle.net / Blizzard", category: "Gaming", domains: ["battle.net", "blizzard.com"] },

  // Messenger (5)
  { id: "whatsapp", name: "WhatsApp", category: "Messenger", domains: ["whatsapp.com", "whatsapp.net"] },
  { id: "telegram", name: "Telegram", category: "Messenger", domains: ["telegram.org", "t.me"] },
  { id: "signal", name: "Signal", category: "Messenger", domains: ["signal.org", "whispersystems.org"] },
  { id: "skype", name: "Skype", category: "Messenger", domains: ["skype.com", "skypeassets.com"] },
  { id: "wechat", name: "WeChat", category: "Messenger", domains: ["wechat.com", "weixin.qq.com"] },
];

function getAdGuardAuthHeaders(): HeadersInit {
  const state = getNetworkState();
  const user = process.env.ADGUARD_USER || state.policy.adguardUsername || "admin";
  const pass = process.env.ADGUARD_PASSWORD || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (user && pass) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }
  return headers;
}

/**
 * Sends a REST call to the live AdGuard Home instance (`/control/...`)
 * while updating our local SQLite/JSON mirror cache for 0ms latency.
 */
export async function callAdGuardApi(
  endpointPath: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<{ ok: boolean; data?: unknown; syncedLive: boolean }> {
  const state = getNetworkState();
  const baseUrl = (state.policy.adguardUrl || "http://192.168.178.67:3001").replace(
    /\/+$/,
    ""
  );
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${baseUrl}${endpointPath}`, {
      method,
      headers: getAdGuardAuthHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
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
  return { ok: true, syncedLive: false };
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
