"use client";

import { THEMES, type ThemeId } from "@canvas/index";
import { Code2, ExternalLink, Monitor, Save, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useApp, useResource } from "@/lib/store";
import type { BlockPageConfig } from "@/lib/types";
import { CodeEditor } from "./RuleEditor";
import { Badge, Button, Card, ErrorBox, Input, PageTitle, Select, Spinner, Tabs, TextArea, Toggle, cx } from "./ui";

const VARIABLES = ["{domain}", "{client_name}", "{time_remaining}"];

const EXPERT_TEMPLATE = `<!doctype html>
<html lang="de">
<head><title>Gesperrt</title></head>
<body class="min-h-screen bg-black text-white flex items-center justify-center p-6">
  <div class="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
    <h1 class="text-3xl font-bold">{domain} ist gesperrt</h1>
    <p class="mt-3 text-white/60">Hallo {client_name}, diese Seite ist gerade nicht erlaubt.</p>
    <p class="mt-6 font-mono text-2xl text-emerald-400">{time_remaining}</p>
    <textarea data-request-message class="mt-6 w-full rounded-lg bg-black/40 p-3 text-sm" placeholder="Grund (optional)"></textarea>
    <button data-request-access class="mt-3 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-black">Zugang anfordern</button>
    <p data-request-status class="mt-3 text-sm text-emerald-300"></p>
  </div>
</body>
</html>`;

