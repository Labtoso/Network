"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Code,
  ExternalLink,
  Eye,
  Globe,
  Layout,
  Lock,
  Monitor,
  Palette,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
} from "lucide-react";
import { THEME_LIST, ThemeConfig, ThemeId } from "@/lib/themes";
import {
  BlockPageStudioConfig,
  ClientDeviceProfile,
  GlobalPolicySettings,
} from "@/lib/network-state";
import { ALLOWED_OWNER_EMAIL, PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";
import type { AdGuardStatusResponse } from "@/lib/adguard-model";

interface BlockStudioProps {
  theme: ThemeConfig;
  blockPage: BlockPageStudioConfig;
  onMutateControl: (payload: Record<string, unknown>) => Promise<void>;
}

export function BlockPageStudio({
  theme,
  blockPage,
  onMutateControl,
}: BlockStudioProps) {
  const [form, setForm] = useState<BlockPageStudioConfig>(blockPage);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "mobile"
  );
  const [sampleDomain, setSampleDomain] = useState("tiktok.com");
  const [sampleClient, setSampleClient] = useState("Jonas iPhone 15");

  const interpolate = (txt: string) =>
    txt
      .replace(/\{domain\}/g, sampleDomain)
      .replace(/\{client_name\}/g, sampleClient)
      .replace(/\{time_remaining\}/g, `${form.countdownMinutes}:00 Min`)
      .replace(/\{curfew_reason\}/g, form.curfewReason);

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    await onMutateControl({
      action: "update_block_page",
      ...form,
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Studio Mode Switcher */}
      <div
        className="rounded-xl p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: theme.colors.bgPanel,
          border: `1px solid ${theme.colors.borderStrong}`,
        }}
      >
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white">
            Visueller Blocking-Site Editor (Custom Block Page Studio)
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Konfiguriere, was Nutzer sehen, wenn AdGuard Home oder der 5G-Roaming-Filter eine Domain sperrt.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {(
            [
              { id: "redirect", label: "Modus A: URL-Weiterleitung", icon: Globe },
              { id: "studio", label: "Modus B: Live-Studio Editor", icon: Layout },
              { id: "code", label: "Experten-Tab: HTML / Tailwind", icon: Code },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const active = form.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm({ ...form, mode: m.id })}
                className="px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  backgroundColor: active
                    ? theme.colors.accent
                    : "rgba(255,255,255,0.04)",
                  color: active ? "#050505" : "#E4E4E7",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split Editor & Real-Time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Editor Configuration */}
        <form
          onSubmit={handleSaveStudio}
          className="lg:col-span-6 rounded-xl p-5 backdrop-blur-xl space-y-4"
          style={{
            backgroundColor: theme.colors.bgPanel,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {form.mode === "redirect" ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Modus A: Einfache URL-Weiterleitung (External Redirect)
              </h3>
              <p className="text-xs text-zinc-400">
                Alle gesperrten Anfragen werden automatisch auf diese externe oder interne Zieladresse umgeleitet (z. B. Wikipedia, Google, Schulportal):
              </p>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Ziel-URL für Weiterleitung
                </label>
                <input
                  type="url"
                  value={form.redirectUrl}
                  onChange={(e) =>
                    setForm({ ...form, redirectUrl: e.target.value })
                  }
                  placeholder="https://de.wikipedia.org"
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs font-mono text-white"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Wikipedia", url: "https://de.wikipedia.org" },
                  { label: "Google", url: "https://www.google.de" },
                  { label: "Anton Lern-App", url: "https://anton.app/de/" },
                ].map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, redirectUrl: preset.url })
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-zinc-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : form.mode === "code" ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Experten-Code-Modus (Custom HTML & Tailwind CSS)
              </h3>
              <p className="text-xs font-mono text-zinc-400">
                Unterstützte Variablen: <code className="text-white">&#123;domain&#125;</code>,{" "}
                <code className="text-white">&#123;client_name&#125;</code>,{" "}
                <code className="text-white">&#123;time_remaining&#125;</code>,{" "}
                <code className="text-white">&#123;curfew_reason&#125;</code>
              </p>
              <textarea
                value={form.customHtml}
                onChange={(e) =>
                  setForm({ ...form, customHtml: e.target.value })
                }
                rows={12}
                spellCheck={false}
                className="w-full p-3.5 rounded-xl bg-[#040406] border border-white/15 font-mono text-xs text-emerald-300"
              />
            </div>
          ) : (
            <div className="space-y-3.5">
              <h3 className="text-sm font-semibold text-white">
                Modus B: Integrierter Live-Editor (Self-Built Blocking Page)
              </h3>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Titel / Headline
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Sperrgrund (<code className="text-white">&#123;curfew_reason&#125;</code>)
                </label>
                <input
                  type="text"
                  value={form.curfewReason}
                  onChange={(e) =>
                    setForm({ ...form, curfewReason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono text-zinc-400">
                    Alarm-Meldung (Dynamische Variablen anklicken zum Einfügen)
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    "{domain}",
                    "{client_name}",
                    "{time_remaining}",
                    "{curfew_reason}",
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          alarmMessage: `${form.alarmMessage} ${v}`,
                        })
                      }
                      className="px-2 py-0.5 rounded text-[11px] font-mono"
                      style={{
                        backgroundColor: theme.colors.accentMuted,
                        color: theme.colors.accent,
                      }}
                    >
                      + {v}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={form.alarmMessage}
                  onChange={(e) =>
                    setForm({ ...form, alarmMessage: e.target.value })
                  }
                  className="w-full p-3 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, showCountdown: !form.showCountdown })
                  }
                  className="p-3 rounded-xl text-left font-mono text-xs border"
                  style={{
                    backgroundColor: form.showCountdown
                      ? theme.colors.accentMuted
                      : "rgba(255,255,255,0.02)",
                    borderColor: form.showCountdown
                      ? theme.colors.borderStrong
                      : theme.colors.border,
                  }}
                >
                  <div className="font-bold text-white">
                    [{form.showCountdown ? "x" : " "}] Countdown-Timer
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Zeigt verbleibende Sperrzeit ({form.countdownMinutes} Min)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      allowUnblockRequest: !form.allowUnblockRequest,
                    })
                  }
                  className="p-3 rounded-xl text-left font-mono text-xs border"
                  style={{
                    backgroundColor: form.allowUnblockRequest
                      ? theme.colors.accentMuted
                      : "rgba(255,255,255,0.02)",
                    borderColor: form.allowUnblockRequest
                      ? theme.colors.borderStrong
                      : theme.colors.border,
                  }}
                >
                  <div className="font-bold text-white">
                    [{form.allowUnblockRequest ? "x" : " "}] „Zugang anfordern“-Button
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Sendet Echtzeit-Push (+15/+30 Min) ans Admin-Panel
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Local Root-CA SSL status */}
          <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between text-emerald-400">
              <span>✓ Lokale Root-CA (openssl) für HTTPS-Sperrseite bereit</span>
              <span>TLS 1.3</span>
            </div>
            <div className="text-zinc-500 truncate">
              Fingerprint: {form.sslRootCaFingerprint}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <a
              href={`/block?domain=${encodeURIComponent(
                sampleDomain
              )}&client=jonas-iphone`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl text-xs font-mono flex items-center gap-1.5 border border-white/15 text-zinc-200 hover:bg-white/5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live /block Seite öffnen</span>
            </a>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all hover:brightness-110"
              style={{
                backgroundColor: theme.colors.accent,
                color: "#050505",
              }}
            >
              Sperrseite speichern & aktivieren
            </button>
          </div>
        </form>

        {/* Right 6 Cols: Real-Time Mobile & Desktop Preview */}
        <div
          className="lg:col-span-6 rounded-xl p-5 backdrop-blur-xl space-y-4 flex flex-col justify-between"
          style={{
            backgroundColor: theme.colors.bgPanel,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Eye
                className="w-4 h-4"
                style={{ color: theme.colors.accent }}
              />
              <span className="text-xs font-mono font-bold uppercase text-white">
                Echtzeit-Vorschau ({theme.name})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={sampleDomain}
                onChange={(e) => setSampleDomain(e.target.value)}
                className="px-2 py-1 rounded bg-black/60 border border-white/10 text-[11px] font-mono text-white w-28"
                title="Test-Domain für Vorschau"
              />
              <button
                type="button"
                onClick={() => setPreviewViewport("mobile")}
                className="px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1"
                style={{
                  backgroundColor:
                    previewViewport === "mobile"
                      ? theme.colors.accentMuted
                      : "transparent",
                  color:
                    previewViewport === "mobile"
                      ? theme.colors.accent
                      : "#A1A1AA",
                }}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Handy</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport("desktop")}
                className="px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1"
                style={{
                  backgroundColor:
                    previewViewport === "desktop"
                      ? theme.colors.accentMuted
                      : "transparent",
                  color:
                    previewViewport === "desktop"
                      ? theme.colors.accent
                      : "#A1A1AA",
                }}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
            </div>
          </div>

          {/* Framed Preview Viewport */}
          <div className="flex-1 flex items-center justify-center py-2">
            <div
              className={`rounded-2xl p-5 transition-all duration-300 space-y-4 ${
                previewViewport === "mobile" ? "w-[330px]" : "w-full"
              }`}
              style={{
                backgroundColor: theme.colors.bgBase,
                border: `1.5px solid ${theme.colors.borderStrong}`,
                boxShadow: `0 0 35px rgba(0,0,0,0.75)`,
              }}
            >
              {form.mode === "redirect" ? (
                <div className="p-5 text-center font-mono space-y-3">
                  <Globe
                    className="w-8 h-8 mx-auto"
                    style={{ color: theme.colors.accent }}
                  />
                  <div className="text-xs uppercase text-zinc-400">
                    HTTP 302 REDIRECT AKTIV
                  </div>
                  <div className="text-sm font-bold text-white break-all">
                    {sampleDomain} ➔ {form.redirectUrl}
                  </div>
                </div>
              ) : form.mode === "code" ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: interpolate(form.customHtml),
                  }}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      DNS SINKHOLE // BLOCKED
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      5G / WLAN
                    </span>
                  </div>

                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {form.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {form.subtitle}
                    </div>
                  </div>

                  <div
                    className="p-3 rounded-xl font-mono text-xs leading-relaxed"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    {interpolate(form.alarmMessage)}
                  </div>

                  {form.showCountdown && (
                    <div
                      className="p-2.5 rounded-xl flex items-center justify-between font-mono text-xs"
                      style={{
                        backgroundColor: theme.colors.accentMuted,
                        border: `1px solid ${theme.colors.borderStrong}`,
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Freigabe in:</span>
                      </span>
                      <span
                        className="font-bold"
                        style={{ color: theme.colors.accent }}
                      >
                        {form.countdownMinutes}:00 Min
                      </span>
                    </div>
                  )}

                  {form.allowUnblockRequest && (
                    <button
                      type="button"
                      onClick={() =>
                        onMutateControl({
                          action: "create_unblock_request",
                          clientId: "jonas-iphone",
                          clientName: sampleClient,
                          domain: sampleDomain,
                          requestedMinutes: 30,
                        })
                      }
                      className="w-full py-2 px-3 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: theme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Zugang anfordern (+30 Min Test senden)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SetupWizardModalProps {
  open: boolean;
  onClose: () => void;
  themeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  policy: GlobalPolicySettings;
  devices: ClientDeviceProfile[];
  onMutateControl: (payload: Record<string, unknown>) => Promise<boolean>;
  onAdGuardPaired: (policy: GlobalPolicySettings) => void;
}

export function SetupWizardModal({
  open,
  onClose,
  themeId,
  onSelectTheme,
  policy,
  devices,
  onMutateControl,
  onAdGuardPaired,
}: SetupWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [adguardUrlInput, setAdguardUrlInput] = useState(policy.adguardUrl);
  const [adguardUserInput, setAdguardUserInput] = useState(
    policy.adguardUsername || "admin"
  );
  const [handshake, setHandshake] = useState<AdGuardStatusResponse | null>(null);
  const [testingHandshake, setTestingHandshake] = useState(false);

  if (!open) return null;
  const currentTheme =
    THEME_LIST.find((t) => t.id === themeId) || THEME_LIST[0];

  const handleFinishOrDismiss = async () => {
    if (policy.onboardingCompleted) {
      onClose();
      return;
    }
    const saved = await onMutateControl({
      action: "update_policy",
      onboardingCompleted: true,
    });
    if (!saved) return;
    try {
      localStorage.setItem("labtoso-setup-completed", "true");
    } catch {
      // ignore
    }
    onClose();
  };

  const handleAdGuardHandshake = async () => {
    setTestingHandshake(true);
    setHandshake(null);
    try {
      const response = await fetch("/api/adguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "handshake",
          url: adguardUrlInput,
          username: adguardUserInput,
        }),
      });
      const data = await response.json();
      if (data.status) {
        setHandshake(data.status);
        if (response.ok && data.status.connected && data.policy) onAdGuardPaired(data.policy);
      } else {
        setHandshake({ connected: false, url: adguardUrlInput, error: data.error || "Statusabfrage fehlgeschlagen." });
      }
    } catch {
      setHandshake({ connected: false, url: adguardUrlInput, error: "Das Panel konnte die Statusabfrage nicht ausführen." });
    } finally {
      setTestingHandshake(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && policy.onboardingCompleted) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: "#08080C",
          border: `1px solid ${currentTheme.colors.borderStrong}`,
        }}
      >
        {/* Wizard Progress Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold"
                style={{
                  backgroundColor: currentTheme.colors.accentMuted,
                  color: currentTheme.colors.accent,
                }}
              >
                SCHRITT {step} VON 5 // SCHRITT-FÜR-SCHRITT EINRICHTUNG
              </span>
              {policy.onboardingCompleted && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                  ✓ BEREITS EINGERICHTET
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1.5">
              Interaktiver Setup- &amp; Verbindungsassistent
            </h2>
          </div>

          <button
            type="button"
            onClick={handleFinishOrDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Assistent schließen (wird nicht erneut automatisch eingeblendet)"
          >
            {policy.onboardingCompleted ? "Schließen ✕" : "Überspringen & Schließen ✕"}
          </button>
        </div>

        {/* Clickable 5-Step Progress Pills */}
        <div className="grid grid-cols-5 gap-1.5 font-mono text-[10px]">
          {[
            { n: 1, label: "1. Theme" },
            { n: 2, label: "2. AdGuard" },
            { n: 3, label: "3. Router/DNS" },
            { n: 4, label: "4. Zero-Trust" },
            { n: 5, label: "5. 5G-Handys" },
          ].map((s) => {
            const active = step === s.n;
            const done = step > s.n || policy.onboardingCompleted;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n as typeof step)}
                className="py-1.5 px-2 rounded-lg text-center truncate transition-all"
                style={{
                  backgroundColor: active
                    ? currentTheme.colors.accent
                    : done
                    ? currentTheme.colors.accentMuted
                    : "rgba(255,255,255,0.04)",
                  color: active
                    ? "#050505"
                    : done
                    ? currentTheme.colors.accent
                    : "#94A3B8",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Step 1: 5 Dark-Themes & Live Canvas */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Schritt 1: Wähle dein Dark-Theme &amp; Live-Canvas-Design
              </h3>
              <p className="text-xs font-mono text-zinc-400 mt-1">
                Was hier passiert: Dein gewähltes Theme und der 60-FPS-Canvas-Hintergrund werden dauerhaft gespeichert und auch für die Sperrseite (<code className="text-white">/block</code>) übernommen.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {THEME_LIST.map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTheme(t.id)}
                    className="p-3.5 rounded-xl text-left flex items-center justify-between transition-all"
                    style={{
                      backgroundColor: active
                        ? t.colors.accentMuted
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${
                        active ? t.colors.borderStrong : t.colors.border
                      }`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{
                          backgroundColor: t.colors.accent,
                          boxShadow: `0 0 10px ${t.colors.accent}`,
                        }}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {t.subtitle}
                        </div>
                      </div>
                    </div>
                    {active && (
                      <Check
                        className="w-4 h-4"
                        style={{ color: t.colors.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Local AdGuard Home Pairing */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Schritt 2: AdGuard Home Schritt für Schritt verbinden
              </h3>
              <div className="mt-2 p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono space-y-1.5 text-zinc-300">
                <div className="text-white font-bold">So verbindest du AdGuard Home (1:1 Live-Mirror):</div>
                <div>1. Prüfe in ZimaOS / Proxmox, unter welcher IP &amp; welchem Port AdGuard Home läuft (Standard bei dir: <code className="text-white">http://192.168.178.67:3001</code>).</div>
                <div>2. Für eine geschützte Instanz hinterlege <code>ADGUARD_URL</code>, <code>ADGUARD_USER</code> und <code>ADGUARD_PASSWORD</code> in der Serverdatei <code>.env</code>. Starte danach den Panel-Dienst neu.</div>
                <div>3. Trage dieselbe URL ein und prüfe die Verbindung. Das Panel übernimmt die Adresse nach erfolgreicher Antwort von <code>/control/status</code>.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={adguardUrlInput}
                onChange={(e) => { setAdguardUrlInput(e.target.value); setHandshake(null); }}
                disabled={testingHandshake}
                aria-label="AdGuard-Adresse"
                placeholder="http://192.168.178.67:3001"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-mono text-white"
              />
              <input
                type="text"
                value={adguardUserInput}
                onChange={(e) => { setAdguardUserInput(e.target.value); setHandshake(null); }}
                disabled={testingHandshake}
                aria-label="AdGuard-Benutzer"
                placeholder="Benutzer (admin)"
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-mono text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleAdGuardHandshake}
              disabled={testingHandshake || !adguardUrlInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all hover:brightness-110"
              style={{
                backgroundColor: currentTheme.colors.accent,
                color: "#050505",
              }}
            >
              {testingHandshake
                ? "Prüfe AdGuard API-Handshake..."
                : "AdGuard-Verbindung prüfen"}
            </button>

            {handshake && (
              <div role="status" className={`p-3.5 rounded-xl border text-xs font-mono ${handshake.connected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
                {handshake.connected
                  ? `AdGuard Home ${handshake.version} ist verbunden (${handshake.latencyMs} ms).`
                  : handshake.error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Network & rDNS Check */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Schritt 3: Router (FRITZ!Box) &amp; Klarnamen-Auflösung (rDNS) verbinden
            </h3>
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono space-y-2 text-zinc-300">
              <div className="text-white font-bold">Damit alle Geräte automatisch gefiltert und mit Namen erkannt werden:</div>
              <div>
                <strong>1. In der FRITZ!Box (<code className="text-white">http://192.168.178.1</code>):</strong><br />
                Öffne <em>Heimnetz ➔ Netzwerk ➔ Netzwerkeinstellungen ➔ IPv4-Einstellungen</em> und trage unter <strong>Lokaler DNS-Server</strong> die IP <code className="text-emerald-400">192.168.178.67</code> (ohne Port) ein.
              </div>
              <div>
                <strong>2. In AdGuard Home für Gerätenamen (rDNS):</strong><br />
                Unter <em>Einstellungen ➔ DNS-Einstellungen ➔ Private Reverse-DNS-Server</em> die Router-IP <code className="text-emerald-400">192.168.178.1</code> eintragen. Dadurch zeigt das Panel automatisch Namen wie <code className="text-white">Predator-PC.fritz.box</code> statt nur IP-Adressen.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Erkanntes Gateway:</span>
                <span className="text-white font-bold">
                  {policy.routerGateway}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Reverse-DNS (rDNS):</span>
                <span className="text-emerald-400 font-bold">
                  ✓ AKTIV (*.fritz.box ➔ Klarnamen)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Synchronisierte Clients:</span>
                <span className="text-white">{devices.length} Geräte im Cache</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Admin Protection Whitelist & Cloudflare Zero Trust */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Schritt 4: Cloudflare Zero Trust &amp; Admin-Schutz (Whitelist)
            </h3>

            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono space-y-1.5 text-zinc-300">
              <div className="text-white font-bold">So schützt du <code className="text-emerald-400">https://{PUBLIC_ZERO_TRUST_DOMAIN}</code> von außen:</div>
              <div>1. In <strong>Cloudflare Zero Trust</strong> ➔ <em>Networks ➔ Tunnels</em> den Hostnamen <code className="text-white">{PUBLIC_ZERO_TRUST_DOMAIN}</code> auf <code className="text-white">http://localhost:3000</code> routen.</div>
              <div>2. Unter <em>Access ➔ Applications</em> eine Self-Hosted App für <code className="text-white">{PUBLIC_ZERO_TRUST_DOMAIN}</code> mit <strong>Google Login</strong> anlegen.</div>
              <div>3. Als Policy-Regel: <strong>Include ➔ Emails ➔ <code className="text-emerald-400">{ALLOWED_OWNER_EMAIL}</code></strong> setzen.</div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs space-y-2 text-emerald-200">
              <div className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Automatischer Admin-Schutz (Unblockierbare Whitelist)</span>
              </div>
              <p>
                Dein Google-Konto <strong>{ALLOWED_OWNER_EMAIL}</strong> sowie{" "}
                <strong>Predator-PC (192.168.178.24)</strong> und{" "}
                <strong>ZimaOS (192.168.178.67)</strong> sind fest in der Whitelist verankert – selbst beim Drücken des 🛑 <em>Notfall-Kill-Switch</em> bleibt dein eigener PC immer online.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Roaming DoH/DoT Profiles */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Schritt 5: Handys gegen WLAN-Ausschalten &amp; 5G-Hotspot-Bypass sichern
            </h3>
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono space-y-1.5 text-zinc-300">
              <div className="text-white font-bold">So aktivierst du den Unterwegs-Schutz auf Smartphones:</div>
              <div>• <strong>iPhone / iPad:</strong> Klicke unten neben dem Gerät auf <strong>„iOS .mobileconfig laden“</strong> und installiere das Profil in den iOS-Einstellungen (erzwingt verschlüsseltes DoH auch im 5G-Mobilfunknetz).</div>
              <div>• <strong>Android:</strong> Trage unter <em>Einstellungen ➔ Netzwerk &amp; Internet ➔ Privates DNS</em> den angezeigten DoT-Hostnamen ein.</div>
            </div>

            <div className="space-y-2">
              {devices
                .filter((d) => !d.isAdminProtected)
                .map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-black/60 border border-white/10 flex flex-wrap items-center justify-between gap-2 font-mono text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{d.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        Android Privates DNS:{" "}
                        <code className="text-white">{d.id}.dot.labtoso.de</code>
                      </div>
                    </div>
                    <a
                      href={`/api/profiles/${encodeURIComponent(
                        d.id
                      )}/mobileconfig?proto=doh`}
                      download
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                      style={{
                        backgroundColor: currentTheme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      iOS .mobileconfig laden
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as typeof step)}
            className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 text-zinc-300 disabled:opacity-30"
          >
            ← Zurück
          </button>

          <div className="flex items-center gap-2">
            {policy.onboardingCompleted && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 text-zinc-300 hover:text-white"
              >
                Schließen
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1) as typeof step)}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5"
                style={{
                  backgroundColor: currentTheme.colors.accent,
                  color: "#050505",
                }}
              >
                <span>Nächster Schritt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOrDismiss}
                className="px-5 py-2 rounded-xl text-xs font-mono font-bold"
                style={{
                  backgroundColor: currentTheme.colors.accent,
                  color: "#050505",
                }}
              >
                ✓ Einrichtung dauerhaft abschließen
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
