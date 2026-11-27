import type { FrameContext, Renderer, ThemeDefinition } from "./types";
import { DIGITS, KATAKANA, pick, rgba } from "./util";

const CYAN = "#22d3ee";
const MAGENTA = "#f0abfc";
const GLYPHS = KATAKANA + DIGITS + "東京夜光電脳都市#@%&";

interface Stream {
  x: number;
  y: number;
  speed: number;
  color: string;
  chars: string[];
}

/** 4. Neon Tokyo: Cyan/Magenta-Glyphenstroeme, Glitch-Streifen und ein Perspektivraster; Zeiger zieht Stroeme an. */
function createNeonTokyo(): Renderer {
  let streams: Stream[] = [];
  let size = 15;

  const make = (width: number, height: number, initial: boolean): Stream => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : -200,
    speed: 60 + Math.random() * 160,
    color: Math.random() < 0.5 ? CYAN : MAGENTA,
    chars: Array.from({ length: 6 + Math.floor(Math.random() * 14) }, () => pick(GLYPHS)),
  });

  return {
    resize(width, height, intensity) {
      size = width < 640 ? 13 : 15;
      const count = Math.round((width / 22) * (0.4 + intensity * 0.8));
      streams = Array.from({ length: count }, () => make(width, height, true));
    },
    frame({ ctx, width, height, time, dt, pointer, intensity }: FrameContext) {
      ctx.fillStyle = "#05030f";
      ctx.fillRect(0, 0, width, height);

      const horizon = height * 0.62;
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i += 1) {
        const t = ((i + ((time * 0.6) % 1)) / 14) ** 2;
        const y = horizon + t * (height - horizon);
        ctx.strokeStyle = rgba(MAGENTA, 0.05 + t * 0.18);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let i = -12; i <= 12; i += 1) {
        ctx.strokeStyle = rgba(CYAN, 0.07);
        ctx.beginPath();
        ctx.moveTo(width / 2 + i * 30, horizon);
        ctx.lineTo(width / 2 + i * 220, height);
        ctx.stroke();
      }

      ctx.font = `${size}px 'JetBrains Mono Variable', monospace`;
      ctx.textBaseline = "top";
      for (const s of streams) {
        s.y += s.speed * dt * (0.5 + intensity * 0.7);
        if (pointer.active) {
          const dx = pointer.x - s.x;
          const dy = pointer.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 260) s.x += (dx / (dist || 1)) * (1 - dist / 260) * 90 * dt;
        }
        if (Math.random() < 0.05) s.chars[Math.floor(Math.random() * s.chars.length)] = pick(GLYPHS);
        s.chars.forEach((ch, i) => {
          const y = s.y - i * size;
          if (y < -size || y > height) return;
          ctx.shadowColor = s.color;
          ctx.shadowBlur = i === 0 ? 12 : 0;
          ctx.fillStyle = rgba(i === 0 ? "#ffffff" : s.color, i === 0 ? 0.9 : (1 - i / s.chars.length) * 0.55);
          ctx.fillText(ch, s.x, y);
        });
        if (s.y - s.chars.length * size > height) Object.assign(s, make(width, height, false));
      }
      ctx.shadowBlur = 0;

      if (Math.random() < 0.06 * intensity) {
        const y = Math.random() * height;
        const sliceH = 4 + Math.random() * 18;
        const shift = (Math.random() - 0.5) * 40;
        try {
          const image = ctx.getImageData(0, y * devicePixelRatio, ctx.canvas.width, sliceH * devicePixelRatio);
          ctx.putImageData(image, shift * devicePixelRatio, y * devicePixelRatio);
        } catch {
          /* getImageData kann bei sehr kleinen Flaechen fehlschlagen */
        }
      }
    },
  };
}

export const neonTokyoTheme: ThemeDefinition = {
  id: "neon-tokyo",
  name: "Neon Tokyo",
  tagline: "Nachtblau mit Cyan und Magenta",
  colors: { bg: "#05030f", panel: "#0d0920", line: "#2a1f4d", fg: "#f5e9ff", dim: "#8b7bb5", accent: CYAN, accent2: MAGENTA },
  create: createNeonTokyo,
};
