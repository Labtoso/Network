"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Github, Globe, Palette, Server, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, getApiBase, setApiBase } from "@/lib/api";
import { relative } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { SettingsResponse } from "@/lib/types";
import { AdGuardForm } from "./AdGuardForm";
import { GoogleButton } from "./GoogleButton";
import { ForbiddenScreen } from "./LoginScreen";
import { ThemePicker } from "./ThemePicker";
import { Button, Input, cx } from "./ui";

const STEPS = [
  { id: "theme", label: "Theme", icon: Palette },
  { id: "backend", label: "Backend", icon: Server },
  { id: "login", label: "Login", icon: ShieldCheck },
  { id: "adguard", label: "AdGuard", icon: Globe },
  { id: "admin", label: "Admin", icon: UserCheck },
  { id: "pages", label: "Pages", icon: Github },
] as const;

export function SetupWizard({ onDone }: { onDone?(): void }) {
  const { theme, setTheme, intensity, setIntensity, config, configError, reloadConfig, session, run } = useApp();
  const [step, setStep] = useState(0);
  const [apiInput, setApiInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [adguardSaved, setAdguardSaved] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [forbidden, setForbidden] = useState<{ email: string | null; message: string } | null>(null);
  const onForbidden = useCallback((email: string | null, message: string) => setForbidden({ email, message }), []);

  useEffect(() => setApiInput(getApiBase() || (typeof window !== "undefined" ? window.location.origin : "")), []);
  useEffect(() => {
    if (session && step >= 3) api<SettingsResponse>("/api/settings").then(setSettings).catch(() => undefined);
  }, [session, step]);
  useEffect(() => {
    if (settings?.adguard.url) setAdguardSaved(true);
  }, [settings]);

  const canNext = [true, Boolean(config), Boolean(session), adguardSaved, true, true][step];
  const pagesOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (forbidden) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <ForbiddenScreen {...forbidden} onBack={() => setForbidden(null)} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-10 pt-[calc(env(safe-area-inset-top)+24px)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">Erste Einrichtung</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Network Setup-Assistent</h1>

      <ol className="mt-6 grid grid-cols-6 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-col items-center gap-1.5">
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl border transition", i < step ? "border-accent bg-accent text-bg" : i === step ? "border-accent text-accent" : "border-line text-dim")}>
              <s.icon className="h-4 w-4" />
            </span>
            <span className={cx("text-[10px] sm:text-xs", i === step ? "text-fg" : "text-dim")}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex-1 rounded-3xl border border-line bg-panel/85 p-5 backdrop-blur-xl sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">1 · Theme &amp; Canvas</h2>
                  <p className="mt-1 text-sm text-dim">Waehle eines der fuenf Dark-Themes. Der Live-Canvas im Hintergrund reagiert auf Maus und Touch.</p>
                </div>
                <ThemePicker value={theme} onChange={(id) => setTheme(id)} />
                <label className="block">
                  <span className="mb-2 flex justify-between text-xs text-dim">
                    <span>Canvas-Intensitaet</span>
                    <span className="font-mono">{Math.round(intensity * 100)}%</span>
                  </span>
                  <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full accent-[rgb(var(--accent))]" />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">2 · Backend &amp; DuckDNS</h2>
                  <p className="mt-1 text-sm text-dim">
                    Das Panel ist eine statische Seite. Alle Daten kommen vom Backend auf deinem Proxmox-LXC, erreichbar ueber deine DuckDNS-Domain mit HTTPS von Caddy.
                  </p>
                </div>
                <Input label="Backend-URL" value={apiInput} onChange={(e) => setApiInput(e.target.value)} placeholder="https://labtoso.duckdns.org" inputMode="url" hint="Leer lassen, wenn das Panel direkt vom Backend ausgeliefert wird." />
                <Button
                  variant="primary"
                  loading={testing}
                  onClick={async () => {
                    setTesting(true);
                    setApiBase(apiInput === window.location.origin ? "" : apiInput);
                    await reloadConfig();
                    setTesting(false);
                  }}
                >
                  Verbindung testen
                </Button>
                <div className="space-y-2 rounded-xl border border-line bg-bg/50 p-3 text-sm">
                  {config ? (
                    <>
                      <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" /> Backend v{config.version} erreichbar unter <span className="font-mono text-accent">{config.publicUrl}</span></p>
                      <p className="flex items-center gap-2">
                        {config.duckdns.ok ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <XCircle className="h-4 w-4 text-warn" />}
                        DuckDNS {config.duckdns.domain ?? "nicht konfiguriert"}: {config.duckdns.ok ? `synchron (${relative(config.duckdns.checkedAt)})` : "noch kein erfolgreiches Update"}
                      </p>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 text-danger"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {configError ?? "Noch nicht getestet."}</p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 text-center">
                <div className="text-left">
                  <h2 className="text-lg font-semibold">3 · Anmeldung</h2>
                  <p className="mt-1 text-sm text-dim">Ab hier braucht jede Einstellung den Admin-Login. Das Backend prueft das Google-Token kryptografisch.</p>
                </div>
                {session ? (
                  <p className="flex items-center justify-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-ok" /> Angemeldet als <span className="font-mono text-accent">{session.email}</span></p>
                ) : (
                  <GoogleButton onForbidden={onForbidden} onSuccess={() => setStep(3)} />
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">4 · AdGuard Home verbinden</h2>
                  <p className="mt-1 text-sm text-dim">Lokale Adresse deiner AdGuard-Instanz. Fuer den Roaming-Schutz muss AdGuard unverschluesseltes DoH annehmen (der Test zeigt es an).</p>
                </div>
                <AdGuardForm onSaved={() => setAdguardSaved(true)} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">5 · Admin-Whitelist</h2>
                  <p className="mt-1 text-sm text-dim">Nur diese Google-Accounts kommen ins Panel. Jeder andere Account bekommt 403 Forbidden.</p>
                </div>
                <ul className="space-y-2">
                  {(settings?.allowedEmails ?? []).map((email) => (
                    <li key={email} className="flex items-center gap-2 rounded-xl border border-line bg-bg/50 px-3 py-2.5 font-mono text-sm">
                      <UserCheck className="h-4 w-4 text-accent" /> {email}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-dim">
                  Die Liste steht bewusst nur in der Server-Konfiguration (<code className="text-fg">ALLOWED_EMAIL</code> in <code className="text-fg">/opt/network/.env</code>), damit sie sich nicht ueber das Web aendern laesst. Aendern mit <code className="text-fg">./manage.sh setup</code>.
                </p>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4 text-sm leading-relaxed">
                <h2 className="text-lg font-semibold">6 · So haengen GitHub Pages und Backend zusammen</h2>
                <ol className="list-decimal space-y-2 pl-5 text-dim">
                  <li><span className="text-fg">GitHub Pages</span> liefert nur die statischen Dateien aus <code>out/</code> (HTML, JS, CSS). Dort liegen keine Daten und keine Geheimnisse.</li>
                  <li>Der Browser ruft die API auf <span className="font-mono text-accent">{config?.publicUrl}</span> auf. Caddy terminiert HTTPS (Let&apos;s Encrypt per DuckDNS DNS-01) und leitet an das Node-Backend weiter.</li>
                  <li>Das Backend erlaubt per CORS nur diese Herkuenfte: <span className="font-mono text-fg">{settings?.corsOrigins.join(", ")}</span>. Aktuelle Seite: <span className="font-mono text-fg">{pagesOrigin}</span>.</li>
                  <li>Login: Google-Button → ID-Token → Backend prueft Signatur + E-Mail → eigenes JWT als Bearer-Token. Keine Cross-Site-Cookies, damit es auch in Safari funktioniert.</li>
                  <li>In der Google Cloud Console muessen beide Herkuenfte als &quot;Autorisierte JavaScript-Quellen&quot; eingetragen sein.</li>
                  <li>Faellt DuckDNS aus, ist das Panel ueber Tailscale erreichbar: <span className="font-mono text-fg">http://&lt;tailscale-ip&gt;</span>.</li>
                </ol>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Zurueck
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Weiter <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={async () => {
              const ok = await run(() => api("/api/setup/complete", { body: {} }), "Einrichtung abgeschlossen");
              if (ok) {
                setTheme(theme, true);
                await reloadConfig();
                onDone?.();
              }
            }}
          >
            Fertig <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </main>
  );
}
