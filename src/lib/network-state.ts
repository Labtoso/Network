import { ALLOWED_OWNER_EMAIL, PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";
import type {
  AdGuardDnsRewrite,
  AdGuardFilterList,
  AdGuardQueryLogEntry,
  AdGuardStatsTimeframe,
  AdGuardUpstreamServer,
} from "@/lib/adguard-model";

export type DeviceCategory = "apple" | "android" | "pc" | "console" | "tv" | "iot";
export type DeviceRole = "admin" | "child" | "guest" | "server";

export type AppBlockId =
  | "tiktok"
  | "youtube"
  | "roblox"
  | "fortnite"
  | "instagram"
  | "snapchat"
  | "discord"
  | "twitch"
  | "netflix"
  | "nsfw"
  | "facebook"
  | "twitter"
  | "reddit"
  | "pinterest"
  | "tinder"
  | "disneyplus"
  | "primevideo"
  | "dailymotion"
  | "vimeo"
  | "steam"
  | "epic_games"
  | "playstation"
  | "xboxlive"
  | "battlenet"
  | "whatsapp"
  | "telegram"
  | "signal"
  | "skype"
  | "wechat";

export interface AppBlockDefinition {
  id: AppBlockId;
  name: string;
  category: "Social" | "Gaming" | "Video" | "Safety";
  domains: string[];
  adguardServiceId: string;
}

export const BLOCKABLE_APPS: AppBlockDefinition[] = [
  {
    id: "tiktok",
    name: "TikTok",
    category: "Social",
    domains: ["tiktok.com", "tiktokv.com", "musical.ly", "byteoversea.com"],
    adguardServiceId: "tiktok",
  },
  {
    id: "youtube",
    name: "YouTube & Shorts",
    category: "Video",
    domains: ["youtube.com", "youtu.be", "googlevideo.com", "ytimg.com"],
    adguardServiceId: "youtube",
  },
  {
    id: "roblox",
    name: "Roblox",
    category: "Gaming",
    domains: ["roblox.com", "rbxcdn.com", "robloxlabs.com"],
    adguardServiceId: "roblox",
  },
  {
    id: "fortnite",
    name: "Fortnite / Epic",
    category: "Gaming",
    domains: ["fortnite.com", "epicgames.com", "unrealengine.com"],
    adguardServiceId: "epic_games",
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "Social",
    domains: ["instagram.com", "cdninstagram.com"],
    adguardServiceId: "instagram",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    category: "Social",
    domains: ["snapchat.com", "sc-cdn.net", "snap-dev.net"],
    adguardServiceId: "snapchat",
  },
  {
    id: "discord",
    name: "Discord",
    category: "Social",
    domains: ["discord.com", "discordapp.com", "discord.gg"],
    adguardServiceId: "discord",
  },
  {
    id: "twitch",
    name: "Twitch",
    category: "Video",
    domains: ["twitch.tv", "ttvnw.net", "jtvnw.net"],
    adguardServiceId: "twitch",
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "Video",
    domains: ["netflix.com", "nflxvideo.net", "nflximg.net"],
    adguardServiceId: "netflix",
  },
  {
    id: "nsfw",
    name: "NSFW & Adult Filter",
    category: "Safety",
    domains: ["pornhub.com", "xvideos.com", "xnxx.com", "onlyfans.com"],
    adguardServiceId: "adult",
  },
];

export interface ClientDeviceProfile {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  mac: string;
  ouiVendor: string;
  deviceType: DeviceCategory;
  role: DeviceRole;
  isAdminProtected: boolean;
  connectionType: "WLAN (Heimnetz)" | "5G / LTE Roaming (DoH)" | "Hotspot (DoT Protected)" | "LAN Gigabit";
  roamingEnforced: boolean;
  offlineCacheLock: boolean;
  unremovableProfile: boolean;
  paused: boolean;
  bedtimeLocked: boolean;
  dailyLimitMinutes: number;
  usedMinutesToday: number;
  bonusMinutesToday: number;
  blockedApps: string[];
  weeklySchedule: Record<string, boolean[]>;
  bandwidthMbps: number;
  queriesToday: number;
  blockedToday: number;
  lastActiveDomain: string;
  unblockGrantedUntil: string | null;
}

export interface BlockPageStudioConfig {
  mode: "redirect" | "studio" | "code";
  redirectUrl: string;
  title: string;
  subtitle: string;
  alarmMessage: string;
  curfewReason: string;
  showCountdown: boolean;
  countdownMinutes: number;
  allowUnblockRequest: boolean;
  customHtml: string;
  sslRootCaGenerated: boolean;
  sslRootCaFingerprint: string;
}

export interface UnblockRequestItem {
  id: string;
  clientId: string;
  clientName: string;
  domain: string;
  requestedMinutes: number;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  grantedUntil?: string;
}

export interface BlockedQueryEvent {
  id: string;
  timestamp: string;
  clientId: string;
  clientName: string;
  domain: string;
  appCategory: string;
  transport: "DoH (5G Roaming)" | "DoT (Hotspot)" | "WLAN DNS (:53)";
  action: "BLOCKED (Block Studio)" | "CACHED LOCK" | "REDIRECTED";
}

export interface GlobalPolicySettings {
  killSwitchActive: boolean;
  bedtimeActive: boolean;
  roamingEnforcement: boolean;
  offlineCacheLock: boolean;
  adguardUrl: string;
  adguardUsername: string;
  adguardConnected: boolean;
  adguardVersion: string;
  rdnsActive: boolean;
  routerGateway: string;
  adminEmail: string;
  adminDeviceWhitelisted: boolean;
  onboardingCompleted: boolean;
  dohEndpointBase: string;
  dotHostnameBase: string;
}

export interface AdGuardMirrorState {
  filteringEnabled: boolean;
  safeBrowsingEnabled: boolean;
  parentalEnabled: boolean;
  safeSearchEnabled: boolean;
  lastSyncTimestamp: string;
  filterLists: AdGuardFilterList[];
  customRules: string[];
  globalBlockedServices: string[];
  rewrites: AdGuardDnsRewrite[];
  queryLog: AdGuardQueryLogEntry[];
  upstreams: AdGuardUpstreamServer[];
  statsByRange: Record<"24h" | "7d" | "30d" | "90d", AdGuardStatsTimeframe>;
}

export interface NetworkControlState {
  policy: GlobalPolicySettings;
  devices: ClientDeviceProfile[];
  blockPage: BlockPageStudioConfig;
  unblockRequests: UnblockRequestItem[];
  blockedStream: BlockedQueryEvent[];
  adguard: AdGuardMirrorState;
}

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function createDefaultSchedule(role: DeviceRole): Record<string, boolean[]> {
  const schedule: Record<string, boolean[]> = {};
  for (const day of DAYS) {
    const isWeekend = day === "Sa" || day === "So";
    schedule[day] = Array.from({ length: 24 }, (_, hour) => {
      if (role === "admin" || role === "server") return true;
      if (role === "child") {
        return isWeekend ? hour >= 8 && hour <= 21 : hour >= 7 && hour <= 19;
      }
      return hour >= 8 && hour <= 22;
    });
  }
  return schedule;
}

const DEFAULT_CUSTOM_HTML = `<div class="p-6 rounded-2xl border border-emerald-500/30 bg-black/90 text-center space-y-4 font-mono">
  <div class="text-xs uppercase tracking-widest text-emerald-400">LABTOSO ZERO-TRUST SINKHOLE</div>
  <h1 class="text-2xl font-bold text-white">{domain} ist gesperrt</h1>
  <p class="text-sm text-zinc-400">Gerät: <strong class="text-white">{client_name}</strong> · Grund: {curfew_reason}</p>
  <div class="text-xs text-emerald-300">Automatische Freigabe in {time_remaining}</div>
</div>`;

function buildStatsTimeframe(
  range: "24h" | "7d" | "30d" | "90d",
  multiplier: number
): AdGuardStatsTimeframe {
  const totalQueries = Math.round(28450 * multiplier);
  const blockedQueries = Math.round(7420 * multiplier);
  const blockPercentage = Number(((blockedQueries / totalQueries) * 100).toFixed(1));
  const points =
    range === "24h"
      ? ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "Jetzt"]
      : range === "7d"
      ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      : range === "30d"
      ? ["Woche 1", "Woche 2", "Woche 3", "Woche 4"]
      : ["Monat 1", "Monat 2", "Monat 3"];

  return {
    range,
    totalQueries,
    blockedQueries,
    blockPercentage,
    malwarePhishingBlocked: Math.round(418 * multiplier),
    rewrittenQueries: Math.round(1190 * multiplier),
    avgProcessingTimeMs: 3.2,
    hourlySeries: points.map((label, idx) => {
      const wave = 0.65 + Math.sin(idx * 0.9) * 0.35;
      const t = Math.round((totalQueries / points.length) * wave);
      const b = Math.round((blockedQueries / points.length) * wave);
      return { label, total: t, blocked: b };
    }),
    topBlockedDomains: [
      { domain: "log.tiktokv.com", count: Math.round(1480 * multiplier), category: "TikTok Telemetry" },
      { domain: "metrics.icloud.com", count: Math.round(920 * multiplier), category: "Tracker (HaGeZi PRO)" },
      { domain: "presence.roblox.com", count: Math.round(810 * multiplier), category: "Roblox Service Block" },
      { domain: "googleads.g.doubleclick.net", count: Math.round(745 * multiplier), category: "AdGuard Base Filter" },
      { domain: "api2.musical.ly", count: Math.round(612 * multiplier), category: "TikTok Mobile API" },
      { domain: "graph.instagram.com", count: Math.round(490 * multiplier), category: "Social Block" },
      { domain: "telemetry.epicgames.com", count: Math.round(380 * multiplier), category: "Gaming Block" },
    ],
    topClients: [
      { name: "Predator-PC (Sebastian Admin)", ip: "192.168.178.24", count: Math.round(9420 * multiplier), blockedCount: Math.round(610 * multiplier) },
      { name: "ZimaOS & Proxmox Core", ip: "192.168.178.67", count: Math.round(6840 * multiplier), blockedCount: Math.round(24 * multiplier) },
      { name: "Jonas iPhone 15 (5G DoH)", ip: "192.168.178.42", count: Math.round(4910 * multiplier), blockedCount: Math.round(2840 * multiplier) },
      { name: "Galaxy S24 (Mobil / Hotspot)", ip: "192.168.178.51", count: Math.round(3820 * multiplier), blockedCount: Math.round(2110 * multiplier) },
      { name: "Lena iPad Air", ip: "192.168.178.45", count: Math.round(2340 * multiplier), blockedCount: Math.round(1490 * multiplier) },
      { name: "PlayStation 5 Wohnzimmer", ip: "192.168.178.62", count: Math.round(1120 * multiplier), blockedCount: Math.round(346 * multiplier) },
    ],
  };
}

