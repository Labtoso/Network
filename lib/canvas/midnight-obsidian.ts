import type { FrameContext, Renderer, ThemeDefinition } from "./types";
import { noise2, pick, rgba } from "./util";

const ICE = "#38bdf8";
const GLYPHS = ".:-=+*·";

interface Particle {
  x: number;
  y: number;
  life: number;
  glyph: string;
}

/** 3. Midnight Obsidian: Threadlines aus ASCII-Partikeln in einem Stroemungsfeld; der Zeiger erzeugt einen Wirbel. */
function createMidnight(): Renderer {
  let particles: Particle[] = [];
  let w = 0;
  let h = 0;

  const spawn = (): Particle => ({ x: Math.random() * w, y: Math.random() * h, life: 0, glyph: pick(GLYPHS) });

  return {
    resize(width, height, intensity) {
      w = width;
      h = height;
      const count = Math.round(((width * height) / 9000) * (0.4 + intensity * 0.8));
      particles = Array.from({ length: Math.min(900, count) }, spawn);
    },
    frame({ ctx, width, height, time, dt, pointer, intensity }: FrameContext) {
      ctx.fillStyle = "rgba(5,6,8,0.18)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = "12px 'JetBrains Mono Variable', monospace";
      const speed = 38 * (0.5 + intensity);
      for (const p of particles) {
        const angle = noise2(p.x * 0.0022, p.y * 0.0022 + time * 0.05) * Math.PI * 2.2;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 200) {
            const force = (1 - dist / 200) * 160;
            vx += (-dy / dist) * force + pointer.vx * 6;
            vy += (dx / dist) * force + pointer.vy * 6;
          }
        }
        p.x += vx * dt;
        p.y += vy * dt;
        p.life += dt;
        if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10 || p.life > 14) Object.assign(p, spawn());
        const alpha = Math.min(1, p.life / 1.5) * 0.55;
        ctx.fillStyle = rgba(Math.random() < 0.01 ? "#e2e8f0" : ICE, alpha);
        ctx.fillText(p.glyph, p.x, p.y);
      }
    },
  };
}

export const midnightObsidianTheme: ThemeDefinition = {
  id: "midnight-obsidian",
  name: "Midnight Obsidian",
  tagline: "Stealth-Schwarz mit Eisblau #38BDF8",
  colors: { bg: "#050608", panel: "#0b0e13", line: "#1a2230", fg: "#e2e8f0", dim: "#64748b", accent: ICE, accent2: "#0ea5e9" },
  create: createMidnight,
};
