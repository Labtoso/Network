"use client";

import { Activity, AlertTriangle, Ban, Gauge, Globe2, Inbox, Pause, Play, RefreshCw, Shield, ShieldOff, Timer, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { nf, relative } from "@/lib/format";
import { useApp, useResource } from "@/lib/store";
import type { Dashboard as DashboardData, DuckDnsStatus } from "@/lib/types";
import { AccessRequests } from "./AccessRequests";
import { LiveQueryLog } from "./LiveQueryLog";
import { Badge, Button, Card, ErrorBox, PageTitle, Spinner, StatusDot, cx } from "./ui";

function Tile({ label, value, sub, icon, tone = "accent" }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone?: "accent" | "danger" }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between text-xs text-dim">
        <span>{label}</span>
        <span className={tone === "danger" ? "text-danger" : "text-accent"}>{icon}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
    </div>
  );
}

function ActivityChart({ queries, blocked, unit }: { queries: number[]; blocked: number[]; unit: string }) {
  const points = queries.slice(-24);
  const blockedPoints = blocked.slice(-24);
  const max = Math.max(1, ...points);
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {points.map((value, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${nf.format(value)} Anfragen, ${nf.format(blockedPoints[i] ?? 0)} gesperrt`}>
            <div className="w-full rounded-t-sm bg-accent/30 transition group-hover:bg-accent/50" style={{ height: `${(value / max) * 100}%` }}>
              <div className="w-full rounded-t-sm bg-danger/80" style={{ height: `${value ? ((blockedPoints[i] ?? 0) / value) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">
        <span>vor {points.length} {unit === "days" ? "Tagen" : "Std"}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent/40" /> Anfragen</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-danger/80" /> gesperrt</span>
        </span>
        <span>jetzt</span>
      </div>
    </div>
  );
}

function TopList({ title, rows, tone }: { title: string; rows: Record<string, number>[]; tone?: "danger" }) {
  const items = rows.slice(0, 8).map((row) => Object.entries(row)[0]).filter(Boolean) as [string, number][];
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-dim">Keine Daten.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(([name, count]) => (
            <li key={name} className="relative overflow-hidden rounded-lg px-2.5 py-1.5">
              <span className={cx("absolute inset-y-0 left-0 rounded-lg", tone === "danger" ? "bg-danger/10" : "bg-accent/10")} style={{ width: `${(count / max) * 100}%` }} />
              <span className="relative flex justify-between gap-3 font-mono text-xs">
                <span className="truncate">{name}</span>
                <span className="text-dim">{nf.format(count)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Dashboard({ onNavigate }: { onNavigate(tab: "devices" | "settings"): void }) {
  const { run, toast } = useApp();
  const { data, error, loading, reload, setData } = useResource<DashboardData>("/api/dashboard");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(reload, 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockedRate = useMemo(() => {
    if (!data?.stats?.num_dns_queries) return 0;
    return (data.stats.num_blocked_filtering / data.stats.num_dns_queries) * 100;
  }, [data]);

  if (loading && !data) return <Spinner label="Lade Dashboard…" />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const protection = data.adguard?.protection_enabled ?? false;
  const setProtection = async (enabled: boolean, minutes?: number) => {
    setBusy(true);
    const status = await run(() => api<DashboardData["adguard"]>("/api/protection", { body: { enabled, minutes } }), enabled ? "Schutz aktiviert" : minutes ? `Schutz fuer ${minutes} Min pausiert` : "Schutz pausiert");
    if (status) setData({ ...data, adguard: status });
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Dashboard" subtitle={data.adguard ? `AdGuard Home ${data.adguard.version}` : "AdGuard nicht erreichbar"} action={<Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}>Aktualisieren</Button>} />

      {data.adguardError && <ErrorBox message={data.adguardError} />}

      <Card className={cx(protection ? "border-accent/40" : "border-danger/50")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl border", protection ? "border-accent/50 bg-accent/10 text-accent" : "border-danger/50 bg-danger/10 text-danger")}>
              {protection ? <Shield className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-base font-semibold">{protection ? "Schutz aktiv" : "Schutz pausiert"}</p>
              <p className="text-xs text-dim">
                {protection ? "Alle Filter, Dienste und Regeln greifen." : data.adguard?.protection_disabled_duration ? `Automatisch wieder an in ${Math.ceil(data.adguard.protection_disabled_duration / 60000)} Min` : "Bis zur manuellen Aktivierung."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {protection ? (
              <>
                {[5, 30, 60].map((m) => (
                  <Button key={m} size="sm" icon={<Pause className="h-3.5 w-3.5" />} loading={busy} onClick={() => setProtection(false, m)}>
                    {m} Min
                  </Button>
                ))}
                <Button size="sm" variant="danger" loading={busy} onClick={() => setProtection(false)}>Aus</Button>
              </>
            ) : (
              <Button variant="primary" icon={<Play className="h-4 w-4" />} loading={busy} onClick={() => setProtection(true)}>Schutz aktivieren</Button>
            )}
          </div>
        </div>
      </Card>

      {data.stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="DNS-Anfragen" value={nf.format(data.stats.num_dns_queries)} sub="letzte 24 Std" icon={<Activity className="h-4 w-4" />} />
          <Tile label="Gesperrt" value={nf.format(data.stats.num_blocked_filtering)} sub={`${blockedRate.toFixed(1)} % aller Anfragen`} icon={<Ban className="h-4 w-4" />} tone="danger" />
          <Tile label="Safe Browsing / Jugendschutz" value={nf.format(data.stats.num_replaced_safebrowsing + data.stats.num_replaced_parental)} icon={<Shield className="h-4 w-4" />} />
          <Tile label="Antwortzeit" value={`${(data.stats.avg_processing_time * 1000).toFixed(1)} ms`} sub="Durchschnitt" icon={<Gauge className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Aktivitaet" icon={<Activity className="h-4 w-4" />} className="lg:col-span-2">
          {data.stats ? <ActivityChart queries={data.stats.dns_queries ?? []} blocked={data.stats.blocked_filtering ?? []} unit={data.stats.time_units} /> : <p className="text-sm text-dim">Keine Statistik verfuegbar.</p>}
        </Card>
        <HealthCard data={data} onDuckDns={(duckdns) => { setData({ ...data, duckdns }); toast(duckdns.ok ? "DuckDNS aktualisiert" : duckdns.message, duckdns.ok ? "ok" : "error"); }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={`Freigabe-Anfragen${data.pendingRequests ? ` (${data.pendingRequests})` : ""}`}
          icon={<Inbox className="h-4 w-4" />}
          action={<Button size="sm" variant="ghost" onClick={() => onNavigate("settings")}>Alle</Button>}
        >
          <AccessRequests compact onChange={reload} />
        </Card>
        <Card title="Roaming-Schutz" icon={<Wifi className="h-4 w-4" />} action={<Button size="sm" variant="ghost" onClick={() => onNavigate("devices")}>Geraete</Button>}>
          <p className="text-sm">
            <span className="font-mono text-accent">{data.roaming.active}</span> von <span className="font-mono">{data.roaming.total}</span> Geraeten in den letzten 24 Std ueber DoH/DoT aktiv.
          </p>
          {data.roaming.stale.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {data.roaming.stale.map((device) => (
                <li key={device.id} className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span><b>{device.name}</b> meldet sich nicht ueber verschluesseltes DNS ({relative(device.lastSeenAt)}). Moeglicher Bypass oder Profil entfernt.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <LiveQueryLog />

      {data.stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <TopList title="Top Domains" rows={data.stats.top_queried_domains ?? []} />
          <TopList title="Top gesperrt" rows={data.stats.top_blocked_domains ?? []} tone="danger" />
          <TopList title="Top Clients" rows={data.stats.top_clients ?? []} />
        </div>
      )}
    </div>
  );
}

function HealthCard({ data, onDuckDns }: { data: DashboardData; onDuckDns(status: DuckDnsStatus): void }) {
  const { run } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const adguardLatency = data.latency.find((l) => l.target === "adguard");
  const upstreams = data.latency.filter((l) => l.target !== "adguard");

  return (
    <Card title="Systemzustand" icon={<Globe2 className="h-4 w-4" />}>
      <ul className="space-y-3 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><StatusDot ok={Boolean(data.adguard?.running)} pulse /> AdGuard Home</span>
          <span className="font-mono text-xs text-dim">{adguardLatency ? `${adguardLatency.ms} ms` : "–"}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><StatusDot ok={data.duckdns.ok} /> DuckDNS</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-dim">{data.duckdns.ipv4 ?? "–"}</span>
            <button
              type="button"
              title="Jetzt aktualisieren"
              className="rounded-md p-1 text-dim hover:text-accent"
              onClick={async () => {
                setRefreshing(true);
                const status = await run(() => api<DuckDnsStatus>("/api/system/duckdns-refresh", { body: {} }));
                if (status) onDuckDns(status);
                setRefreshing(false);
              }}
            >
              <RefreshCw className={cx("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          </span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><StatusDot ok={data.dot.enabled ? data.dot.certificateLoaded : null} /> DoT (Android)</span>
          <span className="font-mono text-xs text-dim">{data.dot.enabled ? (data.dot.certificateLoaded ? `Port ${data.dot.port}` : "kein Zertifikat") : "aus"}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><StatusDot ok={!data.blockCache.lastError} /> Offline-Sperrcache</span>
          <span className="font-mono text-xs text-dim">{nf.format(data.blockCache.size)} Domains</span>
        </li>
      </ul>
      {upstreams.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-dim"><Timer className="h-3.5 w-3.5" /> Upstream-Latenz</p>
          <ul className="space-y-1.5">
            {upstreams.map((u) => (
              <li key={u.target} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-dim">{u.target}</span>
                <Badge tone={!u.ok ? "danger" : u.ms > 300 ? "warn" : "ok"}>{u.ok ? `${u.ms} ms` : "Fehler"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-dim">DuckDNS zuletzt {relative(data.duckdns.checkedAt)}</p>
    </Card>
  );
}
