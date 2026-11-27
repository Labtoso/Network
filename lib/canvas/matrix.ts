import type { FrameContext, Renderer, ThemeDefinition } from "./types";
import { DIGITS, KATAKANA, pick, rgba } from "./util";

const GLYPHS = KATAKANA + DIGITS + "Z:.=*+-<>¦|";
const ACCENT = "#00ff41";

interface Drop {
  y: number;
  speed: number;
  length: number;
  chars: string[];
  offset: number;
}

/** 1. Matrix: giftgruener Katakana-Regen. Spalten weichen dem Zeiger aus und leuchten in seiner Naehe auf. */
function createMatrix(): Renderer {
  let size = 16;
  let drops: Drop[] = [];
  let height = 0;

  const newDrop = (initial: boolean): Drop => {
    const length = 8 + Math.floor(Math.random() * 22);
    return {
      y: initial ? Math.random() * height : -Math.random() * height * 0.5,
      speed: 40 + Math.random() * 140,
      length,
      chars: Array.from({ length }, () => pick(GLYPHS)),
      offset: 0,
    };
  };

  return {
    resize(width, h, intensity) {
      height = h;
      size = width < 640 ? 14 : 16;
      const columns = Math.ceil(width / size);
      const density = 0.35 + intensity * 0.65;
      drops = Array.from({ length: columns }, () => newDrop(true)).map((d) => (Math.random() < density ? d : { ...d, speed: 0 }));
    },
    frame({ ctx, width, height: h, dt, pointer, intensity }: FrameContext) {
      ctx.fillStyle = "rgba(5,5,5,0.92)";
      ctx.fillRect(0, 0, width, h);
      ctx.font = `${size}px 'JetBrains Mono Variable', monospace`;
      ctx.textBaseline = "top";
      drops.forEach((drop, column) => {
        if (drop.speed === 0) {
          if (Math.random() < 0.002 * intensity) Object.assign(drop, newDrop(false));
          return;
        }
        drop.y += drop.speed * dt;
        if (Math.random() < 0.04) drop.chars[Math.floor(Math.random() * drop.length)] = pick(GLYPHS);
        const baseX = column * size;
        for (let i = 0; i < drop.length; i += 1) {
          const y = drop.y - i * size;
          if (y < -size || y > h) continue;
          const dx = baseX - pointer.x;
          const dy = y - pointer.y;
          const dist = Math.hypot(dx, dy);
          const near = pointer.active ? Math.max(0, 1 - dist / 140) : 0;
          const push = near * 18 * Math.sign(dx || 1);
          const fadeOut = 1 - i / drop.length;
          if (i === 0) ctx.fillStyle = rgba("#eafff0", 0.95);
          else ctx.fillStyle = rgba(ACCENT, Math.min(1, fadeOut * (0.55 + intensity * 0.35) + near * 0.6));
          ctx.fillText(drop.chars[i], baseX + push, y);
        }
        if (drop.y - drop.length * size > h) Object.assign(drop, newDrop(false));
      });
    },
  };
}

export const matrixTheme: ThemeDefinition = {
  id: "matrix",
  name: "Matrix",
  tagline: "Giftgruener Katakana-Regen",
  colors: { bg: "#050505", panel: "#0a0f0a", line: "#12301b", fg: "#d1fae5", dim: "#5b8a68", accent: ACCENT, accent2: "#00b32d" },
  create: createMatrix,
};
