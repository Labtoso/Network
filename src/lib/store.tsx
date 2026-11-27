"use client";

import { applyThemeVariables, type ThemeId } from "@canvas/index";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, loadSession, saveSession, UNAUTHORIZED_EVENT, type StoredSession } from "./api";
import type { PublicConfig } from "./types";

const THEME_KEY = "network.theme";
const INTENSITY_KEY = "network.intensity";

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}

interface AppState {
  theme: ThemeId;
  setTheme(theme: ThemeId, persistRemote?: boolean): void;
  intensity: number;
  setIntensity(value: number): void;
  session: StoredSession | null;
  setSession(session: StoredSession | null): void;
  config: PublicConfig | null;
  configError: string | null;
  reloadConfig(): Promise<void>;
  toasts: Toast[];
  toast(text: string, tone?: Toast["tone"]): void;
  run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined>;
}

const AppContext = createContext<AppState | null>(null);

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* privater Modus */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("matrix");
  const [intensity, setIntensityState] = useState(0.7);
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((entry) => entry.id !== id)), 4200);
  }, []);

  const setTheme = useCallback(
    (next: ThemeId, persistRemote = false) => {
      setThemeState(next);
      writeLocal(THEME_KEY, next);
      applyThemeVariables(next);
      if (persistRemote && loadSession()) {
        void api("/api/settings/general", { method: "PUT", body: { theme: next } }).catch(() => undefined);
      }
    },
    [],
  );

  const setIntensity = useCallback((value: number) => {
    setIntensityState(value);
    writeLocal(INTENSITY_KEY, String(value));
  }, []);

  const setSession = useCallback((next: StoredSession | null) => {
    saveSession(next);
    setSessionState(next);
  }, []);

  const reloadConfig = useCallback(async () => {
    try {
      const next = await api<PublicConfig>("/api/public/config", { auth: false });
      setConfig(next);
      setConfigError(null);
      if (!readLocal(THEME_KEY)) setTheme(next.theme);
    } catch (error) {
      setConfig(null);
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  }, [setTheme]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await action();
        if (success) toast(success);
        return result;
      } catch (error) {
        toast(error instanceof ApiError || error instanceof Error ? error.message : String(error), "error");
        return undefined;
      }
    },
    [toast],
  );

  useEffect(() => {
    const storedTheme = readLocal(THEME_KEY) as ThemeId | null;
    setTheme(storedTheme ?? "matrix");
    const storedIntensity = Number(readLocal(INTENSITY_KEY));
    if (Number.isFinite(storedIntensity) && readLocal(INTENSITY_KEY) !== null) setIntensityState(storedIntensity);
    setSessionState(loadSession());
    void reloadConfig();
    const onUnauthorized = () => setSessionState(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [reloadConfig, setTheme]);

  const value = useMemo<AppState>(
    () => ({ theme, setTheme, intensity, setIntensity, session, setSession, config, configError, reloadConfig, toasts, toast, run }),
    [theme, setTheme, intensity, setIntensity, session, setSession, config, configError, reloadConfig, toasts, toast, run],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp ausserhalb von AppProvider");
  return ctx;
}

/** Laedt Daten vom Backend mit Lade-/Fehlerzustand und manuellem Reload. */
export function useResource<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setLoading(true);
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, setData, error, loading, reload: () => setTick((t) => t + 1) };
}
