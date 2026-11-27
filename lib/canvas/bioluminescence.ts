import type { FrameContext, Renderer, ThemeDefinition } from "./types";
import { noise2, pick, rgba } from "./util";

const EMERALD = "#10b981";
const GLYPHS = "·•∘○◦°⁘⁙∙";

interface Plankton {
  x: number;
  y: number;
  phase: number;
  size: number;
  glyph: string;
  lit: number;
}

/** 5. Bioluminescence: treibendes Plankton aus Glyphen, das pulsiert; Zeiger und Taps loesen Leuchtwellen aus. */
function createBio(): Renderer {
  let plankton: Plankton[] = [];

  return {
    resize(width, height, intensity) {
      const count = Math.round(((width * height) / 7000) * (0.4 + intensity * 0.8));
      plankton = Array.from({ length: Math.min(700, count) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        phase: Math.random() * Math.PI * 2,
        size: 9 + Math.random() * 10,
        glyph: pick(GLYPHS),
        lit: 0,
      }));
    },
    frame({ ctx, width, height, time, dt, pointer, intensity }: FrameContext) {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#020a07");
      bg.addColorStop(1, "#010504");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      pointer.pulses = pointer.pulses.filter((p) => time - p.t < 3);

      for (const p of plankton) {
        const n = noise2(p.x * 0.003, p.y * 0.003 + time * 0.03);
        p.x += Math.cos(n * Math.PI * 2) * 8 * dt;
        p.y += (Math.sin(n * Math.PI * 2) * 8 - 4) * dt;
        if (p.y < -20) p.y = height + 20;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        if (pointer.active && Math.hypot(p.x - pointer.x, p.y - pointer.y) < 110) p.lit = 1;
        for (const pulse of pointer.pulses) {
          const radius = (time - pulse.t) * 320;
          if (Math.abs(Math.hypot(p.x - pulse.x, p.y - pulse.y) - radius) < 20) p.lit = 1;
        }
        p.lit = Math.max(0, p.lit - dt * 0.6);

        const breathe = (Math.sin(time * 1.4 + p.phase) + 1) / 2;
        const alpha = 0.12 + breathe * 0.25 * (0.5 + intensity) + p.lit * 0.7;
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = p.lit > 0.1 ? 14 : 4;
        ctx.font = `${p.size}px 'JetBrains Mono Variable', monospace`;
        ctx.fillStyle = rgba(p.lit > 0.5 ? "#a7f3d0" : EMERALD, alpha);
        ctx.fillText(p.glyph, p.x, p.y);
      }
      ctx.shadowBlur = 0;
    },
  };
}

export const bioluminescenceTheme: ThemeDefinition = {
  id: "bioluminescence",
  name: "Bioluminescence",
  tagline: "Dunkles Smaragdgruen #10B981",
  colors: { bg: "#020a07", panel: "#06140f", line: "#0f3326", fg: "#d1fae5", dim: "#4f8f78", accent: EMERALD, accent2: "#34d399" },
  create: createBio,
};
