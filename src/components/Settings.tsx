"use client";

import { Activity, Bell, Cpu, Inbox, LogOut, Palette, Plug, ScrollText, Shield, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, getApiBase, setApiBase } from "@/lib/api";
import { bytes, duration, formatDateTime, relative } from "@/lib/format";
import { useApp, useResource } from "@/lib/store";
import type { AuditEntry, GeneralSettings, RoamingSettings, SettingsResponse, SystemInfo } from "@/lib/types";
import { AccessRequests } from "./AccessRequests";
import { AdGuardForm } from "./AdGuardForm";
import { ThemePicker } from "./ThemePicker";
import { Badge, Button, Card, Checkbox, ErrorBox, Input, PageTitle, Spinner, StatusDot } from "./ui";

export function SettingsView({ onOpenWizard }: { onOpenWizard(): void }) {
  const { theme, setTheme, intensity, setIntensity, setSession, run } = useApp();
  const { data, error, loading, reload, setData } = useResource<SettingsResponse>("/api/settings");

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const saveGeneral = async (patch: Partial<GeneralSettings>, message?: string) => {
    const next = await run(() => api<GeneralSettings>("/api/settings/general", { method: "PUT", body: patch }), message);
    if (next) setData({ ...data, general: next });
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Settings" subtitle={data.publicUrl} />

      <Card title="Darstellung" icon={<Palette className="h-4 w-4" />}>
        <ThemePicker value={theme} onChange={(id) => setTheme(id, true)} />
        <label className="mt-4 block">
          <span className="mb-2 flex justify-between text-xs text-dim"><span>Canvas-Intensitaet</span><span className="font-mono">{Math.round(intensity * 100)}%</span></span>
          <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full accent-[rgb(var(--accent))]" />
        </label>
      </Card>

      <AntiBypassCard roaming={data.roaming} onSaved={(roaming) => setData({ ...data, roaming })} />

      <Card title="Freigabe-Anfragen" icon={<Inbox className="h-4 w-4" />}>
        <AccessRequests status="all" />
        <div className="mt-4 grid gap-3 border-t border-line/60 pt-4 sm:grid-cols-2">
          <Input label="Standard-Freigabedauer (Min)" type="number" min={5} max={1440} defaultValue={data.general.accessDefaultMinutes} onBlur={(e) => saveGeneral({ accessDefaultMinutes: Math.min(1440, Math.max(5, Number(e.target.value))) }, "Gespeichert")} />
          <NotifyField value={data.general.notifyUrl} onSave={(notifyUrl) => saveGeneral({ notifyUrl }, notifyUrl ? "Benachrichtigung aktiv" : "Benachrichtigung aus")} />
        </div>
      </Card>

      <Card title="AdGuard Home Verbindung" icon={<Plug className="h-4 w-4" />}>
        <AdGuardForm />
      </Card>

      <DnsCard />

      <SystemCard />

      <Card title="Zugang" icon={<Shield className="h-4 w-4" />}>
        <div className="space-y-3 text-sm">
          <p className="text-dim">Freigeschaltete Accounts: <span className="font-mono text-fg">{data.allowedEmails.join(", ")}</span></p>
          <p className="text-dim">Erlaubte Frontends (CORS): <span className="font-mono text-fg">{data.corsOrigins.join(", ")}</span></p>
          <BackendUrlField />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button icon={<Wand2 className="h-4 w-4" />} onClick={onOpenWizard}>Setup-Assistent erneut starten</Button>
            <Button variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={() => setSession(null)}>Abmelden</Button>
          </div>
        </div>
      </Card>

      <AuditCard />
    </div>
  );
}

function NotifyField({ value, onSave }: { value: string; onSave(value: string): void }) {
  const [text, setText] = useState(value);
  return (
    <div>
      <Input label="Push bei neuer Anfrage (ntfy-Topic oder Webhook-URL)" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://ntfy.sh/mein-geheimes-topic" inputMode="url" />
      <Button size="sm" className="mt-2" icon={<Bell className="h-3.5 w-3.5" />} disabled={text === value} onClick={() => onSave(text.trim())}>Speichern</Button>
    </div>
  );
}

function BackendUrlField() {
  const { reloadConfig, toast } = useApp();
  const [value, setValue] = useState("");
  useEffect(() => setValue(getApiBase()), []);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input className="flex-1" label="Backend-URL dieses Browsers" value={value} onChange={(e) => setValue(e.target.value)} placeholder="gleiche Herkunft" inputMode="url" />
      <Button onClick={async () => { setApiBase(value); await reloadConfig(); toast("Backend-URL gespeichert"); }}>Uebernehmen</Button>
    </div>
  );
}