export function Studio() {
  const { run } = useApp();
  const { data, error, loading, reload, setData } = useResource<BlockPageConfig>("/api/blockpage");
  const [draft, setDraft] = useState<BlockPageConfig | null>(null);
  const [tab, setTab] = useState<"content" | "expert">("content");
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [preview, setPreview] = useState("");
  const [sample, setSample] = useState({ domain: "tiktok.com", clientName: "iPhone von Max", remainingMinutes: 95 });
  const [saving, setSaving] = useState(false);
  const focused = useRef<{ field: keyof BlockPageConfig; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  useEffect(() => {
    if (data) {
      setDraft(data);
      setTab(data.expertMode ? "expert" : "content");
    }
  }, [data]);

  useEffect(() => {
    if (!draft) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ html: string }>("/api/blockpage/preview", { body: { config: draft, ...sample }, signal: controller.signal })
        .then((result) => setPreview(result.html))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, sample]);

  if (loading && !draft) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!draft) return null;

  const set = <K extends keyof BlockPageConfig>(key: K, value: BlockPageConfig[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data);

  const insertVariable = (variable: string) => {
    const target = focused.current;
    if (!target) return;
    const { field, el } = target;
    const current = String(draft[field] ?? "");
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    set(field, `${current.slice(0, start)}${variable}${current.slice(end)}` as never);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const track = (field: keyof BlockPageConfig) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      focused.current = { field, el: e.currentTarget };
    },
  });

  return (
    <div>
      <PageTitle
        title="Block-Page Studio"
        subtitle="So sieht ein gesperrtes Geraet die Seite"
        action={<Button variant="primary" icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={saving} onClick={async () => {
          setSaving(true);
          const saved = await run(() => api<BlockPageConfig>("/api/blockpage", { method: "PUT", body: draft }), "Sperrseite veroeffentlicht");
          if (saved) setData(saved);
          setSaving(false);
        }}>Speichern</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_1fr]">
        <div className="space-y-4">
          <Card title="Modus">
            <div className="grid grid-cols-2 gap-2">
              {(["studio", "redirect"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => set("mode", mode)} className={cx("rounded-xl border p-3 text-left transition", draft.mode === mode ? "border-accent bg-accent/10" : "border-line hover:border-fg/30")}>
                  <p className="flex items-center gap-2 text-sm font-medium">{mode === "studio" ? <Sparkles className="h-4 w-4 text-accent" /> : <ExternalLink className="h-4 w-4 text-accent" />}{mode === "studio" ? "B · Live-Studio" : "A · Redirect"}</p>
                  <p className="mt-1 text-xs text-dim">{mode === "studio" ? "Eigene Sperrseite im Theme" : "Auf externe URL umleiten"}</p>
                </button>
              ))}
            </div>
            {draft.mode === "redirect" && (
              <Input className="mt-3" label="Ziel-URL (Variablen erlaubt, URL-codiert)" value={draft.redirectUrl} onChange={(e) => set("redirectUrl", e.target.value)} placeholder="https://example.com/blocked?d={domain}" inputMode="url" {...track("redirectUrl")} />
            )}
          </Card>

          {draft.mode === "studio" && (
            <Card>
              <Tabs value={tab} onChange={(t) => { setTab(t); set("expertMode", t === "expert"); }} items={[{ id: "content", label: "Bausteine", icon: <Sparkles className="h-4 w-4" /> }, { id: "expert", label: "Experte", icon: <Code2 className="h-4 w-4" /> }]} />
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-dim">Variable einfuegen:</span>
                {VARIABLES.map((v) => (
                  <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVariable(v)} className="rounded-full border border-accent/40 px-2 py-0.5 font-mono text-[11px] text-accent hover:bg-accent/10">{v}</button>
                ))}
              </div>

              {tab === "content" ? (
                <div className="space-y-3">
                  <Select label="Theme der Sperrseite" value={draft.theme} onChange={(e) => set("theme", e.target.value as ThemeId)}>
                    {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <Input label="Titel" value={draft.title} onChange={(e) => set("title", e.target.value)} {...track("title")} />
                  <TextArea label="Alarm-Meldung" rows={3} value={draft.alert} onChange={(e) => set("alert", e.target.value)} {...track("alert")} />
                  <Select label="Stufe" value={draft.alertLevel} onChange={(e) => set("alertLevel", e.target.value as BlockPageConfig["alertLevel"])}>
                    <option value="info">Hinweis</option>
                    <option value="warning">Warnung</option>
                    <option value="critical">Kritisch</option>
                  </Select>
                  <div className="space-y-2.5 rounded-xl border border-line p-3">
                    <Toggle label="Domain anzeigen" checked={draft.showDomain} onChange={(v) => set("showDomain", v)} />
                    <Toggle label="Geraetename anzeigen" checked={draft.showClient} onChange={(v) => set("showClient", v)} />
                    <Toggle label="Live-Countdown" description="Zeit bis zum naechsten Freizeit-Fenster aus dem AdGuard-Zeitplan" checked={draft.showCountdown} onChange={(v) => set("showCountdown", v)} />
                    <Toggle label="„Zugang anfordern“-Button" description="Anfrage landet im Dashboard, Freigabe mit einem Tipp" checked={draft.showRequestButton} onChange={(v) => set("showRequestButton", v)} />
                  </div>
                  {draft.showRequestButton && <TextArea label="Hinweis ueber dem Button" rows={2} value={draft.requestHint} onChange={(e) => set("requestHint", e.target.value)} {...track("requestHint")} />}
                  <Input label="Fusszeile" value={draft.footer} onChange={(e) => set("footer", e.target.value)} {...track("footer")} />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-dim">
                    Eigenes HTML mit Tailwind (wird per CDN geladen). Elemente mit <code className="text-fg">data-request-access</code>, <code className="text-fg">data-request-message</code>, <code className="text-fg">data-request-status</code> und <code className="text-fg">data-countdown</code> werden automatisch verdrahtet.
                  </p>
                  <CodeEditor language="html" value={draft.customHtml} onChange={(v) => set("customHtml", v)} minHeight={420} />
                  {!draft.customHtml.trim() && <Button size="sm" onClick={() => set("customHtml", EXPERT_TEMPLATE)}>Vorlage laden</Button>}
                </div>
              )}
            </Card>
          )}

          <Card title="Vorschau-Daten">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Domain" value={sample.domain} onChange={(e) => setSample({ ...sample, domain: e.target.value })} />
              <Input label="Geraet" value={sample.clientName} onChange={(e) => setSample({ ...sample, clientName: e.target.value })} />
              <Input label="Restzeit (Min)" type="number" min={0} value={sample.remainingMinutes} onChange={(e) => setSample({ ...sample, remainingMinutes: Math.max(0, Number(e.target.value)) })} />
            </div>
          </Card>
        </div>

        <Card
          title="Live-Vorschau"
          className="xl:sticky xl:top-20 xl:self-start"
          action={
            <div className="flex items-center gap-2">
              {dirty && <Badge tone="warn">Entwurf</Badge>}
              <div className="flex rounded-xl border border-line p-0.5">
                <button type="button" onClick={() => setDevice("mobile")} className={cx("rounded-lg p-1.5", device === "mobile" ? "bg-accent text-bg" : "text-dim")} title="Mobil"><Smartphone className="h-4 w-4" /></button>
                <button type="button" onClick={() => setDevice("desktop")} className={cx("rounded-lg p-1.5", device === "desktop" ? "bg-accent text-bg" : "text-dim")} title="Desktop"><Monitor className="h-4 w-4" /></button>
              </div>
            </div>
          }
        >
          {draft.mode === "redirect" ? (
            <div className="flex h-[560px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-center text-sm text-dim">
              <ExternalLink className="h-6 w-6 text-accent" />
              Gesperrte Aufrufe werden per HTTP 302 umgeleitet nach
              <span className="max-w-full break-all px-4 font-mono text-accent">{draft.redirectUrl.replace("{domain}", sample.domain).replace("{client_name}", encodeURIComponent(sample.clientName)) || "…"}</span>
            </div>
          ) : (
            <div className="flex justify-center rounded-xl bg-black/40 p-3">
              <div className={cx("overflow-hidden border border-line bg-black shadow-glow transition-all", device === "mobile" ? "h-[640px] w-[340px] rounded-[2.2rem] border-[6px]" : "h-[560px] w-full rounded-xl")}>
                <iframe title="Sperrseiten-Vorschau" srcDoc={preview} sandbox="allow-scripts" className="h-full w-full" />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
