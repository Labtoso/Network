"use client";

import React, { useEffect, useRef } from "react";
import { ThemeId } from "@/lib/themes";

interface CanvasBackdropProps {
  theme: ThemeId;
  paused?: boolean;
  onFpsUpdate?: (fps: number) => void;
}

const KATAKANA_GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF<>[]{}/\\|=+-*:#";

const CODE_TOKENS = [
  "0x7FFF00A4",
  "CF_ZERO_TRUST::VERIFIED",
  "TAILNET::100.64.0.1",
  "PCT_EXEC::CT102",
  "SYN_ACK::443",
  "QUIC::FRA06",
  "ADGUARD::53_UDP",
  "STREYN::RUST_CORE",
  "NODE_V22_LTS",
  "HEAP::OK",
  "ETH0::192.168.178.67",
  "VMBR0::UP",
  "TLS1.3::AEAD",
  "DNS::HAGEZI_PRO",
  "LXC::UNPRIVILEGED",
  "NESTING=1",
  "0x00FF66",
  "0x38BDF8",
  "0xFFB000",
  "UID::0(ROOT)",
];

export default function CanvasBackdrop({
  theme,
  paused = false,
  onFpsUpdate,
}: CanvasBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; vx: number; vy: number; active: boolean }>({
    x: -1000,
    y: -1000,
    vx: 0,
    vy: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId = 0;
    let isTabHidden = document.hidden;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // FPS tracking
    let frameCount = 0;
    let lastFpsTime = performance.now();

    // 1. Matrix Digital Rain State
    interface MatrixColumn {
      x: number;
      y: number;
      speed: number;
      length: number;
      chars: string[];
      mutateTimer: number;
    }
    let matrixCols: MatrixColumn[] = [];

    // 2. Cyber-Terminal Amber State
    interface AmberBlock {
      x: number;
      y: number;
      vx: number;
      vy: number;
      text: string;
      alpha: number;
      size: number;
    }
    let amberBlocks: AmberBlock[] = [];

    // 3. Midnight Obsidian (Threadlines Flowing Code Streams) State
    interface CodeStream {
      x: number;
      y: number;
      z: number; // Depth plane 0.35 to 1.0
      speed: number;
      text: string;
      alpha: number;
    }
    let obsidianStreams: CodeStream[] = [];

    // 4. Neon Tokyo Synth-Pulse Mesh State
    interface SynthNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      polarity: "cyan" | "magenta";
      phase: number;
      radius: number;
    }
    let tokyoNodes: SynthNode[] = [];

    // 5. Bioluminescence Organic Spores State
    interface BioSpore {
      x: number;
      y: number;
      angle: number;
      speed: number;
      radius: number;
      hue: number;
      pulse: number;
      trail: { x: number; y: number }[];
    }
    let bioSpores: BioSpore[] = [];

    const initScene = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Initialize Matrix columns
      const colWidth = 18;
      const numCols = Math.ceil(width / colWidth);
      matrixCols = Array.from({ length: numCols }, (_, i) => {
        const len = 10 + Math.floor(Math.random() * 18);
        return {
          x: i * colWidth,
          y: Math.random() * -height,
          speed: 1.4 + Math.random() * 2.6,
          length: len,
          chars: Array.from(
            { length: len },
            () => KATAKANA_GLYPHS[Math.floor(Math.random() * KATAKANA_GLYPHS.length)]
          ),
          mutateTimer: Math.random() * 20,
        };
      });

      // Initialize Amber ASCII particles
      const amberCount = Math.min(65, Math.floor((width * height) / 22000));
      amberBlocks = Array.from({ length: amberCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.25 - Math.random() * 0.45,
        text: CODE_TOKENS[Math.floor(Math.random() * CODE_TOKENS.length)],
        alpha: 0.12 + Math.random() * 0.32,
        size: Math.random() > 0.7 ? 11 : 10,
      }));

      // Initialize Midnight Obsidian Threadlines Code Streams
      const streamCount = Math.min(80, Math.floor((width * height) / 18000));
      obsidianStreams = Array.from({ length: streamCount }, () => {
        const z = 0.35 + Math.random() * 0.65;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          speed: (0.25 + Math.random() * 0.55) * z,
          text: `${CODE_TOKENS[Math.floor(Math.random() * CODE_TOKENS.length)]} // 0x${Math.floor(
            Math.random() * 65535
          )
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")}`,
          alpha: 0.07 + z * 0.16,
        };
      });

      // Initialize Neon Tokyo Mesh Nodes
      const nodeCount = Math.min(72, Math.floor((width * height) / 19000));
      tokyoNodes = Array.from({ length: nodeCount }, (_, idx) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        polarity: idx % 3 === 0 ? "magenta" : "cyan",
        phase: Math.random() * Math.PI * 2,
        radius: 1.5 + Math.random() * 1.8,
      }));

      // Initialize Bioluminescence Spores
      const sporeCount = Math.min(68, Math.floor((width * height) / 20000));
      bioSpores = Array.from({ length: sporeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        angle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.65,
        radius: 1.8 + Math.random() * 3.2,
        hue: 155 + Math.random() * 25, // Emerald to Teal
        pulse: Math.random() * Math.PI * 2,
        trail: [],
      }));
    };

    initScene();

    const handleResize = () => {
      initScene();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const prevX = mouseRef.current.x;
      const prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.vx = e.clientX - prevX;
      mouseRef.current.vy = e.clientY - prevY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleVisibilityChange = () => {
      isTabHidden = document.hidden;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Render loop
    let time = 0;
    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);

      // Pause rendering when browser tab is hidden or explicitly paused
      if (isTabHidden || paused) return;

      frameCount++;
      if (now - lastFpsTime >= 1000) {
        onFpsUpdate?.(Math.min(60, Math.round((frameCount * 1000) / (now - lastFpsTime))));
        frameCount = 0;
        lastFpsTime = now;
      }

      time += 0.016;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mActive = mouseRef.current.active;

      if (theme === "matrix") {
        // Solid fade trail for digital rain
        ctx.fillStyle = "rgba(3, 5, 3, 0.22)";
        ctx.fillRect(0, 0, width, height);
        ctx.font = '13px "JetBrains Mono", monospace';

        for (let i = 0; i < matrixCols.length; i++) {
          const col = matrixCols[i];
          const dx = col.x - mx;
          const dy = col.y - my;
          const dist = Math.hypot(dx, dy);
          const mouseBoost = mActive && dist < 180 ? (180 - dist) / 90 : 0;

          col.y += col.speed + mouseBoost * 2.2;
          col.mutateTimer += 1;
          if (col.mutateTimer > 12) {
            col.mutateTimer = 0;
            const idx = Math.floor(Math.random() * col.chars.length);
            col.chars[idx] =
              KATAKANA_GLYPHS[Math.floor(Math.random() * KATAKANA_GLYPHS.length)];
          }

          for (let j = 0; j < col.chars.length; j++) {
            const charY = col.y - j * 16;
            if (charY < -20 || charY > height + 20) continue;

            const isHead = j === 0;
            const alpha = Math.max(0.05, (1 - j / col.length) * 0.55);

            if (isHead) {
              ctx.fillStyle = "rgba(215, 255, 232, 0.88)";
            } else if (j < 3) {
              ctx.fillStyle = `rgba(0, 255, 102, ${alpha + 0.18})`;
            } else {
              ctx.fillStyle = `rgba(0, 210, 85, ${alpha * 0.7})`;
            }

            const offsetX =
              mActive && dist < 140 ? (dx / (dist + 1)) * 10 : 0;
            ctx.fillText(col.chars[j], col.x + offsetX, charY);
          }

          if (col.y - col.length * 16 > height) {
            col.y = Math.random() * -240;
            col.speed = 1.4 + Math.random() * 2.6;
          }
        }
      } else if (theme === "amber") {
        // Pitch black phosphor CRT clear
        ctx.fillStyle = "#060400";
        ctx.fillRect(0, 0, width, height);

        // Subtle tactical amber radar grid
        ctx.strokeStyle = "rgba(255, 176, 0, 0.035)";
        ctx.lineWidth = 1;
        const gridSize = 64;
        const offsetX = mActive ? ((mx - width / 2) * -0.015) % gridSize : 0;
        const offsetY = mActive ? ((my - height / 2) * -0.015) % gridSize : 0;

        ctx.beginPath();
        for (let x = offsetX; x < width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = offsetY; y < height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Floating ASCII Register Blocks & Vector Reticle Links
        ctx.font = '10px "JetBrains Mono", monospace';
        for (let i = 0; i < amberBlocks.length; i++) {
          const b = amberBlocks[i];
          b.x += b.vx;
          b.y += b.vy;

          if (b.y < -20) b.y = height + 20;
          if (b.x < -100) b.x = width + 50;
          if (b.x > width + 100) b.x = -50;

          const dist = Math.hypot(b.x - mx, b.y - my);
          const nearMouse = mActive && dist < 210;

          if (nearMouse) {
            const linkAlpha = (1 - dist / 210) * 0.28;
            ctx.strokeStyle = `rgba(255, 176, 0, ${linkAlpha})`;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }

          const finalAlpha = nearMouse ? Math.min(0.85, b.alpha + 0.35) : b.alpha;
          ctx.fillStyle = `rgba(255, 176, 0, ${finalAlpha})`;
          ctx.fillText(b.text, b.x, b.y);

          // Small phosphor square node
          ctx.fillRect(b.x - 6, b.y - 4, 2.5, 2.5);
        }

        // Tactical cursor reticle
        if (mActive) {
          ctx.strokeStyle = "rgba(255, 176, 0, 0.25)";
          ctx.beginPath();
          ctx.arc(mx, my, 24, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (theme === "obsidian") {
        // Midnight Obsidian: Threadlines-style flowing ASCII/Hex code streams with 3D parallax
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, width, height);

        // Subtle architectural micro-grid dots
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        const dotStep = 48;
        for (let x = 24; x < width; x += dotStep) {
          for (let y = 24; y < height; y += dotStep) {
            ctx.fillRect(x, y, 1, 1);
          }
        }

        // Flowing code streams
        const parallaxX = mActive ? (mx - width / 2) * 0.025 : 0;
        const parallaxY = mActive ? (my - height / 2) * 0.025 : 0;

        for (let i = 0; i < obsidianStreams.length; i++) {
          const s = obsidianStreams[i];
          s.x += s.speed;
          if (s.x > width + 220) {
            s.x = -260;
            s.y = Math.random() * height;
          }

          const drawX = s.x - parallaxX * s.z;
          const drawY = s.y - parallaxY * s.z;
          const dist = Math.hypot(drawX - mx, drawY - my);
          const highlight = mActive && dist < 220 ? (220 - dist) / 220 : 0;

          const fontSize = Math.round(9 + s.z * 3);
          ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

          if (highlight > 0.05) {
            ctx.fillStyle = `rgba(56, 189, 248, ${Math.min(0.75, s.alpha + highlight * 0.45)})`;
          } else {
            ctx.fillStyle = `rgba(148, 163, 184, ${s.alpha})`;
          }

          ctx.fillText(s.text, drawX, drawY);

          // Leading glyph tick
          ctx.fillStyle =
            highlight > 0.05
              ? `rgba(56, 189, 248, ${0.4 + highlight * 0.5})`
              : `rgba(56, 189, 248, ${s.alpha * 0.9})`;
          ctx.fillRect(drawX - 8, drawY - fontSize + 3, 3, fontSize - 3);
        }
      } else if (theme === "tokyo") {
        // Neon Tokyo: Synth-Pulse Vector Mesh & Dual-Polarity Glow
        ctx.fillStyle = "#05030C";
        ctx.fillRect(0, 0, width, height);

        // Perspective horizon pulse lines
        ctx.strokeStyle = "rgba(255, 0, 127, 0.04)";
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 56) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Update and connect synth nodes
        for (let i = 0; i < tokyoNodes.length; i++) {
          const n = tokyoNodes[i];
          n.x += n.vx;
          n.y += n.vy;
          n.phase += 0.03;

          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;

          // Subtle cursor attraction
          if (mActive) {
            const dx = mx - n.x;
            const dy = my - n.y;
            const d = Math.hypot(dx, dy);
            if (d < 220 && d > 10) {
              n.x += (dx / d) * 0.35;
              n.y += (dy / d) * 0.35;
            }
          }

          // Connect neighboring nodes
          for (let j = i + 1; j < tokyoNodes.length; j++) {
            const m = tokyoNodes[j];
            const dist = Math.hypot(n.x - m.x, n.y - m.y);
            if (dist < 145) {
              const alpha = (1 - dist / 145) * 0.24;
              ctx.strokeStyle =
                n.polarity === "magenta" || m.polarity === "magenta"
                  ? `rgba(255, 0, 127, ${alpha})`
                  : `rgba(0, 240, 255, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(m.x, m.y);
              ctx.stroke();
            }
          }

          // Connect to cursor
          if (mActive) {
            const cDist = Math.hypot(n.x - mx, n.y - my);
            if (cDist < 190) {
              const cAlpha = (1 - cDist / 190) * 0.42;
              ctx.strokeStyle =
                n.polarity === "magenta"
                  ? `rgba(255, 0, 127, ${cAlpha})`
                  : `rgba(0, 240, 255, ${cAlpha})`;
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(mx, my);
              ctx.stroke();
            }
          }

          const pulseRadius = n.radius + Math.sin(n.phase) * 0.6;
          ctx.fillStyle =
            n.polarity === "magenta"
              ? "rgba(255, 0, 127, 0.75)"
              : "rgba(0, 240, 255, 0.75)";
          ctx.beginPath();
          ctx.arc(n.x, n.y, Math.max(0.8, pulseRadius), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (theme === "bioluminescence") {
        // Bioluminescence: Abyssal deep-sea organic flow-field spores
        ctx.fillStyle = "rgba(2, 7, 6, 0.25)";
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < bioSpores.length; i++) {
          const sp = bioSpores[i];
          // Harmonic flow field angle
          const fieldAngle =
            Math.sin(sp.x * 0.003 + time * 0.5) * Math.cos(sp.y * 0.003 + time * 0.4) * Math.PI * 2;
          sp.angle += (fieldAngle - sp.angle) * 0.04;
          sp.pulse += 0.035;

          let vx = Math.cos(sp.angle) * sp.speed;
          let vy = Math.sin(sp.angle) * sp.speed;

          // Organic swirl around mouse wake
          if (mActive) {
            const dx = sp.x - mx;
            const dy = sp.y - my;
            const dist = Math.hypot(dx, dy);
            if (dist < 180 && dist > 1) {
              const force = (180 - dist) / 180;
              vx += (-dy / dist) * force * 1.3 + (dx / dist) * force * 0.35;
              vy += (dx / dist) * force * 1.3 + (dy / dist) * force * 0.35;
            }
          }

          sp.x += vx;
          sp.y += vy;

          if (sp.x < -20) sp.x = width + 20;
          if (sp.x > width + 20) sp.x = -20;
          if (sp.y < -20) sp.y = height + 20;
          if (sp.y > height + 20) sp.y = -20;

          const glowFactor = 0.45 + (Math.sin(sp.pulse) + 1) * 0.27;
          const r = sp.radius * (0.85 + Math.sin(sp.pulse) * 0.2);

          // Soft bioluminescent outer halo
          const grad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 5.5);
          grad.addColorStop(0, `hsla(${sp.hue}, 90%, 60%, ${glowFactor * 0.55})`);
          grad.addColorStop(0.4, `hsla(${sp.hue}, 85%, 48%, ${glowFactor * 0.18})`);
          grad.addColorStop(1, "rgba(2, 7, 6, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r * 5.5, 0, Math.PI * 2);
          ctx.fill();

          // Bright core spore
          ctx.fillStyle = `hsla(${sp.hue}, 95%, 78%, ${glowFactor * 0.9})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, r * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [theme, paused, onFpsUpdate]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
    />
  );
}
