import { getAdGuardConnection, type AdGuardConnection } from "./settings.js";

export class AdGuardError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface QueryLogEntry {
  answer?: { type: string; value: string; ttl: number }[];
  client: string;
  client_id?: string;
  client_info?: { name?: string; whois?: Record<string, string>; disallowed?: boolean };
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
  upstreams_cache_enabled?: boolean;
  upstreams_cache_size?: number;
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

function authHeader(conn: AdGuardConnection): Record<string, string> {
  if (!conn.user && !conn.pass) return {};
  return { Authorization: `Basic ${Buffer.from(`${conn.user}:${conn.pass}`).toString("base64")}` };
}

export async function adguardRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  connOverride?: AdGuardConnection,
  timeoutMs = 8000,
): Promise<T> {
  const conn = connOverride ?? (await getAdGuardConnection());
  if (!conn.url) throw new AdGuardError("AdGuard Home ist noch nicht verbunden. Bitte im Setup-Assistenten eintragen.", 503);
  let response: Response;
  try {
    response = await fetch(`${conn.url}/control${path}`, {
      method,
      headers: {
        ...authHeader(conn),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AdGuardError(`AdGuard Home unter ${conn.url} ist nicht erreichbar (${reason}).`, 502);
  }
  if (response.status === 401 || response.status === 403) {
    throw new AdGuardError("AdGuard Home lehnt die Zugangsdaten ab.", 502);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new AdGuardError(`AdGuard Home meldet HTTP ${response.status}: ${text.trim().slice(0, 300)}`, 502);
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export const ag = {
  status: (conn?: AdGuardConnection) =>
    adguardRequest<{
      version: string;
      running: boolean;
      protection_enabled: boolean;
      protection_disabled_duration?: number;
      dns_addresses: string[];
      dns_port: number;
      http_port: number;
    }>("GET", "/status", undefined, conn, 4000),
  setProtection: (enabled: boolean, durationMs?: number) =>
    adguardRequest<void>("POST", "/protection", durationMs ? { enabled, duration: durationMs } : { enabled }),
  stats: () => adguardRequest<Record<string, unknown>>("GET", "/stats"),
  queryLog: (params: { limit?: number; older_than?: string; search?: string; response_status?: string }) => {
    const qs = new URLSearchParams();
    qs.set("limit", String(params.limit ?? 100));
    if (params.older_than) qs.set("older_than", params.older_than);
    if (params.search) qs.set("search", params.search);
    if (params.response_status) qs.set("response_status", params.response_status);
    return adguardRequest<{ data: QueryLogEntry[]; oldest: string }>("GET", `/querylog?${qs.toString()}`);
  },
  filtering: () => adguardRequest<FilteringStatus>("GET", "/filtering/status"),
  addFilter: (name: string, url: string, whitelist: boolean) =>
    adguardRequest<void>("POST", "/filtering/add_url", { name, url, whitelist }),
  removeFilter: (url: string, whitelist: boolean) =>
    adguardRequest<void>("POST", "/filtering/remove_url", { url, whitelist }),
  setFilter: (url: string, whitelist: boolean, data: { name: string; url: string; enabled: boolean }) =>
    adguardRequest<void>("POST", "/filtering/set_url", { url, whitelist, data }),
  refreshFilters: (whitelist: boolean) =>
    adguardRequest<{ updated: number }>("POST", "/filtering/refresh", { whitelist }, undefined, 120_000),
  setFilteringConfig: (enabled: boolean, interval: number) =>
    adguardRequest<void>("POST", "/filtering/config", { enabled, interval }),
  setUserRules: (rules: string[]) => adguardRequest<void>("POST", "/filtering/set_rules", { rules }),
  checkHost: (name: string, client?: string) => {
    const qs = new URLSearchParams({ name });
    if (client) qs.set("client", client);
    return adguardRequest<{ reason: string; rules?: { text: string; filter_list_id: number }[]; service_name?: string; cname?: string; ip_addrs?: string[] }>(
      "GET",
      `/filtering/check_host?${qs.toString()}`,
    );
  },
  servicesAll: () => adguardRequest<{ blocked_services: BlockedService[]; groups?: { id: string }[] }>("GET", "/blocked_services/all"),
  servicesGet: () => adguardRequest<{ ids: string[]; schedule?: Schedule }>("GET", "/blocked_services/get"),
  servicesUpdate: (ids: string[], schedule?: Schedule) =>
    adguardRequest<void>("PUT", "/blocked_services/update", { ids, schedule: schedule ?? { time_zone: "Local" } }),
  clients: () =>
    adguardRequest<{
      clients: AdGuardClient[] | null;
      auto_clients: { ip: string; name: string; source: string; whois_info?: Record<string, string> }[] | null;
      supported_tags: string[] | null;
    }>("GET", "/clients"),
  addClient: (client: AdGuardClient) => adguardRequest<void>("POST", "/clients/add", client),
  updateClient: (name: string, data: AdGuardClient) => adguardRequest<void>("POST", "/clients/update", { name, data }),
  deleteClient: (name: string) => adguardRequest<void>("POST", "/clients/delete", { name }),
  rewrites: () => adguardRequest<{ domain: string; answer: string }[] | null>("GET", "/rewrite/list"),
  addRewrite: (domain: string, answer: string) => adguardRequest<void>("POST", "/rewrite/add", { domain, answer }),
  deleteRewrite: (domain: string, answer: string) => adguardRequest<void>("POST", "/rewrite/delete", { domain, answer }),
  updateRewrite: (target: { domain: string; answer: string }, update: { domain: string; answer: string }) =>
    adguardRequest<void>("PUT", "/rewrite/update", { target, update }),
  dnsInfo: () =>
    adguardRequest<{ upstream_dns: string[]; bootstrap_dns: string[]; fallback_dns?: string[]; upstream_mode?: string; blocking_mode: string; blocking_ipv4?: string; blocking_ipv6?: string }>(
      "GET",
      "/dns_info",
    ),
  testUpstream: (upstreams: string[], bootstrap: string[]) =>
    adguardRequest<Record<string, string>>(
      "POST",
      "/test_upstream_dns",
      { upstream_dns: upstreams, bootstrap_dns: bootstrap, fallback_dns: [], private_upstream: [] },
      undefined,
      30_000,
    ),
};

/** Ein Client-Objekt mit allen Pflichtfeldern, damit AdGuard es beim Anlegen akzeptiert. */
export function newClient(name: string, ids: string[]): AdGuardClient {
  return {
    name,
    ids,
    use_global_settings: true,
    filtering_enabled: true,
    parental_enabled: false,
    safebrowsing_enabled: false,
    safe_search: { enabled: false },
    use_global_blocked_services: true,
    blocked_services: [],
    blocked_services_schedule: { time_zone: "Local" },
    upstreams: [],
    tags: [],
    ignore_querylog: false,
    ignore_statistics: false,
  };
}

/** Normalisiert eine Domain-Eingabe (URL, *.domain, Gross/Kleinschreibung) auf den reinen Hostnamen. */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, "").replace(/^\*\./, "").replace(/^\|\|/, "").replace(/\^.*$/, "");
  value = value.split("/")[0].split(":")[0].replace(/\.$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/.test(value)) {
    throw new AdGuardError(`"${input}" ist keine gueltige Domain.`, 400);
  }
  return value;
}