function AntiBypassCard({ roaming, onSaved }: { roaming: RoamingSettings; onSaved(value: RoamingSettings): void }) {
  const { run } = useApp();
  const [draft, setDraft] = useState(roaming);
  const [ssid, setSsid] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(roaming);

  return (
    <Card title="Anti-Bypass-Engine" icon={<Shield className="h-4 w-4" />} action={<Button size="sm" variant="primary" disabled={!dirty} onClick={async () => {
      const saved = await run(() => api<RoamingSettings>("/api/roaming/settings", { method: "PUT", body: draft }), "Anti-Bypass gespeichert");
      if (saved) onSaved(saved);
    }}>Speichern</Button>}>
      <div className="space-y-4">
        <Checkbox
          label="Unterwegs- & Hotspot-Schutz erzwingen (Roaming Policy Enforcement)"
          checked={draft.enforce}
          onChange={(enforce) => setDraft({ ...draft, enforce })}
          description="An: Profile erzwingen verschluesseltes DNS in jedem Netz (WLAN, Hotspot, 5G) und sperren das Abschalten. Aus: im Heim-WLAN wird das lokale DNS genutzt, nur unterwegs DoH."
        />
        <Checkbox
          label="Letzte Sperren offline cachen & durchsetzen"
          checked={draft.offlineCache}
          onChange={(offlineCache) => setDraft({ ...draft, offlineCache })}
          description="Ist AdGuard nicht erreichbar, beantwortet das Backend Roaming-Anfragen selbst: bekannte Sperren werden weiter blockiert, alles andere ueber einen Fallback-Resolver aufgeloest."
        />
        {!draft.enforce && (
          <div>
            <p className="mb-2 text-xs text-dim">Heim-WLANs (SSID), in denen das Profil pausiert</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {draft.homeSsids.map((name) => (
                <span key={name} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-xs">
                  {name}
                  <button type="button" onClick={() => setDraft({ ...draft, homeSsids: draft.homeSsids.filter((s) => s !== name) })} aria-label={`${name} entfernen`}><X className="h-3 w-3 text-dim hover:text-danger" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input className="flex-1" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="FRITZ!Box 7590 XY" />
              <Button disabled={!ssid.trim()} onClick={() => { setDraft({ ...draft, homeSsids: [...new Set([...draft.homeSsids, ssid.trim()])] }); setSsid(""); }}>Hinzufuegen</Button>
            </div>
          </div>
        )}
        <p className="rounded-xl border border-line bg-bg/40 p-3 text-xs leading-relaxed text-dim">
          Ehrlicher Hinweis: Auf nicht betreuten (unsupervised) iPhones kann ein Profil immer entfernt werden, &quot;Abschalten sperren&quot; greift erst mit Apple Configurator/MDM. Das Dashboard meldet deshalb Geraete, die sich laenger als 24 Std nicht ueber verschluesseltes DNS melden. Bei Android laesst sich Privates DNS in den Einstellungen aendern, ausser mit Family Link oder einem Device-Owner-Profil.
        </p>
      </div>
    </Card>
  );
}

function Sparkline({ points }: { points: { ms: number; ok: boolean }[] }) {
  if (points.length < 2) return <span className="text-[10px] text-dim">zu wenig Daten</span>;
  const values = points.map((p) => p.ms);
  const max = Math.max(...values, 1);
  const path = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={path} fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (!p.ok ? <circle key={i} cx={(i / (points.length - 1)) * 100} cy={2} r={1.5} fill="rgb(239 68 68)" /> : null))}
    </svg>
  );
}

