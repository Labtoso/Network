"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type StoredSession } from "@/lib/api";
import { useApp } from "@/lib/store";

interface GoogleId {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback(response: { credential: string }): void; auto_select?: boolean; ux_mode?: string; itp_support?: boolean }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      disableAutoSelect(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleId;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google Login konnte nicht geladen werden (Netzwerk oder Blocker)."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Offizieller "Mit Google anmelden"-Button (Google Identity Services). Das ID-Token prueft das Backend. */
export function GoogleButton({ onForbidden, onSuccess }: { onForbidden(email: string | null, message: string): void; onSuccess?(): void }) {
  const { config, setSession, toast } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clientId = config?.googleClientId;
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          itp_support: true,
          callback: async ({ credential }) => {
            setBusy(true);
            setError(null);
            try {
              const session = await api<StoredSession>("/api/auth/google", { body: { credential }, auth: false });
              setSession(session);
              toast(`Angemeldet als ${session.email}`);
              onSuccess?.();
            } catch (err) {
              if (err instanceof ApiError && err.status === 403) {
                const match = /Account (\S+) ist/.exec(err.message);
                onForbidden(match?.[1] ?? null, err.message);
              } else {
                setError(err instanceof Error ? err.message : String(err));
              }
            } finally {
              setBusy(false);
            }
          },
        });
        ref.current.innerHTML = "";
        window.google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "signin_with",
          shape: "pill",
          locale: "de",
          width: 280,
        });
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [config?.googleClientId, onForbidden, onSuccess, setSession, toast]);

  if (!config?.googleClientId) {
    return <p className="text-sm text-danger">Auf dem Server ist keine GOOGLE_CLIENT_ID hinterlegt. Bitte <code>./manage.sh setup</code> ausfuehren.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref} className={busy ? "pointer-events-none opacity-50" : ""} />
      {busy && <p className="text-xs text-dim">Token wird geprueft…</p>}
      {error && <p className="max-w-xs text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
