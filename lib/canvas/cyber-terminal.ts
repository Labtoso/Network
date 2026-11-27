import type { FrameContext, Renderer, ThemeDefinition } from "./types";
import { HEX, pick, rgba } from "./util";

const AMBER = "#ffb000";

interface Line {
  y: number;
  speed: number;
  text: string;
  x: number;
  alpha: number;
}

function hexLine(): string {
  const address = Array.from({ length: 4 }, () => pick(HEX)).join("");
  const bytes = Array.from({ length: 16 }, () => pick(HEX) + pick(HEX));
  const ascii = bytes.map((b) => {
    const code = Number.parseInt(b, 16);
    return code > 32 && code < 127 ? String.fromCharCode(code) : ".";
  });
  return `0x${address}  ${bytes.slice(0, 8).join(" ")}  ${bytes.slice(8).join(" ")}  |${ascii.join("")}|`;
}

/** 2. Cyber-Terminal: Phosphor-Bernstein Hex-Dump-Stroeme mit Scanlines; der Zeiger ist eine Leuchtlupe. */
function createCyberTerminal(): Renderer {
  let lines: Line[] = [];
  let size = 13;
  let flicker = 1;

  return {
    resize(width, height, intensity) {
      size = width < 640 ? 11 : 13;
      const rows = Math.ceil(height / (size * 1.6));
      lines = Array.from({ length: rows }, (_, i) => ({
        y: i * size * 1.6,
        speed: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 50) * (0.4 + intensity),
        text: `${hexLine()}   ${hexLine()}   ${hexLine()}`,
        x: -Math.random() * width,
        alpha: 0.12 + Math.random() * 0.3,
      }));
    },
    frame({ ctx, width, height, dt, time, pointer, intensity }: FrameContext) {
      ctx.fillStyle = "#0a0700";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${size}px 'JetBrains Mono Variable', monospace`;
      ctx.textBaseline = "top";
      if (Math.random() < 0.02) flicker = 0.85 + Math.random() * 0.15;
      else flicker += (1 - flicker) * 0.1;

      for (const line of lines) {
        line.x += line.speed * dt;
        const textWidth = ctx.measureText(line.text).width;
        if (line.x > width) line.x = -textWidth;
        if (line.x < -textWidth) line.x = width;
        if (Math.random() < 0.003) line.text = `${hexLine()}   ${hexLine()}   ${hexLine()}`;
        const near = pointer.active ? Math.max(0, 1 - Math.abs(line.y - pointer.y) / 90) : 0;
        ctx.fillStyle = rgba(AMBER, (line.alpha + near * 0.5) * flicker * (0.6 + intensity * 0.4));
        ctx.fillText(line.text, line.x, line.y);
      }

      if (pointer.active) {
        const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 160);
        glow.addColorStop(0, rgba(AMBER, 0.14));
        glow.addColorStop(1, rgba(AMBER, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(pointer.x - 160, pointer.y - 160, 320, 320);
      }

      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let y = (time * 30) % 3; y < height; y += 3) ctx.fillRect(0, y, width, 1);
      const sweep = (time * 80) % (height + 200) - 100;
      const band = ctx.createLinearGradient(0, sweep - 60, 0, sweep + 60);
      band.addColorStop(0, rgba(AMBER, 0));
      band.addColorStop(0.5, rgba(AMBER, 0.05));
      band.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, sweep - 60, width, 120);
    },
  };
}

export const cyberTerminalTheme: ThemeDefinition = {
  id: "cyber-terminal",
  name: "Cyber-Terminal",
  tagline: "Phosphor-Bernstein #FFB000",
  colors: { bg: "#0a0700", panel: "#110c02", line: "#3a2a08", fg: "#ffe2a8", dim: "#a07c3a", accent: AMBER, accent2: "#cc8400" },
  create: createCyberTerminal,
};
