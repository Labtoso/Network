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
