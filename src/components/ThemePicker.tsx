"use client";

import { THEMES, type ThemeId } from "@canvas/index";
import { Check } from "lucide-react";
import { cx } from "./ui";

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange(id: ThemeId): void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => onChange(theme.id)}
          className={cx(
            "group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition",
            value === theme.id ? "border-accent" : "border-line hover:border-fg/30",
          )}
          style={{ background: theme.colors.bg }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-sm" style={{ borderColor: `${theme.colors.accent}55`, color: theme.colors.accent, background: theme.colors.panel }}>
            {theme.id === "matrix" ? "ｱ" : theme.id === "cyber-terminal" ? "0x" : theme.id === "midnight-obsidian" ? "::" : theme.id === "neon-tokyo" ? "東" : "∘"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium" style={{ color: theme.colors.fg }}>
              {theme.name}
            </span>
            <span className="block truncate text-xs" style={{ color: theme.colors.dim }}>
              {theme.tagline}
            </span>
          </span>
          <span className="ml-auto flex gap-1">
            {[theme.colors.accent, theme.colors.accent2].map((c) => (
              <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
            ))}
          </span>
          {value === theme.id && (
            <span className="absolute right-2 top-2 rounded-full p-0.5" style={{ background: theme.colors.accent }}>
              <Check className="h-3 w-3" style={{ color: theme.colors.bg }} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