export const INITIAL_STATE: NetworkControlState = {
  policy: {
    killSwitchActive: false,
    bedtimeActive: false,
    roamingEnforcement: true,
    offlineCacheLock: true,
    adguardUrl: process.env.ADGUARD_URL || "http://192.168.178.67:3001",
    adguardUsername: "admin",
    adguardConnected: false,
    adguardVersion: "",
    rdnsActive: true,
    routerGateway: "192.168.178.1 (FRITZ!Box 6660 Cable)",
    adminEmail: ALLOWED_OWNER_EMAIL,
    adminDeviceWhitelisted: true,
    onboardingCompleted: false,
    dohEndpointBase: `https://${PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query`,
    dotHostnameBase: `dot.labtoso.de`,
  },
  devices: [
    {
      id: "predator-pc",
      name: "Predator-PC (Sebastian Admin)",
      hostname: "Predator-PC.fritz.box",
      ip: "192.168.178.24",
      mac: "A8:A1:59:4E:12:01",
      ouiVendor: "Micro-Star Int'l / Acer Predator",
      deviceType: "pc",
      role: "admin",
      isAdminProtected: true,
      connectionType: "LAN Gigabit",
      roamingEnforced: false,
      offlineCacheLock: false,
      unremovableProfile: false,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 1440,
      usedMinutesToday: 310,
      bonusMinutesToday: 0,
      blockedApps: [],
      weeklySchedule: createDefaultSchedule("admin"),
      bandwidthMbps: 48.6,
      queriesToday: 4820,
      blockedToday: 312,
      lastActiveDomain: "github.com",
      unblockGrantedUntil: null,
    },
    {
      id: "jonas-iphone",
      name: "Jonas iPhone 15",
      hostname: "Jonas-iPhone.fritz.box",
      ip: "192.168.178.42",
      mac: "F0:18:98:7C:3A:19",
      ouiVendor: "Apple, Inc.",
      deviceType: "apple",
      role: "child",
      isAdminProtected: false,
      connectionType: "5G / LTE Roaming (DoH)",
      roamingEnforced: true,
      offlineCacheLock: true,
      unremovableProfile: true,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 120,
      usedMinutesToday: 95,
      bonusMinutesToday: 0,
      blockedApps: ["tiktok", "roblox", "epic_games", "nsfw"],
      weeklySchedule: createDefaultSchedule("child"),
      bandwidthMbps: 14.2,
      queriesToday: 3190,
      blockedToday: 845,
      lastActiveDomain: "youtube.com",
      unblockGrantedUntil: null,
    },
    {
      id: "lena-ipad",
      name: "Lena iPad Air",
      hostname: "Lena-iPad.fritz.box",
      ip: "192.168.178.45",
      mac: "BC:D0:74:22:91:08",
      ouiVendor: "Apple, Inc.",
      deviceType: "apple",
      role: "child",
      isAdminProtected: false,
      connectionType: "WLAN (Heimnetz)",
      roamingEnforced: true,
      offlineCacheLock: true,
      unremovableProfile: true,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 90,
      usedMinutesToday: 88,
      bonusMinutesToday: 0,
      blockedApps: ["tiktok", "instagram", "snapchat", "tinder", "nsfw"],
      weeklySchedule: createDefaultSchedule("child"),
      bandwidthMbps: 8.7,
      queriesToday: 1940,
      blockedToday: 512,
      lastActiveDomain: "roblox.com",
      unblockGrantedUntil: null,
    },
    {
      id: "galaxy-s24",
      name: "Galaxy S24 (Mobil / Hotspot)",
      hostname: "Galaxy-S24.fritz.box",
      ip: "192.168.178.51",
      mac: "50:85:69:1B:44:E2",
      ouiVendor: "Samsung Electronics Co.",
      deviceType: "android",
      role: "child",
      isAdminProtected: false,
      connectionType: "Hotspot (DoT Protected)",
      roamingEnforced: true,
      offlineCacheLock: true,
      unremovableProfile: true,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 150,
      usedMinutesToday: 110,
      bonusMinutesToday: 0,
      blockedApps: ["tiktok", "epic_games", "tinder", "nsfw"],
      weeklySchedule: createDefaultSchedule("child"),
      bandwidthMbps: 6.4,
      queriesToday: 2410,
      blockedToday: 620,
      lastActiveDomain: "tiktok.com",
      unblockGrantedUntil: null,
    },
    {
      id: "ps5-console",
      name: "PlayStation 5 Wohnzimmer",
      hostname: "PS5-Console.fritz.box",
      ip: "192.168.178.62",
      mac: "78:C8:81:99:0A:55",
      ouiVendor: "Sony Interactive Entertainment",
      deviceType: "console",
      role: "child",
      isAdminProtected: false,
      connectionType: "LAN Gigabit",
      roamingEnforced: false,
      offlineCacheLock: true,
      unremovableProfile: false,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 120,
      usedMinutesToday: 65,
      bonusMinutesToday: 0,
      blockedApps: ["tiktok", "nsfw"],
      weeklySchedule: createDefaultSchedule("child"),
      bandwidthMbps: 32.1,
      queriesToday: 1120,
      blockedToday: 94,
      lastActiveDomain: "playstation.net",
      unblockGrantedUntil: null,
    },
    {
      id: "zimaos-server",
      name: "ZimaOS & Proxmox Core",
      hostname: "zimaos.fritz.box",
      ip: "192.168.178.67",
      mac: "00:E0:4C:68:01:67",
      ouiVendor: "IceWhale / Proxmox Node",
      deviceType: "pc",
      role: "server",
      isAdminProtected: true,
      connectionType: "LAN Gigabit",
      roamingEnforced: false,
      offlineCacheLock: false,
      unremovableProfile: false,
      paused: false,
      bedtimeLocked: false,
      dailyLimitMinutes: 1440,
      usedMinutesToday: 1440,
      bonusMinutesToday: 0,
      blockedApps: [],
      weeklySchedule: createDefaultSchedule("server"),
      bandwidthMbps: 19.4,
      queriesToday: 8930,
      blockedToday: 12,
      lastActiveDomain: "cloudflare.com",
      unblockGrantedUntil: null,
    },
  ],
  blockPage: {
    mode: "studio",
    redirectUrl: "https://de.wikipedia.org",
    title: "ZUGRIFF VERWEIGERT // ZERO-TRUST POLICY",
    subtitle: "Labtoso Network Control Suite · Roaming & Heimnetz-Schutz aktiv",
    alarmMessage:
      "Zugriff verweigert: {domain} ist für {client_name} während der aktuellen Richtlinie ({curfew_reason}) gesperrt!",
    curfewReason: "Lernzeit & App-Sperre (Anti-Bypass DoH aktiv)",
    showCountdown: true,
    countdownMinutes: 42,
    allowUnblockRequest: true,
    customHtml: DEFAULT_CUSTOM_HTML,
    sslRootCaGenerated: true,
    sslRootCaFingerprint: "SHA256:8F:4B:19:C2:E0:77:4A:91:3C:D8:12:0A:6B:55:F1:9E:LABTOSO:CA",
  },
  unblockRequests: [
    {
      id: "req-101",
      clientId: "jonas-iphone",
      clientName: "Jonas iPhone 15",
      domain: "youtube.com",
      requestedMinutes: 30,
      reason: "Jonas bittet um 30 Min Freigabe für YouTube (Schul-Erklärvideo)",
      status: "pending",
      createdAt: "Vor 2 Min (via 5G Roaming DoH)",
    },
    {
      id: "req-102",
      clientId: "lena-ipad",
      clientName: "Lena iPad Air",
      domain: "roblox.com",
      requestedMinutes: 15,
      reason: "Lena bittet um 15 Min Bonus-Spielzeit für Roblox",
      status: "pending",
      createdAt: "Vor 6 Min (via Heim-WLAN)",
    },
  ],
  blockedStream: [
    {
      id: "ev-1",
      timestamp: "22:40:12",
      clientId: "jonas-iphone",
      clientName: "Jonas iPhone 15",
      domain: "log.tiktokv.com",
      appCategory: "TikTok",
      transport: "DoH (5G Roaming)",
      action: "BLOCKED (Block Studio)",
    },
    {
      id: "ev-2",
      timestamp: "22:40:09",
      clientId: "galaxy-s24",
      clientName: "Galaxy S24 (Mobil / Hotspot)",
      domain: "api2.musical.ly",
      appCategory: "TikTok",
      transport: "DoT (Hotspot)",
      action: "CACHED LOCK",
    },
    {
      id: "ev-3",
      timestamp: "22:39:58",
      clientId: "lena-ipad",
      clientName: "Lena iPad Air",
      domain: "presence.roblox.com",
      appCategory: "Roblox",
      transport: "WLAN DNS (:53)",
      action: "BLOCKED (Block Studio)",
    },
  ],
  adguard: {
    filteringEnabled: true,
    safeBrowsingEnabled: true,
    parentalEnabled: true,
    safeSearchEnabled: false,
    lastSyncTimestamp: new Date().toISOString(),
    filterLists: [
      {
        id: 1,
        enabled: true,
        name: "AdGuard DNS filter",
        url: "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
        rulesCount: 64920,
        lastUpdated: "2026-11-27 21:45",
        type: "blocklist",
      },
      {
        id: 2,
        enabled: true,
        name: "HaGeZi Multi PRO",
        url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt",
        rulesCount: 318450,
        lastUpdated: "2026-11-27 22:10",
        type: "blocklist",
      },
      {
        id: 3,
        enabled: true,
        name: "HaGeZi NSFW Blocklist",
        url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/nsfw.txt",
        rulesCount: 54110,
        lastUpdated: "2026-11-27 22:10",
        type: "blocklist",
      },
      {
        id: 4,
        enabled: false,
        name: "AdAway Default Blocklist",
        url: "https://adaway.org/hosts.txt",
        rulesCount: 8420,
        lastUpdated: "2026-11-26 18:00",
        type: "blocklist",
      },
      {
        id: 101,
        enabled: true,
        name: "HaGeZi Referral & Anti-False-Positive Allowlist",
        url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/whitelist-referral.txt",
        rulesCount: 4120,
        lastUpdated: "2026-11-27 22:00",
        type: "allowlist",
      },
      {
        id: 102,
        enabled: true,
        name: "Labtoso Zero-Trust Infrastructure Allowlist",
        url: "https://admin.labtoso.de/allowlist.txt",
        rulesCount: 38,
        lastUpdated: "2026-11-27 22:30",
        type: "allowlist",
      },
    ],
    customRules: [
      "! --- LABTOSO ZERO-TRUST & HOMESERVER CUSTOM RULES ---",
      "@@||admin.labtoso.de^$important",
      "@@||bot.labtoso.de^$important",
      "@@||musik.labtoso.de^$important",
      "@@||github.com^$client='192.168.178.24',important",
      "||tiktok.com^$client='192.168.178.42',important",
      "||tiktokv.com^$client='192.168.178.42',important",
      "||roblox.com^$client='192.168.178.45',important",
      "||pornhub.com^$important",
      "||xvideos.com^$important",
    ],
    globalBlockedServices: ["tinder"],
    rewrites: [
      {
        id: "rw-1",
        domain: "admin.labtoso.de",
        answer: "192.168.178.67",
        comment: "Zero-Trust Network Control Center (Local Split-DNS)",
        enabled: true,
      },
      {
        id: "rw-2",
        domain: "zimaos.home",
        answer: "192.168.178.67",
        comment: "ZimaOS Homeserver & Docker Host",
        enabled: true,
      },
      {
        id: "rw-3",
        domain: "adguard.home",
        answer: "192.168.178.67",
        comment: "AdGuard Home DNS Core",
        enabled: true,
      },
      {
        id: "rw-4",
        domain: "proxmox.home",
        answer: "192.168.178.103",
        comment: "Proxmox VE Hypervisor Node",
        enabled: true,
      },
      {
        id: "rw-5",
        domain: "fritz.home",
        answer: "192.168.178.1",
        comment: "FRITZ!Box 6660 Cable Gateway",
        enabled: true,
      },
    ],
    queryLog: [
      {
        id: "ql-1001",
        timestamp: "22:43:18.402",
        domain: "log.tiktokv.com",
        queryType: "HTTPS",
        status: "service_blocked",
        clientId: "jonas-iphone",
        clientName: "Jonas iPhone 15",
        clientIp: "192.168.178.42",
        clientMac: "F0:18:98:7C:3A:19",
        transport: "DoH (5G Roaming)",
        answer: "BLOCKING_PAGE (192.168.178.67)",
        latencyMs: 2.4,
        rule: "||tiktokv.com^",
        filterListName: "Blocked Service: TikTok",
        serviceName: "TikTok",
      },
      {
        id: "ql-1002",
        timestamp: "22:43:16.910",
        domain: "api.github.com",
        queryType: "A",
        status: "allowed",
        clientId: "predator-pc",
        clientName: "Predator-PC (Sebastian Admin)",
        clientIp: "192.168.178.24",
        clientMac: "A8:A1:59:4E:12:01",
        transport: "UDP :53",
        answer: "140.82.121.6 (TTL 60)",
        latencyMs: 4.1,
        rule: "@@||github.com^$client='192.168.178.24'",
        filterListName: "Admin Whitelist",
      },
      {
        id: "ql-1003",
        timestamp: "22:43:14.118",
        domain: "googleads.g.doubleclick.net",
        queryType: "A",
        status: "blocked",
        clientId: "galaxy-s24",
        clientName: "Galaxy S24 (Mobil / Hotspot)",
        clientIp: "192.168.178.51",
        clientMac: "50:85:69:1B:44:E2",
        transport: "DoT (853)",
        answer: "0.0.0.0 (NXDOMAIN)",
        latencyMs: 1.8,
        rule: "||doubleclick.net^",
        filterListName: "HaGeZi Multi PRO",
      },
      {
        id: "ql-1004",
        timestamp: "22:43:11.605",
        domain: "proxmox.home",
        queryType: "A",
        status: "rewritten",
        clientId: "predator-pc",
        clientName: "Predator-PC (Sebastian Admin)",
        clientIp: "192.168.178.24",
        clientMac: "A8:A1:59:4E:12:01",
        transport: "UDP :53",
        answer: "192.168.178.103 (DNS Rewrite)",
        latencyMs: 0.4,
        rule: "Rewrite: proxmox.home -> 192.168.178.103",
        filterListName: "DNS Rewrites",
      },
      {
        id: "ql-1005",
        timestamp: "22:43:08.229",
        domain: "presence.roblox.com",
        queryType: "A",
        status: "service_blocked",
        clientId: "lena-ipad",
        clientName: "Lena iPad Air",
        clientIp: "192.168.178.45",
        clientMac: "BC:D0:74:22:91:08",
        transport: "UDP :53",
        answer: "BLOCKING_PAGE (192.168.178.67)",
        latencyMs: 1.2,
        rule: "||roblox.com^$client='192.168.178.45'",
        filterListName: "Blocked Service: Roblox",
        serviceName: "Roblox",
      },
      {
        id: "ql-1006",
        timestamp: "22:43:05.774",
        domain: "musik.labtoso.de",
        queryType: "A",
        status: "allowed",
        clientId: "predator-pc",
        clientName: "Predator-PC (Sebastian Admin)",
        clientIp: "192.168.178.24",
        clientMac: "A8:A1:59:4E:12:01",
        transport: "UDP :53",
        answer: "172.67.148.92 (Cloudflare Proxy)",
        latencyMs: 6.2,
        rule: "@@||musik.labtoso.de^$important",
        filterListName: "Custom Rules",
      },
      {
        id: "ql-1007",
        timestamp: "22:43:01.008",
        domain: "pornhub.com",
        queryType: "A",
        status: "blocked",
        clientId: "galaxy-s24",
        clientName: "Galaxy S24 (Mobil / Hotspot)",
        clientIp: "192.168.178.51",
        clientMac: "50:85:69:1B:44:E2",
        transport: "DoT (853)",
        answer: "BLOCKING_PAGE (192.168.178.67)",
        latencyMs: 1.5,
        rule: "||pornhub.com^",
        filterListName: "HaGeZi NSFW Blocklist",
      },
    ],
    upstreams: [
      {
        id: "up-cf",
        name: "Cloudflare Zero-Trust DNS",
        address: "https://dns.cloudflare.com/dns-query",
        protocol: "DoH",
        latencyMs: 8.4,
        status: "healthy",
        queriesHandled: 16420,
      },
      {
        id: "up-quad9",
        name: "Quad9 Security DNS (Malware Filter)",
        address: "tls://dns.quad9.net:853",
        protocol: "DoT",
        latencyMs: 11.2,
        status: "healthy",
        queriesHandled: 9120,
      },
      {
        id: "up-mullvad",
        name: "Mullvad Privacy DoH",
        address: "https://doh.mullvad.net/dns-query",
        protocol: "DoH",
        latencyMs: 14.7,
        status: "healthy",
        queriesHandled: 2110,
      },
      {
        id: "up-fritz",
        name: "FRITZ!Box 6660 Cable (Private rDNS)",
        address: "192.168.178.1:53 ([/fritz.box/])",
        protocol: "UDP (rDNS)",
        latencyMs: 0.8,
        status: "healthy",
        queriesHandled: 800,
      },
    ],
    statsByRange: {
      "24h": buildStatsTimeframe("24h", 1),
      "7d": buildStatsTimeframe("7d", 6.4),
      "30d": buildStatsTimeframe("30d", 26.8),
      "90d": buildStatsTimeframe("90d", 78.5),
    },
  },
};
