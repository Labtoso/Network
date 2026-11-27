import { bioluminescenceTheme } from "./bioluminescence";
import { cyberTerminalTheme } from "./cyber-terminal";
import { matrixTheme } from "./matrix";
import { midnightObsidianTheme } from "./midnight-obsidian";
import { neonTokyoTheme } from "./neon-tokyo";
import type { Pointer, Renderer, ThemeDefinition, ThemeId } from "./types";
import { hexToRgb } from "./util";

export type { ThemeDefinition, ThemeId } from "./types";

export const THEMES: ThemeDefinition[] = [matrixTheme, cyberTerminalTheme, midnightObsidianTheme, neonTokyoTheme, bioluminescenceTheme];

export function getTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? matrixTheme;
}

/** Setzt die Theme-Farben als CSS-Variablen (Tailwind nutzt rgb(var(--accent) / alpha)). */
export function applyThemeVariables(id: ThemeId, root: HTMLElement = document.documentElement): void {
  const theme = getTheme(id);
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, hexToRgb(value).join(" "));
  }
  root.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.bg);
}

export interface ThreadlinesHandle {
  setTheme(id: ThemeId): void;
  setIntensity(value: number): void;
  destroy(): void;
}

/**
 * Startet den Threadlines-Canvas: 60-FPS-Schleife, HiDPI, Zeiger-/Touch-Interaktion,
 * Pause bei verstecktem Tab und reduzierte Bewegung nach Systemeinstellung.
 */
export function createThreadlines(canvas: HTMLCanvasElement, initialTheme: ThemeId, initialIntensity = 0.7): ThreadlinesHandle {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D wird nicht unterstuetzt.");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer: Pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false, pulses: [] };
  let renderer: Renderer = getTheme(initialTheme).create();
  let intensity = initialIntensity;
  let width = 0;
  let height = 0;
  let raf = 0;
  let last = performance.now();
  const start = last;
  let running = true;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.resize(width, height, intensity);
  };

  const loop = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pointer.vx *= 0.9;
    pointer.vy *= 0.9;
    renderer.frame({ ctx, width, height, time: (now - start) / 1000, dt: reduced.matches ? dt * 0.15 : dt, pointer, intensity });
  };

  const onMove = (event: PointerEvent) => {
    if (pointer.active) {
      pointer.vx = pointer.vx * 0.5 + (event.clientX - pointer.x) * 0.5;
      pointer.vy = pointer.vy * 0.5 + (event.clientY - pointer.y) * 0.5;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  };
  const onLeave = () => {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
  };
  const onDown = (event: PointerEvent) => {
    pointer.pulses.push({ x: event.clientX, y: event.clientY, t: (performance.now() - start) / 1000 });
    if (pointer.pulses.length > 8) pointer.pulses.shift();
  };
  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  raf = requestAnimationFrame(loop);

  return {
    setTheme(id) {
      renderer = getTheme(id).create();
      renderer.resize(width, height, intensity);
    },
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
      renderer.resize(width, height, intensity);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
