"use client";

import { AlertTriangle, CheckCircle2, Clock4, Globe, ListChecks, Pencil, Plus, RefreshCw, Save, Search, ShieldBan, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime, nf } from "@/lib/format";
import { useApp, useResource } from "@/lib/store";
import type { BlockedService, FilterList, FilteringStatus, Rewrite, Schedule } from "@/lib/types";
import { CodeEditor, lintRule } from "./RuleEditor";
import { ScheduleEditor } from "./ScheduleEditor";
import { ServicePicker } from "./ServicePicker";
import { Badge, Button, Card, Checkbox, Empty, ErrorBox, Input, PageTitle, Select, Sheet, Spinner, Tabs, Toggle } from "./ui";

type Section = "filters" | "custom" | "services" | "rewrites";

export function Rules() {
  const [section, setSection] = useState<Section>("filters");
  return (
    <div>
      <PageTitle title="Regeln" subtitle="1:1 mit AdGuard Home synchron" />
      <Tabs
        value={section}
        onChange={setSection}
        items={[
          { id: "filters", label: "Filterlisten", icon: <ListChecks className="h-4 w-4" /> },
          { id: "custom", label: "Eigene Regeln", icon: <Pencil className="h-4 w-4" /> },
          { id: "services", label: "Dienste", icon: <ShieldBan className="h-4 w-4" /> },
          { id: "rewrites", label: "Rewrites", icon: <Globe className="h-4 w-4" /> },
        ]}
      />
      {section === "filters" && <FiltersView />}
      {section === "custom" && <CustomRulesView />}
      {section === "services" && <ServicesView />}
      {section === "rewrites" && <RewritesView />}
    </div>
  );
}

const INTERVALS = [
  { value: 0, label: "Nie" },
  { value: 1, label: "Stuendlich" },
  { value: 12, label: "Alle 12 Std" },
  { value: 24, label: "Taeglich" },
  { value: 72, label: "Alle 3 Tage" },
  { value: 168, label: "Woechentlich" },
];