function DnsCard() {
  const { run } = useApp();
  const { data, error, loading, reload } = useResource<{ info: { upstream_dns: string[]; bootstrap_dns: string[]; blocking_mode: string; blocking_ipv4?: string }; series: Record<string, { at: string; ms: number; ok: boolean; error: string | null }[]> }>("/api/dns");
  const [results, setResults] = useState<{ upstream: string; ok: boolean; ms: number; message: string }[] | null>(null);
  const [testing, setTesting] = useState(false);

  return (
    <Card title="DNS & Latenz-Monitoring" icon={<Activity className="h-4 w-4" />}>
      {loading && !data ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-dim">Upstreams</p>
              <ul className="space-y-1 font-mono text-xs">{data.info.upstream_dns.map((u) => <li key={u} className="break-all">{u}</li>)}</ul>
            </div>
            <div>
              <p className="mb-1 text-xs text-dim">Blockmodus</p>
              <p className="font-mono text-xs">{data.info.blocking_mode}{data.info.blocking_ipv4 ? ` → ${data.info.blocking_ipv4}` : ""}</p>
              {data.info.blocking_mode !== "custom_ip" && <p className="mt-1 text-xs text-warn">Fuer die eigene Sperrseite in AdGuard den Blockmodus &quot;Benutzerdefinierte IP&quot; mit der IP dieses LXC setzen.</p>}
            </div>
          </div>
          <div className="space-y-3">
            {Object.entries(data.series).map(([target, points]) => (
              <div key={target}>
                <div className="mb-1 flex justify-between gap-2 font-mono text-[11px]">
                  <span className="truncate text-dim">{target === "adguard" ? "AdGuard Home (API)" : target}</span>
                  <span>{points.at(-1)?.ok ? `${points.at(-1)?.ms} ms` : "Fehler"}</span>
                </div>
                <Sparkline points={points.slice(-96)} />
              </div>
            ))}
            {Object.keys(data.series).length === 0 && <p className="text-xs text-dim">Die erste Messung laeuft alle 5 Minuten.</p>}
          </div>
          <Button loading={testing} onClick={async () => {
            setTesting(true);
            const result = await run(() => api<{ results: typeof results }>("/api/dns/test", { body: { upstreams: data.info.upstream_dns.filter((u) => u && !u.startsWith("#")).slice(0, 20) } }));
            if (result) setResults(result.results);
            setTesting(false);
          }}>Upstreams jetzt testen</Button>
          {results && (
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={r.upstream} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="truncate">{r.upstream}</span>
                  <Badge tone={r.ok ? "ok" : "danger"}>{r.ok ? `${r.ms} ms` : r.message.slice(0, 40)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function SystemCard() {
  const { data, error, loading, reload } = useResource<SystemInfo>("/api/system");
  return (
    <Card title="System" icon={<Cpu className="h-4 w-4" />} action={<Button size="sm" variant="ghost" onClick={reload}>Aktualisieren</Button>}>
      {loading && !data ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-dim">Version</dt><dd className="font-mono">v{data.version} · {data.git.branch ?? "?"}@{data.git.commit ?? "?"}</dd>
          <dt className="text-dim">Node.js</dt><dd className="font-mono">{data.node}</dd>
          <dt className="text-dim">Host</dt><dd className="font-mono">{data.hostname} · {data.platform}</dd>
          <dt className="text-dim">Laufzeit</dt><dd>Backend {duration(data.uptimeSeconds)} · System {duration(data.systemUptimeSeconds)}</dd>
          <dt className="text-dim">Speicher</dt><dd>RSS {bytes(data.memory.rss)} · frei {bytes(data.memory.systemFree)} / {bytes(data.memory.systemTotal)}</dd>
          <dt className="text-dim">Last</dt><dd className="font-mono">{data.load.map((l) => l.toFixed(2)).join(" / ")}</dd>
          <dt className="text-dim">Lokale IP</dt><dd className="font-mono">{data.network.localIps.join(", ") || "–"}</dd>
          <dt className="text-dim">Tailscale</dt><dd className="font-mono">{data.network.tailscaleIp ?? "nicht verbunden"}</dd>
          <dt className="text-dim">DuckDNS</dt>
          <dd className="flex items-center gap-2"><StatusDot ok={data.duckdns.ok} /><span className="font-mono">{data.network.duckdnsDomain ?? "–"} → {data.duckdns.ipv4 ?? "?"}</span><span className="text-xs text-dim">{relative(data.duckdns.checkedAt)}</span></dd>
          {data.network.customDomain && (<><dt className="text-dim">Eigene Domain</dt><dd className="font-mono">{data.network.customDomain}</dd></>)}
          <dt className="text-dim">DoT</dt><dd>{data.dot.enabled ? (data.dot.certificateLoaded ? `aktiv auf Port ${data.dot.port}` : data.dot.error) : "deaktiviert"}</dd>
          <dt className="text-dim">Sperrcache</dt><dd>{data.blockCache.size} Domains · {relative(data.blockCache.lastRefresh)}{data.blockCache.lastError ? ` · ${data.blockCache.lastError}` : ""}</dd>
        </dl>
      )}
    </Card>
  );
}

function AuditCard() {
  const { data, error, loading, reload } = useResource<{ entries: AuditEntry[] }>("/api/audit?limit=50");
  return (
    <Card title="Audit-Log" icon={<ScrollText className="h-4 w-4" />} action={<Button size="sm" variant="ghost" onClick={reload}>Aktualisieren</Button>}>
      {loading && !data ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto font-mono text-[11px]">
          {(data?.entries ?? []).map((entry) => (
            <li key={entry.id} className="grid grid-cols-[88px_1fr] gap-2">
              <span className="text-dim">{formatDateTime(entry.createdAt)}</span>
              <span className="break-all"><span className="text-accent">{entry.action}</span> <span className="text-dim">{entry.actor}</span> {entry.detail !== "{}" ? entry.detail : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
