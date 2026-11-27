"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { useApp } from "@/lib/store";
import { GoogleButton } from "./GoogleButton";
import { Button } from "./ui";

export function ForbiddenScreen({ email, message, onBack }: { email: string | null; message: string; onBack(): void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-3xl border border-danger/40 bg-panel/90 p-7 text-center backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/40 bg-danger/10">
        <ShieldAlert className="h-7 w-7 text-danger" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-danger">403 · Forbidden</p>
      <h1 className="mt-2 text-xl font-semibold">Kein Zugriff</h1>
      <p className="mt-3 text-sm leading-relaxed text-dim">{message}</p>
      {email && <p className="mt-3 break-all font-mono text-xs text-fg">{email}</p>}
      <p className="mt-4 text-xs text-dim">Dieses Panel ist ausschliesslich fuer den freigeschalteten Admin-Account.</p>
      <Button className="mt-6 w-full" onClick={onBack}>
        Mit anderem Account anmelden
      </Button>
    </motion.div>
  );
}

export function LoginScreen() {
  const { config } = useApp();
  const [forbidden, setForbidden] = useState<{ email: string | null; message: string } | null>(null);
  const onForbidden = useCallback((email: string | null, message: string) => setForbidden({ email, message }), []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      {forbidden ? (
        <ForbiddenScreen {...forbidden} onBack={() => setForbidden(null)} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-3xl border border-line bg-panel/85 p-7 text-center shadow-glow backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10">
            <ShieldCheck className="h-7 w-7 text-accent" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">Labtoso · Network</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Admin-Panel</h1>
          <p className="mt-2 text-sm text-dim">Melde dich mit dem freigeschalteten Google-Account an.</p>
          <div className="mt-7">
            <GoogleButton onForbidden={onForbidden} />
          </div>
          <p className="mt-6 font-mono text-[10px] text-dim">
            {config?.publicUrl} · v{config?.version}
          </p>
        </motion.div>
      )}
    </main>
  );
}
