"use client";

import { Apple, Laptop, MonitorSmartphone, Plus, QrCode as QrIcon, Smartphone, Trash2, UserPlus, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { nf, relative } from "@/lib/format";
import { useApp, useResource } from "@/lib/store";
import type { AdGuardClient, AutoClient, BlockedService, RoamingDevice, RoamingSettings } from "@/lib/types";
import { QrCode } from "./QrCode";
import { ScheduleEditor } from "./ScheduleEditor";
import { ServicePicker } from "./ServicePicker";
import { Badge, Button, Card, CopyField, Empty, ErrorBox, Input, PageTitle, Select, Sheet, Spinner, Tabs, TextArea, Toggle } from "./ui";

interface ClientsResponse {
  clients: AdGuardClient[];
  autoClients: AutoClient[];
  supportedTags: string[];
}

function emptyClient(name = "", ids: string[] = []): AdGuardClient {
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

export function Devices() {
  const [tab, setTab] = useState<"clients" | "roaming">("clients");
  return (
    <div>
      <PageTitle title="Geraete" subtitle="AdGuard-Clients und Roaming-Schutz unterwegs" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "clients", label: "Netzwerk-Clients", icon: <MonitorSmartphone className="h-4 w-4" /> },
          { id: "roaming", label: "Roaming DoH/DoT", icon: <Wifi className="h-4 w-4" /> },
        ]}
      />
      {tab === "clients" ? <ClientsView /> : <RoamingView />}
    </div>
  );
}

