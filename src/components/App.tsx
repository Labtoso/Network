"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useEffect } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { CanvasBackdrop } from "./CanvasBackdrop";
import { LoginScreen } from "./LoginScreen";
import { SetupWizard } from "./SetupWizard";
import { Shell } from "./Shell";
import { Spinner, cx } from "./ui";

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className={cx(
              "pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border bg-panel/95 px-3.5 py-2.5 text-sm shadow-glow backdrop-blur",
              toast.tone === "error" ? "border-danger/50 text-danger" : toast.tone === "info" ? "border-line text-fg" : "border-accent/40 text-fg",
            )}
          >
            {toast.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : toast.tone === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
            <span>{toast.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Gate() {
  const { config, configError, session } = useApp();

  if (!config && !configError) return <div className="flex min-h-dvh items-center justify-center"><Spinner label="Verbinde mit dem Backend…" /></div>;
  if (!config || !config.setupComplete) return <SetupWizard />;
  if (!session) return <LoginScreen />;
  return <Shell />;
}

function Root() {
  const { theme, intensity } = useApp();

  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => undefined);
    }
  }, []);

  return (
    <>
      <CanvasBackdrop theme={theme} intensity={intensity} />
      <Toasts />
      <Gate />
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
