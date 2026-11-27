export type ThemeId = "matrix" | "cyber-terminal" | "midnight-obsidian" | "neon-tokyo" | "bioluminescence";

export interface Pointer {
  /** Position in CSS-Pixeln, -9999 wenn der Zeiger ausserhalb ist. */
  x: number;
  y: number;
  /** Geschwindigkeit in px/Frame, gedaempft. */
  vx: number;
  vy: number;
  active: boolean;
  /** Zeitpunkte der letzten Klicks/Taps fuer Ripple-Effekte. */
  pulses: { x: number; y: number; t: number }[];
}

export interface FrameContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Sekunden seit Start. */
  time: number;
  /** Sekunden seit dem letzten Frame (auf 1/20 s begrenzt). */
  dt: number;
  pointer: Pointer;
  /** 0..1 aus der Einstellung "Canvas-Intensitaet". */
  intensity: number;
}

export interface Renderer {
  resize(width: number, height: number, intensity: number): void;
  frame(frame: FrameContext): void;
}

export interface ThemeColors {
  bg: string;
  panel: string;
  line: string;
  fg: string;
  dim: string;
  accent: string;
  accent2: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  colors: ThemeColors;
  create(): Renderer;
}
