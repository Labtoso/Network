"use client";

import { createThreadlines, type ThemeId, type ThreadlinesHandle } from "@canvas/index";
import { useEffect, useRef } from "react";

export function CanvasBackdrop({ theme, intensity }: { theme: ThemeId; intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ThreadlinesHandle | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    handle.current = createThreadlines(ref.current, theme, intensity);
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // nur einmal starten, Theme/Intensitaet werden unten live gesetzt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => handle.current?.setTheme(theme), [theme]);
  useEffect(() => handle.current?.setIntensity(intensity), [intensity]);

  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(var(--bg)/0.55)_0%,rgb(var(--bg)/0.88)_70%)]" />
    </>
  );
}
