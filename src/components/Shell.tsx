"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, ListFilter, Paintbrush, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Dashboard } from "./Dashboard";
import { Devices } from "./Devices";
import { Rules } from "./Rules";
import { SettingsView } from "./Settings";
import { SetupWizard } from "./SetupWizard";
import { Studio } from "./Studio";
import { cx } from "./ui";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "devices", label: "Geraete", icon: Smartphone },
  { id: "rules", label: "Regeln", icon: ListFilter },
  { id: "studio", label: "Studio", icon: Paintbrush },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readHash(): TabId {
  const hash = typeof window === "undefined" ? "" : window.location.hash.replace("#", "");
  return (TABS.find((tab) => tab.id === hash)?.id ?? "dashboard") as TabId;
}

export function Shell() {
  const { session } = useApp();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [wizard, setWizard] = useState(false);

  useEffect(() => {
    setTab(readHash());
    const onHash = () => setTab(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: TabId) => {
    window.history.replaceState(null, "", `#${id}`);
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (wizard) return <SetupWizard onDone={() => setWizard(false)} />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/50 font-mono text-xs text-accent">N</span>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-fg">Network</span>
          </div>
          {session && (
            <div className="flex items-center gap-2 text-xs text-dim">
              <span className="hidden sm:inline">{session.email}</span>
              {session.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.picture} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border border-line" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line font-mono text-[10px]">{session.email[0]?.toUpperCase()}</span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-5">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {tab === "dashboard" && <Dashboard onNavigate={go} />}
            {tab === "devices" && <Devices />}
            {tab === "rules" && <Rules />}
            {tab === "studio" && <Studio />}
            {tab === "settings" && <SettingsView onOpenWizard={() => setWizard(true)} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]" aria-label="Hauptnavigation">
        <div className="mx-auto mb-2 flex max-w-md items-stretch justify-between gap-1 rounded-2xl border border-line bg-panel/90 p-1.5 shadow-glow backdrop-blur-xl sm:mb-4">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] transition", active ? "text-bg" : "text-dim hover:text-fg")}
              >
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <item.icon className="relative h-5 w-5" />
                <span className="relative font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
