import type { ThemeId } from "@canvas/index";

export interface PublicConfig {
  version: string;
  googleClientId: string | null;
  allowedEmailHint: string[];
  setupComplete: boolean;
  theme: ThemeId;
  publicUrl: string;
  duckdns: { domain: string | null; ok: boolean; checkedAt: string | null };
}

export interface QueryLogEntry {
  answer?: { type: string; value: string; ttl: number }[];
  client: string;
  client_id?: string;
  client_info?: { name?: string };
  client_proto?: string;
  elapsedMs: string;
  question: { name: string; type: string; class: string; unicode_name?: string };
  reason: string;
  rules?: { text: string; filter_list_id: number }[];
  service_name?: string;
  status: string;
  time: string;
  upstream?: string;
  cached?: boolean;
}

export interface DaySpan {
  start: number;
  end: number;
}

export interface Schedule {
  time_zone?: string;
  sun?: DaySpan;
  mon?: DaySpan;
  tue?: DaySpan;
  wed?: DaySpan;
  thu?: DaySpan;
  fri?: DaySpan;
  sat?: DaySpan;
}

export interface AdGuardClient {
  name: string;
  ids: string[];
  use_global_settings: boolean;
  filtering_enabled: boolean;
  parental_enabled: boolean;
  safebrowsing_enabled: boolean;
  safe_search?: Record<string, boolean>;
  use_global_blocked_services: boolean;
  blocked_services: string[];
  blocked_services_schedule?: Schedule;
  upstreams: string[];
  tags: string[];
  ignore_querylog?: boolean;
  ignore_statistics?: boolean;
}

export interface AutoClient {
  ip: string;
  name: string;
  source: string;
}

export interface FilterList {
  id: number;
  url: string;
  name: string;
  enabled: boolean;
  last_updated?: string;
  rules_count: number;
}

export interface FilteringStatus {
  enabled: boolean;
  interval: number;
  filters: FilterList[] | null;
  whitelist_filters: FilterList[] | null;
  user_rules: string[];
}

export interface BlockedService {
  id: string;
  name: string;
  icon_svg: string;
  rules: string[];
  group_id?: string;
}

export interface Rewrite {
  domain: string;
  answer: string;
}

export interface DuckDnsStatus {
  ok: boolean;
  ipv4: string | null;
  ipv6: string | null;
  changed: boolean;
  checkedAt: string | null;
  message: string;
}

export interface AdGuardStatus {
  version: string;
  running: boolean;
  protection_enabled: boolean;
  protection_disabled_duration?: number;
  dns_addresses: string[];
}

export interface Dashboard {
  adguard: AdGuardStatus | null;
  adguardError: string | null;
  stats: {
    num_dns_queries: number;
    num_blocked_filtering: number;
    num_replaced_safebrowsing: number;
    num_replaced_parental: number;
    avg_processing_time: number;
    top_queried_domains: Record<string, number>[];
    top_blocked_domains: Record<string, number>[];
    top_clients: Record<string, number>[];
    dns_queries: number[];
    blocked_filtering: number[];
    time_units: string;
  } | null;
  duckdns: DuckDnsStatus;
  dot: { enabled: boolean; port: number; certificateLoaded: boolean; error: string | null };
  blockCache: { size: number; lastRefresh: string | null; lastError: string | null };
  pendingRequests: number;
  roaming: { total: number; active: number; stale: { id: string; name: string; lastSeenAt: string | null }[] };
  latency: { target: string; ms: number; ok: boolean; at: string }[];
}

export interface RoamingSettings {
  enforce: boolean;
  offlineCache: boolean;
  homeSsids: string[];
}

export interface RoamingDevice {
  id: string;
  name: string;
  clientId: string;
  platform: "ios" | "macos" | "android" | "windows" | "other";
  adguardClient: string | null;
  enabled: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lastProtocol: string | null;
  queryCount: number;
  offlineAnswers: number;
  dohUrl: string;
  dotHost: string;
  stale: boolean;
}

export interface BlockPageConfig {
  mode: "studio" | "redirect";
  redirectUrl: string;
  theme: ThemeId;
  title: string;
  alert: string;
  alertLevel: "info" | "warning" | "critical";
  showDomain: boolean;
  showClient: boolean;
  showCountdown: boolean;
  showRequestButton: boolean;
  requestHint: string;
  footer: string;
  expertMode: boolean;
  customHtml: string;
}

export interface AccessRequest {
  id: string;
  domain: string;
  clientIp: string;
  clientName: string | null;
  message: string | null;
  status: "pending" | "approved" | "denied" | "expired";
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  ruleText: string | null;
}

export interface GeneralSettings {
  theme: ThemeId;
  canvasIntensity: number;
  setupComplete: boolean;
  notifyUrl: string;
  accessDefaultMinutes: number;
}

export interface SettingsResponse {
  general: GeneralSettings;
  roaming: RoamingSettings;
  adguard: { url: string; user: string; hasPassword: boolean; source: "database" | "env" | "none" };
  allowedEmails: string[];
  corsOrigins: string[];
  publicUrl: string;
}

export interface SystemInfo {
  version: string;
  node: string;
  platform: string;
  hostname: string;
  uptimeSeconds: number;
  systemUptimeSeconds: number;
  load: number[];
  memory: { rss: number; heapUsed: number; systemTotal: number; systemFree: number };
  git: { commit: string | null; branch: string | null };
  network: { localIps: string[]; tailscaleIp: string | null; publicUrl: string; duckdnsDomain: string | null; customDomain: string | null };
  duckdns: DuckDnsStatus;
  dot: Dashboard["dot"];
  blockCache: Dashboard["blockCache"];
  database: { devices: number; auditEntries: number };
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}
