"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, ArrowRight, Terminal, CheckCircle2, AlertTriangle } from "lucide-react";
import CanvasBackdrop from "@/components/CanvasBackdrop";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  ThemeId,
} from "@/lib/themes";
import { ALLOWED_OWNER_EMAIL, PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";

export default function ZeroTrustLoginPage() {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    email: string;
    provider: string;
    accessVector: string;
    clientIp: string;
  } | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES[saved]) {
        setThemeId(saved);
      }
    } catch {
      // ignore
    }

    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAuthStatus(d))
      .catch(() => null);
  }, []);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];

  const handleGoogleZeroTrustLogin = async () => {
    setIsAuthenticating(true);
    try {
      // If hosted on admin.labtoso.de behind Cloudflare Access, trigger Cloudflare Access Google OAuth flow
      if (
        typeof window !== "undefined" &&
        window.location.hostname === PUBLIC_ZERO_TRUST_DOMAIN
      ) {
        window.location.href = `/cdn-cgi/access/login`;
        return;
      }

      // On local LAN / Tailscale fallback, establish verified owner session
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ALLOWED_OWNER_EMAIL }),
      });
      if (res.ok) {
        window.location.href = "/";
      }
    } finally {
      setTimeout(() => setIsAuthenticating(false), 400);
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
        className="relative z-10 w-full max-w-md rounded-2xl p-6 sm:p-8 backdrop-blur-2xl space-y-6"
        style={{
          backgroundColor: currentTheme.colors.bgPanel,
          border: `1px solid ${currentTheme.colors.borderStrong}`,
        }}
      >
        {/* Header */}
        <div className="space-y-2 text-center">
          <div
            className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
            style={{
              backgroundColor: currentTheme.colors.accentMuted,
              border: `1px solid ${currentTheme.colors.borderStrong}`,
              color: currentTheme.colors.accent,
            }}
          >
            <Lock className="w-6 h-6" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase"
            style={{
              backgroundColor: currentTheme.colors.accentMuted,
              color: currentTheme.colors.accent,
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Cloudflare Zero Trust Gate
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            LABTOSO // NETWORK
          </h1>
          <p className="text-xs font-mono text-zinc-400">
            Geschützter Infrastruktur-Endpunkt ({PUBLIC_ZERO_TRUST_DOMAIN})
          </p>
        </div>

        {/* Hard Access Policy Notice */}
        <div
          className="rounded-xl p-3.5 text-xs font-mono space-y-1.5"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            border: `1px solid ${currentTheme.colors.border}`,
          }}
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span>Zero-Trust Policy:</span>
            <span style={{ color: currentTheme.colors.accent }}>HARD-LOCKED</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Erlaubtes Google-Konto:</span>
            <span className="text-white font-semibold">{ALLOWED_OWNER_EMAIL}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>Header-Prüfung:</span>
            <span className="text-zinc-300">Cf-Access-Authenticated-User-Email</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleZeroTrustLogin}
          disabled={isAuthenticating}
          className="w-full py-3 px-4 rounded-xl font-mono text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
          style={{
            backgroundColor: currentTheme.colors.accent,
            color: "#050505",
          }}
        >
          {/* Crisp SVG Google "G" Monogram */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 15.65 5 12c0-3.65 3.36-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
          </svg>
          <span>
            {isAuthenticating
              ? "Zero-Trust Handshake läuft..."
              : "Mit Google anmelden (Cloudflare Zero Trust)"}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Live Header Verification Readout */}
        {authStatus && (
          <div
            className="rounded-xl p-3 text-[11px] font-mono space-y-1"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: `1px solid ${currentTheme.colors.border}`,
            }}
          >
            <div className="flex items-center gap-1.5 text-zinc-300">
              {authStatus.authenticated ? (
                <CheckCircle2
                  className="w-3.5 h-3.5"
                  style={{ color: currentTheme.colors.accent }}
                />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>
                Status:{" "}
                <strong>
                  {authStatus.authenticated
                    ? `Autorisiert (${authStatus.email})`
                    : "Warte auf Cloudflare Access Token"}
                </strong>
              </span>
            </div>
            <div className="text-zinc-500 pl-5">
              Vektor: {authStatus.accessVector} · IP: {authStatus.clientIp}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            cloudflared + tailscaled
          </span>
          <a href="/" className="hover:text-white transition-colors">
            Zum Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}
