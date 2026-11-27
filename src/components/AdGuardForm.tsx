"use client";

import { CheckCircle2, PlugZap, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { SettingsResponse } from "@/lib/types";
import { Button, Input } from "./ui";

interface TestResult {
  ok: boolean;
  ms: number;
  error?: string;
  status?: { version: string; running: boolean; protection_enabled: boolean };
  doh?: { ok: boolean; message: string };
}

export function AdGuardForm({ onSaved }: { onSaved?(): void }) {
  const { run } = useApp();
  const [url, setUrl] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [source, setSource] = useState<string>("none");
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);

  useEffect(() => {
    api<SettingsResponse>("/api/settings")
      .then((settings) => {
        setUrl(settings.adguard.url || "http://192.168.178.50:80");
        setUser(settings.adguard.user);
        setHasPassword(settings.adguard.hasPassword);
        setSource(settings.adguard.source);
      })
      .catch(() => undefined);
  }, []);

  const body = { url, user, password: password ? password : null };

  return (
    <div className="space-y-3">
      <Input label="AdGuard Home Adresse" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.178.50:80" inputMode="url" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Benutzername" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        <Input
          label="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={hasPassword ? "•••••••• (unveraendert)" : ""}
          autoComplete="current-password"
        />
      </div>
      <p className="text-xs text-dim">
        Quelle aktuell: <span className="font-mono text-fg">{source === "database" ? "Panel (verschluesselt in SQLite)" : source === "env" ? ".env auf dem Server" : "nicht gesetzt"}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon={<PlugZap className="h-4 w-4" />} loading={busy === "test"} onClick={async () => {
          setBusy("test");
          const result = await run(() => api<TestResult>("/api/settings/adguard/test", { body }));
          if (result) setTest(result);
          setBusy(null);
        }}>
          Verbindung testen
        </Button>
        <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={busy === "save"} onClick={async () => {
          setBusy("save");
          const ok = await run(() => api("/api/settings/adguard", { method: "PUT", body }), "AdGuard-Verbindung gespeichert");
          if (ok) {
            setPassword("");
            setHasPassword(hasPassword || Boolean(password));
            setSource("database");
            onSaved?.();
          }
          setBusy(null);
        }}>
          Speichern
        </Button>
      </div>
      {test && (
        <div className="space-y-2 rounded-xl border border-line bg-bg/50 p-3 text-sm">
          <div className="flex items-start gap-2">
            {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok" /> : <XCircle className="mt-0.5 h-4 w-4 text-danger" />}
            <span>{test.ok ? `AdGuard Home v${test.status?.version} erreichbar (${test.ms} ms), Schutz ${test.status?.protection_enabled ? "aktiv" : "pausiert"}.` : test.error}</span>
          </div>
          {test.doh && (
            <div className="flex items-start gap-2">
              {test.doh.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok" /> : <XCircle className="mt-0.5 h-4 w-4 text-warn" />}
              <span className={test.doh.ok ? "" : "text-warn"}>Roaming (DoH): {test.doh.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