function ClientsView() {
  const { data, error, loading, reload } = useResource<ClientsResponse>("/api/clients");
  const [editing, setEditing] = useState<{ original: string | null; client: AdGuardClient } | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const clients = data?.clients ?? [];
  const known = new Set(clients.flatMap((c) => c.ids));
  const auto = (data?.autoClients ?? []).filter((c) => !known.has(c.ip));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ original: null, client: emptyClient() })}>
          Neuer Client
        </Button>
      </div>
      {clients.length === 0 ? (
        <Empty>Noch keine festen Clients in AdGuard angelegt.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clients.map((client) => (
            <button key={client.name} type="button" onClick={() => setEditing({ original: client.name, client: structuredClone(client) })} className="rounded-2xl border border-line bg-panel/80 p-4 text-left backdrop-blur transition hover:border-accent/50">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{client.name}</p>
                <div className="flex flex-wrap justify-end gap-1">
                  {!client.filtering_enabled && <Badge tone="danger">ungefiltert</Badge>}
                  {!client.use_global_blocked_services && <Badge tone="accent">{client.blocked_services.length} Dienste</Badge>}
                  {client.parental_enabled && <Badge tone="warn">Jugendschutz</Badge>}
                </div>
              </div>
              <p className="mt-1.5 break-all font-mono text-xs text-dim">{client.ids.join(" · ")}</p>
              {client.tags.length > 0 && <p className="mt-2 font-mono text-[10px] text-dim">{client.tags.join(", ")}</p>}
            </button>
          ))}
        </div>
      )}

      <Card title={`Automatisch erkannt (${auto.length})`}>
        {auto.length === 0 ? (
          <p className="text-sm text-dim">Alle erkannten Geraete sind bereits als Client angelegt.</p>
        ) : (
          <ul className="divide-y divide-line/50">
            {auto.slice(0, 100).map((client) => (
              <li key={client.ip} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{client.name || "Unbekannt"}</p>
                  <p className="font-mono text-xs text-dim">{client.ip} · {client.source}</p>
                </div>
                <Button size="sm" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setEditing({ original: null, client: emptyClient(client.name || client.ip, [client.ip]) })}>
                  Anlegen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <ClientEditor key={editing.original ?? "new"} original={editing.original} initial={editing.client} tags={data?.supportedTags ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function ClientEditor({ original, initial, tags, onClose, onSaved }: { original: string | null; initial: AdGuardClient; tags: string[]; onClose(): void; onSaved(): void }) {
  const { run } = useApp();
  const [client, setClient] = useState<AdGuardClient>(initial);
  const [idsText, setIdsText] = useState(initial.ids.join("\n"));
  const [upstreamText, setUpstreamText] = useState(initial.upstreams.join("\n"));
  const [busy, setBusy] = useState(false);
  const services = useResource<{ services: BlockedService[] }>("/api/services");
  const set = <K extends keyof AdGuardClient>(key: K, value: AdGuardClient[K]) => setClient((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setBusy(true);
    const body: AdGuardClient = {
      ...client,
      ids: idsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
      upstreams: upstreamText.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const ok = await run(
      () => (original ? api(`/api/clients/${encodeURIComponent(original)}`, { method: "PUT", body }) : api("/api/clients", { body })),
      original ? "Client gespeichert" : "Client angelegt",
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Sheet open onClose={onClose} title={original ? `Client: ${original}` : "Neuer Client"}>
      <div className="space-y-4">
        <Input label="Name" value={client.name} onChange={(e) => set("name", e.target.value)} />
        <TextArea label="Kennungen (IP, CIDR, MAC oder ClientID, eine pro Zeile)" rows={3} value={idsText} onChange={(e) => setIdsText(e.target.value)} className="font-mono" />
        <div className="space-y-3 rounded-xl border border-line p-3">
          <Toggle label="Globale Einstellungen nutzen" checked={client.use_global_settings} onChange={(v) => set("use_global_settings", v)} />
          {!client.use_global_settings && (
            <>
              <Toggle label="Filterung aktiv" checked={client.filtering_enabled} onChange={(v) => set("filtering_enabled", v)} />
              <Toggle label="Safe Browsing" checked={client.safebrowsing_enabled} onChange={(v) => set("safebrowsing_enabled", v)} />
              <Toggle label="Jugendschutz" checked={client.parental_enabled} onChange={(v) => set("parental_enabled", v)} />
              <Toggle label="SafeSearch erzwingen" checked={Boolean(client.safe_search?.enabled)} onChange={(v) => set("safe_search", { ...(client.safe_search ?? {}), enabled: v, bing: v, duckduckgo: v, google: v, pixabay: v, yandex: v, youtube: v })} />
            </>
          )}
          <Toggle label="Nicht im Query-Log speichern" checked={Boolean(client.ignore_querylog)} onChange={(v) => set("ignore_querylog", v)} />
          <Toggle label="Nicht in Statistik zaehlen" checked={Boolean(client.ignore_statistics)} onChange={(v) => set("ignore_statistics", v)} />
        </div>

        <div className="space-y-3 rounded-xl border border-line p-3">
          <Toggle label="Globale Dienst-Sperren nutzen" description="Aus: eigene Liste nur fuer dieses Geraet." checked={client.use_global_blocked_services} onChange={(v) => set("use_global_blocked_services", v)} />
          {!client.use_global_blocked_services && (
            services.data ? (
              <>
                <ServicePicker services={services.data.services} selected={client.blocked_services} onChange={(ids) => set("blocked_services", ids)} />
                <ScheduleEditor value={client.blocked_services_schedule} onChange={(s) => set("blocked_services_schedule", s)} />
              </>
            ) : (
              <Spinner />
            )
          )}
        </div>

        <TextArea label="Eigene Upstreams (optional, einer pro Zeile)" rows={2} value={upstreamText} onChange={(e) => setUpstreamText(e.target.value)} className="font-mono" />
        {tags.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-dim">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = client.tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => set("tags", active ? client.tags.filter((t) => t !== tag) : [...client.tags, tag])} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${active ? "border-accent text-accent" : "border-line text-dim"}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {original ? (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={async () => {
              if (!window.confirm(`Client "${original}" in AdGuard loeschen?`)) return;
              const ok = await run(() => api(`/api/clients/${encodeURIComponent(original)}/delete`, { body: {} }), "Client geloescht");
              if (ok) onSaved();
            }}>
              Loeschen
            </Button>
          ) : <span />}
          <Button variant="primary" loading={busy} onClick={save}>Speichern</Button>
        </div>
      </div>
    </Sheet>
  );
}

const PLATFORM_LABEL: Record<RoamingDevice["platform"], string> = { ios: "iPhone / iPad", macos: "Mac", android: "Android", windows: "Windows", other: "Sonstiges" };

function RoamingView() {
  const { run, toast } = useApp();
  const { data, error, loading, reload, setData } = useResource<{ settings: RoamingSettings; devices: RoamingDevice[]; signingAvailable: boolean }>("/api/roaming");
  const clients = useResource<ClientsResponse>("/api/clients");
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState<RoamingDevice | null>(null);
  const [form, setForm] = useState({ name: "", platform: "ios" as RoamingDevice["platform"], adguardClient: "" });

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="space-y-1">
            <p>Durchsetzung unterwegs: <Badge tone={data.settings.enforce ? "ok" : "warn"}>{data.settings.enforce ? "erzwungen" : "nur ausserhalb Heim-WLAN"}</Badge></p>
            <p>Offline-Cache: <Badge tone={data.settings.offlineCache ? "ok" : "neutral"}>{data.settings.offlineCache ? "aktiv" : "aus"}</Badge></p>
          </div>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Geraet hinzufuegen</Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-dim">Jedes Geraet bekommt eine eigene AdGuard-ClientID. Damit gelten seine Regeln auch im 5G-Mobilfunk und in fremden WLANs. Die Schalter dazu stehen unter Settings → Anti-Bypass.</p>
      </Card>

      {data.devices.length === 0 ? (
        <Empty>Noch kein Roaming-Geraet. Lege eins an und installiere das Profil.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.devices.map((device) => (
            <div key={device.id} className="rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-accent">
                    {device.platform === "ios" || device.platform === "macos" ? <Apple className="h-4 w-4" /> : device.platform === "android" ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="font-mono text-[11px] text-dim">{device.clientId}</p>
                  </div>
                </div>
                {device.stale ? <Badge tone="warn"><WifiOff className="h-3 w-3" /> still</Badge> : device.lastSeenAt ? <Badge tone="ok">aktiv</Badge> : <Badge>neu</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-line/60 py-1.5"><dt className="text-[10px] text-dim">Zuletzt</dt><dd className="text-xs">{relative(device.lastSeenAt)}</dd></div>
                <div className="rounded-lg border border-line/60 py-1.5"><dt className="text-[10px] text-dim">Protokoll</dt><dd className="font-mono text-xs uppercase">{device.lastProtocol ?? "–"}</dd></div>
                <div className="rounded-lg border border-line/60 py-1.5"><dt className="text-[10px] text-dim">Offline</dt><dd className="font-mono text-xs">{nf.format(device.offlineAnswers)}</dd></div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Toggle label="Aktiv" checked={device.enabled} onChange={async (enabled) => {
                  const updated = await run(() => api<RoamingDevice>(`/api/roaming/devices/${device.id}`, { method: "PATCH", body: { enabled } }));
                  if (updated) setData({ ...data, devices: data.devices.map((d) => (d.id === device.id ? updated : d)) });
                }} />
                <div className="flex gap-1.5">
                  <Button size="sm" icon={<QrIcon className="h-3.5 w-3.5" />} onClick={() => setSetup(device)}>Einrichten</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => {
                    if (!window.confirm(`${device.name} entfernen? Das Profil auf dem Geraet funktioniert danach nicht mehr.`)) return;
                    const ok = await run(() => api(`/api/roaming/devices/${device.id}/delete`, { body: {} }), "Geraet entfernt");
                    if (ok) reload();
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Roaming-Geraet hinzufuegen">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="iPhone von Max" />
          <Select label="Plattform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as RoamingDevice["platform"] })}>
            {Object.entries(PLATFORM_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
          <Select label="AdGuard-Client" value={form.adguardClient} onChange={(e) => setForm({ ...form, adguardClient: e.target.value })}>
            <option value="">Neuen Client mit diesem Namen anlegen</option>
            {(clients.data?.clients ?? []).map((c) => <option key={c.name} value={c.name}>An bestehenden Client haengen: {c.name}</option>)}
          </Select>
          <p className="text-xs text-dim">Haengst du das Geraet an einen bestehenden Client, gelten unterwegs exakt dieselben Regeln wie zu Hause.</p>
          <div className="flex justify-end">
            <Button variant="primary" disabled={!form.name.trim()} onClick={async () => {
              const created = await run(() => api<RoamingDevice>("/api/roaming/devices", { body: { name: form.name.trim(), platform: form.platform, adguardClient: form.adguardClient || null } }), "Geraet angelegt");
              if (created) {
                setAdding(false);
                setForm({ name: "", platform: "ios", adguardClient: "" });
                setData({ ...data, devices: [...data.devices, created] });
                setSetup(created);
              }
            }}>Anlegen</Button>
          </div>
        </div>
      </Sheet>

      {setup && <SetupSheet device={setup} signingAvailable={data.signingAvailable} onClose={() => setSetup(null)} onCopied={() => toast("Kopiert", "info")} />}
    </div>
  );
}

function SetupSheet({ device, signingAvailable, onClose, onCopied }: { device: RoamingDevice; signingAvailable: boolean; onClose(): void; onCopied(): void }) {
  const { run } = useApp();
  const [link, setLink] = useState<{ url: string; expiresAt: string; signed: boolean } | null>(null);
  const apple = device.platform === "ios" || device.platform === "macos";

  return (
    <Sheet open onClose={onClose} title={`Einrichten: ${device.name}`}>
      <div className="space-y-5 text-sm">
        {apple && (
          <section className="space-y-3">
            <h4 className="font-semibold">iOS / macOS Profil (.mobileconfig)</h4>
            {link ? (
              <div className="flex flex-col items-center gap-3">
                <QrCode value={link.url} />
                <a href={link.url} className="text-accent underline underline-offset-4">Profil direkt herunterladen</a>
                <p className="text-center text-xs text-dim">
                  Link gueltig bis {new Date(link.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · {link.signed ? "signiert (wird als verifiziert angezeigt)" : "unsigniert"}
                </p>
              </div>
            ) : (
              <Button variant="primary" onClick={async () => {
                const result = await run(() => api<{ url: string; expiresAt: string; signed: boolean }>(`/api/roaming/devices/${device.id}/profile-link`, { body: {} }));
                if (result) setLink(result);
              }}>
                Profil-Link mit QR-Code erzeugen
              </Button>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-xs text-dim">
              <li>QR-Code mit der Kamera scannen und in Safari oeffnen.</li>
              <li>Einstellungen → Profil geladen → Installieren.</li>
              <li>Fertig: DNS laeuft verschluesselt ueber DoH, auch im Mobilfunk.</li>
            </ol>
            {!signingAvailable && <p className="text-xs text-warn">Noch kein Let&apos;s-Encrypt-Zertifikat gefunden, das Profil wird unsigniert ausgeliefert. Es funktioniert trotzdem, iOS zeigt nur &quot;Nicht verifiziert&quot;.</p>}
          </section>
        )}
        {(device.platform === "android" || device.platform === "other") && (
          <section className="space-y-3">
            <h4 className="font-semibold">Android &quot;Privates DNS&quot; (DoT)</h4>
            <div className="flex justify-center"><QrCode value={device.dotHost} size={180} /></div>
            <CopyField label="Hostname des privaten DNS-Anbieters" value={device.dotHost} onCopied={onCopied} />
            <ol className="list-decimal space-y-1 pl-5 text-xs text-dim">
              <li>Einstellungen → Netzwerk &amp; Internet → Privates DNS.</li>
              <li>&quot;Hostname des privaten DNS-Anbieters&quot; waehlen und den Wert oben einfuegen.</li>
              <li>Speichern. Android nutzt jetzt immer DoT, in jedem Netz.</li>
            </ol>
          </section>
        )}
        <section className="space-y-3">
          <h4 className="font-semibold">DoH-Adresse (Browser, Windows, Router)</h4>
          <CopyField value={device.dohUrl} onCopied={onCopied} />
        </section>
      </div>
    </Sheet>
  );
}
