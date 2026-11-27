"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, Clock, Send, CheckCircle2, Lock, ArrowUpRight } from "lucide-react";
import CanvasBackdrop from "@/components/CanvasBackdrop";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  ThemeId,
} from "@/lib/themes";
import { BlockPageStudioConfig, INITIAL_STATE } from "@/lib/network-state";

function BlockPageContent() {
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") || "tiktok.com";
  const clientId = searchParams.get("client") || "jonas-iphone";

  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const [config, setConfig] = useState<BlockPageStudioConfig>(INITIAL_STATE.blockPage);
  const [clientName, setClientName] = useState("Jonas iPhone 15");
  const [secondsLeft, setSecondsLeft] = useState(42 * 60);
  const [requestedMinutes, setRequestedMinutes] = useState(30);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES[saved]) setThemeId(saved);
    } catch {
      // ignore
    }

    fetch("/api/control", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.blockPage) {
          setConfig(d.blockPage);
          setSecondsLeft((d.blockPage.countdownMinutes || 42) * 60);
          if (d.blockPage.mode === "redirect" && d.blockPage.redirectUrl) {
            window.location.href = d.blockPage.redirectUrl;
          }
        }
        if (Array.isArray(d?.devices)) {
          const found = d.devices.find((x: { id: string; name: string }) => x.id === clientId);
          if (found) setClientName(found.name);
        }
      })
      .catch(() => null);
  }, [clientId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeRemainingFormatted = `${String(mins).padStart(2, "0")}:${String(
    secs
  ).padStart(2, "0")} Min`;

  const interpolate = (template: string) =>
    template
      .replace(/\{domain\}/g, domain)
      .replace(/\{client_name\}/g, clientName)
      .replace(/\{time_remaining\}/g, timeRemainingFormatted)
      .replace(/\{curfew_reason\}/g, config.curfewReason);

  const handleRequestAccess = async () => {
    setRequestSent(true);
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_unblock_request",
          clientId,
          clientName,
          domain,
          requestedMinutes,
          reason: `${clientName} bittet um ${requestedMinutes} Min Freigabe für ${domain}`,
        }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundColor: currentTheme.colors.bgBase,
        color: currentTheme.colors.textPrimary,
      }}
    >
      <CanvasBackdrop theme={themeId} />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl p-6 sm:p-8 backdrop-blur-2xl space-y-6"
        style={{
          backgroundColor: currentTheme.colors.bgPanel,
          border: `1px solid ${currentTheme.colors.borderStrong}`,
        }}
      >
        {config.mode === "code" ? (
          <div
            dangerouslySetInnerHTML={{
              __html: interpolate(config.customHtml),
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#F87171",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                DNS SINKHOLE // ROAMING & WLAN ENFORCED
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                SSL Root-CA Verified
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {config.title}
              </h1>
              <p className="text-xs font-mono text-zinc-400">
                {config.subtitle}
              </p>
            </div>

            <div
              className="rounded-xl p-4 font-mono text-xs sm:text-sm leading-relaxed"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.55)",
                border: `1px solid ${currentTheme.colors.border}`,
                color: currentTheme.colors.textPrimary,
              }}
            >
              {interpolate(config.alarmMessage)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="text-[10px] text-zinc-400 uppercase">
                  Gesperrte Domain
                </div>
                <div
                  className="font-bold mt-1 truncate"
                  style={{ color: currentTheme.colors.accent }}
                >
                  {domain}
                </div>
              </div>

              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="text-[10px] text-zinc-400 uppercase">
                  Erkanntes Gerät
                </div>
                <div className="font-bold text-white mt-1 truncate">
                  {clientName}
                </div>
              </div>
            </div>

            {config.showCountdown && (
              <div
                className="p-3.5 rounded-xl flex items-center justify-between font-mono"
                style={{
                  backgroundColor: currentTheme.colors.accentMuted,
                  border: `1px solid ${currentTheme.colors.borderStrong}`,
                }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Clock
                    className="w-4 h-4"
                    style={{ color: currentTheme.colors.accent }}
                  />
                  <span>Automatische Freigabe in:</span>
                </div>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: currentTheme.colors.accent }}
                >
                  {timeRemainingFormatted}
                </span>
              </div>
            )}

            {config.allowUnblockRequest && (
              <div className="pt-2 space-y-3">
                {requestSent ? (
                  <div
                    className="p-3.5 rounded-xl font-mono text-xs flex items-center gap-2"
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.14)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#6EE7B7",
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Freigabe-Anfrage (+{requestedMinutes} Min für {domain}) wurde in Echtzeit an Sebastians Admin-Panel gesendet!
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={requestedMinutes}
                      onChange={(e) =>
                        setRequestedMinutes(Number(e.target.value))
                      }
                      className="px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 text-xs font-mono text-white"
                    >
                      <option value={15}>+15 Minuten anfragen</option>
                      <option value={30}>+30 Minuten anfragen</option>
                      <option value={60}>+60 Minuten anfragen</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleRequestAccess}
                      className="flex-1 py-2.5 px-4 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
                      style={{
                        backgroundColor: currentTheme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Zugang beim Admin anfordern</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Anti-Bypass Roaming Policy
          </span>
          <a
            href="/"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Admin Control Suite</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CustomBlockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <BlockPageContent />
    </Suspense>
  );
}