const SUGGESTED = [
  { name: "AdGuard DNS filter", url: "https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt" },
  { name: "OISD Big", url: "https://big.oisd.nl" },
  { name: "HaGeZi Multi PRO", url: "https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/pro.txt" },
  { name: "HaGeZi Threat Intelligence", url: "https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/tif.txt" },
  { name: "Steven Black Unified", url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts" },
];

function FiltersView() {
  const { run } = useApp();
  const { data, error, loading, reload, setData } = useResource<FilteringStatus>("/api/filters");
  const [adding, setAdding] = useState<{ whitelist: boolean } | null>(null);
  const [form, setForm] = useState({ name: "", url: "" });
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const update = async (list: FilterList, whitelist: boolean, patch: Partial<FilterList>) => {
    const next = await run(() => api<FilteringStatus>("/api/filters", { method: "PATCH", body: { url: list.url, whitelist, name: patch.name ?? list.name, enabled: patch.enabled ?? list.enabled } }));
    if (next) setData(next);
  };

  const renderList = (lists: FilterList[] | null, whitelist: boolean) =>
    !lists?.length ? (
      <Empty>{whitelist ? "Keine Erlaubnislisten." : "Keine Sperrlisten."}</Empty>
    ) : (
      <ul className="divide-y divide-line/50">
        {lists.map((list) => (
          <li key={list.id} className="flex items-center gap-3 py-3">
            <Toggle checked={list.enabled} onChange={(enabled) => update(list, whitelist, { enabled })} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{list.name}</p>
              <p className="truncate font-mono text-[11px] text-dim">{list.url}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-dim">
                <span>{nf.format(list.rules_count)} Regeln</span>
                <span className="flex items-center gap-1"><Clock4 className="h-3 w-3" /> {formatDateTime(list.last_updated)}</span>
              </p>
            </div>
            <button type="button" className="rounded-lg p-2 text-dim hover:text-danger" title="Entfernen" onClick={async () => {
              if (!window.confirm(`"${list.name}" entfernen?`)) return;
              const next = await run(() => api<FilteringStatus>("/api/filters/remove", { body: { url: list.url, whitelist } }), "Liste entfernt");
              if (next) setData(next);
            }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Toggle label="DNS-Filterung" description="Hauptschalter fuer alle Listen und Regeln" checked={data.enabled} onChange={async (enabled) => {
            const next = await run(() => api<FilteringStatus>("/api/filters/config", { method: "PUT", body: { enabled, interval: data.interval } }));
            if (next) setData(next);
          }} />
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Auto-Update" value={data.interval} onChange={async (e) => {
              const next = await run(() => api<FilteringStatus>("/api/filters/config", { method: "PUT", body: { enabled: data.enabled, interval: Number(e.target.value) } }), "Intervall gespeichert");
              if (next) setData(next);
            }}>
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </Select>
            <Button icon={<RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} disabled={refreshing} onClick={async () => {
              setRefreshing(true);
              const result = await run(() => api<{ updated: number; status: FilteringStatus }>("/api/filters/refresh", { body: { whitelist: false } }));
              await run(() => api("/api/filters/refresh", { body: { whitelist: true } }));
              if (result) setData(result.status);
              setRefreshing(false);
            }}>
              Jetzt aktualisieren
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Sperrlisten" action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding({ whitelist: false })}>Hinzufuegen</Button>}>
        {renderList(data.filters, false)}
      </Card>
      <Card title="Erlaubnislisten" action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding({ whitelist: true })}>Hinzufuegen</Button>}>
        {renderList(data.whitelist_filters, true)}
      </Card>
      <Sheet open={Boolean(adding)} onClose={() => setAdding(null)} title={adding?.whitelist ? "Erlaubnisliste hinzufuegen" : "Sperrliste hinzufuegen"}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="URL oder absoluter Pfad" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} inputMode="url" />
          {!adding?.whitelist && (
            <div>
              <p className="mb-2 text-xs text-dim">Vorschlaege</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED.map((s) => (
                  <button key={s.url} type="button" onClick={() => setForm(s)} className="rounded-full border border-line px-2.5 py-1 text-xs text-dim hover:border-accent hover:text-accent">{s.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="primary" disabled={!form.name || !form.url} onClick={async () => {
              const next = await run(() => api<FilteringStatus>("/api/filters", { body: { ...form, whitelist: Boolean(adding?.whitelist) } }), "Liste hinzugefuegt");
              if (next) {
                setData(next);
                setAdding(null);
                setForm({ name: "", url: "" });
              }
            }}>Hinzufuegen</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

interface BuilderState {
  action: "block" | "allow";
  domain: string;
  subdomains: boolean;
  important: boolean;
  client: string;
  dnstype: string;
}

function buildRule(state: BuilderState): string {
  const domain = state.domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return "";
  const prefix = state.action === "allow" ? "@@" : "";
  const anchor = state.subdomains ? "||" : "|";
  const modifiers: string[] = [];
  if (state.client.trim()) modifiers.push(`client=${/^[0-9a-f.:/]+$/i.test(state.client.trim()) ? state.client.trim() : `'${state.client.trim().replace(/'/g, "\\'")}'`}`);
  if (state.dnstype) modifiers.push(`dnstype=${state.dnstype}`);
  if (state.important) modifiers.push("important");
  return `${prefix}${anchor}${domain}^${modifiers.length ? `$${modifiers.join(",")}` : ""}`;
}

function CustomRulesView() {
  const { run } = useApp();
  const { data, error, loading, reload } = useResource<{ rules: string[] }>("/api/rules");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>({ action: "block", domain: "", subdomains: true, important: false, client: "", dnstype: "" });
  const [check, setCheck] = useState({ name: "", client: "" });
  const [checkResult, setCheckResult] = useState<{ reason: string; rules?: { text: string }[]; service_name?: string } | null>(null);

  useEffect(() => {
    if (data) setText(data.rules.join("\n"));
  }, [data]);

  const issues = useMemo(() => text.split("\n").map((line, i) => ({ line: i + 1, message: lintRule(line) })).filter((x) => x.message), [text]);
  const dirty = data ? text !== data.rules.join("\n") : false;
  const preview = buildRule(builder);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card
        title="Benutzerregeln"
        action={<Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} disabled={!dirty} loading={saving} onClick={async () => {
          setSaving(true);
          const ok = await run(() => api("/api/rules", { method: "PUT", body: { rules: text.split("\n") } }), "Regeln in AdGuard gespeichert");
          if (ok) reload();
          setSaving(false);
        }}>Speichern</Button>}
      >
        <CodeEditor value={text} onChange={setText} minHeight={460} />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-dim">
          <span>{text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("!")).length} Regeln</span>
          {dirty && <Badge tone="warn">ungespeichert</Badge>}
          {issues.length > 0 && <Badge tone="danger">{issues.length} Hinweise</Badge>}
        </div>
        {issues.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {issues.slice(0, 8).map((issue) => (
              <li key={issue.line} className="flex items-center gap-2 text-warn"><AlertTriangle className="h-3.5 w-3.5" /> Zeile {issue.line}: {issue.message}</li>
            ))}
          </ul>
        )}
        <details className="mt-3 text-xs text-dim">
          <summary className="cursor-pointer">Syntax-Spickzettel</summary>
          <ul className="mt-2 space-y-1 font-mono">
            <li><span className="text-accent">||example.org^</span> sperrt Domain + Subdomains</li>
            <li><span className="text-ok">@@||example.org^</span> erlaubt (Ausnahme)</li>
            <li><span className="text-accent">||ads.*^</span> Wildcard</li>
            <li><span className="text-accent">/^ad[0-9]+\./</span> regulaerer Ausdruck</li>
            <li>$client=&apos;Name&apos;, $dnstype=AAAA, $important, $denyallow=a.com</li>
            <li>! Kommentar</li>
          </ul>
        </details>
      </Card>

      <div className="space-y-4">
        <Card title="Visueller Rule-Builder" icon={<Wand2 className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
              {(["block", "allow"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setBuilder({ ...builder, action: a })} className={`rounded-lg py-1.5 text-sm ${builder.action === a ? (a === "block" ? "bg-danger text-white" : "bg-ok text-black") : "text-dim"}`}>
                  {a === "block" ? "Sperren" : "Erlauben"}
                </button>
              ))}
            </div>
            <Input label="Domain" value={builder.domain} onChange={(e) => setBuilder({ ...builder, domain: e.target.value })} placeholder="tiktok.com" />
            <Input label="Nur fuer Client (optional)" value={builder.client} onChange={(e) => setBuilder({ ...builder, client: e.target.value })} placeholder="iPhone von Max oder 192.168.178.23" />
            <Select label="DNS-Typ" value={builder.dnstype} onChange={(e) => setBuilder({ ...builder, dnstype: e.target.value })}>
              <option value="">Alle</option>
              {["A", "AAAA", "CNAME", "HTTPS", "TXT", "MX"].map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Checkbox label="Subdomains einschliessen" checked={builder.subdomains} onChange={(v) => setBuilder({ ...builder, subdomains: v })} />
            <Checkbox label="$important (schlaegt andere Regeln)" checked={builder.important} onChange={(v) => setBuilder({ ...builder, important: v })} />
            <div className="rounded-xl border border-line bg-bg/60 p-3 font-mono text-xs text-accent">{preview || "…"}</div>
            <Button className="w-full" variant="primary" disabled={!preview} icon={<Plus className="h-4 w-4" />} onClick={() => {
              setText((t) => (t.trim() ? `${t.replace(/\n+$/, "")}\n${preview}` : preview));
              setBuilder({ ...builder, domain: "" });
            }}>
              In Editor uebernehmen
            </Button>
          </div>
        </Card>
        <Card title="Domain pruefen" icon={<Search className="h-4 w-4" />}>
          <div className="space-y-3">
            <Input value={check.name} onChange={(e) => setCheck({ ...check, name: e.target.value })} placeholder="youtube.com" />
            <Input value={check.client} onChange={(e) => setCheck({ ...check, client: e.target.value })} placeholder="Client (optional)" />
            <Button className="w-full" disabled={!check.name} onClick={async () => {
              const result = await run(() => api<{ reason: string; rules?: { text: string }[]; service_name?: string }>("/api/rules/check", { body: check }));
              if (result) setCheckResult(result);
            }}>Pruefen</Button>
            {checkResult && (
              <div className="rounded-xl border border-line bg-bg/60 p-3 text-xs">
                <p className="flex items-center gap-2">
                  {checkResult.reason.startsWith("Filtered") ? <ShieldBan className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-ok" />}
                  <span className="font-mono">{checkResult.reason}</span>
                </p>
                {checkResult.service_name && <p className="mt-1 text-dim">Dienst: {checkResult.service_name}</p>}
                {checkResult.rules?.map((r) => <p key={r.text} className="mt-1 break-all font-mono text-dim">{r.text}</p>)}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ServicesView() {
  const { run } = useApp();
  const { data, error, loading, reload, setData } = useResource<{ services: BlockedService[]; ids: string[]; schedule: Schedule | null }>("/api/services");
  const [ids, setIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setIds(data.ids);
      setSchedule(data.schedule);
    }
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const dirty = JSON.stringify([...ids].sort()) !== JSON.stringify([...data.ids].sort()) || JSON.stringify(schedule) !== JSON.stringify(data.schedule);

  return (
    <div className="space-y-4">
      <Card
        title={`Global gesperrte Dienste (${ids.length})`}
        action={<Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} disabled={!dirty} loading={saving} onClick={async () => {
          setSaving(true);
          const next = await run(() => api<{ ids: string[]; schedule: Schedule }>("/api/services", { method: "PUT", body: { ids, schedule: schedule ?? undefined } }), "Dienste gespeichert");
          if (next) setData({ ...data, ids: next.ids ?? [], schedule: next.schedule ?? null });
          setSaving(false);
        }}>Speichern</Button>}
      >
        <p className="mb-3 text-xs text-dim">Gilt fuer alle Clients mit &quot;globale Dienst-Sperren&quot;. Pro Geraet abweichend unter Geraete → Client bearbeiten.</p>
        <ServicePicker services={data.services} selected={ids} onChange={setIds} />
      </Card>
      <Card title="Freizeit-Zeitplan (global)">
        <ScheduleEditor value={schedule} onChange={setSchedule} />
      </Card>
    </div>
  );
}

function RewritesView() {
  const { run } = useApp();
  const { data, error, loading, reload, setData } = useResource<{ rewrites: Rewrite[] }>("/api/rewrites");
  const [form, setForm] = useState<Rewrite>({ domain: "", answer: "" });
  const [editing, setEditing] = useState<Rewrite | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const rewrites = data?.rewrites ?? [];

  const submit = async () => {
    const next = editing
      ? await run(() => api<{ rewrites: Rewrite[] }>("/api/rewrites", { method: "PUT", body: { target: editing, update: form } }), "Rewrite aktualisiert")
      : await run(() => api<{ rewrites: Rewrite[] }>("/api/rewrites", { body: form }), "Rewrite angelegt");
    if (next) {
      setData(next);
      setForm({ domain: "", answer: "" });
      setEditing(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card title={editing ? "Rewrite bearbeiten" : "Neue Umleitung"}>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input label="Domain (Wildcard *.lan erlaubt)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="nas.home" />
          <Input label="Antwort (IP oder Domain)" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="192.168.178.10" />
          <div className="flex gap-2">
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ domain: "", answer: "" }); }}>Abbrechen</Button>}
            <Button variant="primary" disabled={!form.domain || !form.answer} onClick={submit}>{editing ? "Speichern" : "Hinzufuegen"}</Button>
          </div>
        </div>
      </Card>
      <Card title={`DNS-Rewrites (${rewrites.length})`}>
        {rewrites.length === 0 ? (
          <Empty>Keine lokalen Umleitungen.</Empty>
        ) : (
          <ul className="divide-y divide-line/50">
            {rewrites.map((r) => (
              <li key={`${r.domain}-${r.answer}`} className="flex items-center gap-3 py-2.5 font-mono text-sm">
                <span className="min-w-0 flex-1 truncate">{r.domain}</span>
                <span className="text-dim">→</span>
                <span className="min-w-0 flex-1 truncate text-accent">{r.answer}</span>
                <button type="button" className="rounded-lg p-1.5 text-dim hover:text-fg" onClick={() => { setEditing(r); setForm(r); }} title="Bearbeiten"><Pencil className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-dim hover:text-danger" title="Loeschen" onClick={async () => {
                  const next = await run(() => api<{ rewrites: Rewrite[] }>("/api/rewrites/delete", { body: r }), "Rewrite geloescht");
                  if (next) setData(next);
                }}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
