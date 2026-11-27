"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { BlockedService } from "@/lib/types";
import { cx } from "./ui";

export const POPULAR_SERVICES = ["tiktok", "youtube", "instagram", "roblox", "discord", "twitch", "snapchat", "facebook", "whatsapp", "netflix", "fortnite", "minecraft", "steam", "reddit", "twitter", "telegram"];

function icon(service: BlockedService): string | null {
  if (!service.icon_svg) return null;
  return service.icon_svg.trim().startsWith("<") ? `data:image/svg+xml;utf8,${encodeURIComponent(service.icon_svg)}` : `data:image/svg+xml;base64,${service.icon_svg}`;
}

export function ServicePicker({ services, selected, onChange, disabled }: { services: BlockedService[]; selected: string[]; onChange(ids: string[]): void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [onlyPopular, setOnlyPopular] = useState(true);
  const set = useMemo(() => new Set(selected), [selected]);

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = services.filter((s) => (!term || s.name.toLowerCase().includes(term) || s.id.includes(term)) && (term || !onlyPopular || POPULAR_SERVICES.includes(s.id) || set.has(s.id)));
    return filtered.sort((a, b) => {
      const pa = POPULAR_SERVICES.indexOf(a.id);
      const pb = POPULAR_SERVICES.indexOf(b.id);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return a.name.localeCompare(b.name);
    });
  }, [services, query, onlyPopular, set]);

  const toggle = (id: string) => onChange(set.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className={cx(disabled && "pointer-events-none opacity-50")}>
      <div className="mb-3 flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${services.length} Dienste durchsuchen`} className="w-full rounded-xl border border-line bg-bg/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent/70" />
        </label>
        <button type="button" onClick={() => setOnlyPopular((v) => !v)} className={cx("rounded-xl border px-3 text-xs", onlyPopular ? "border-accent/60 text-accent" : "border-line text-dim")}>
          {onlyPopular ? "Beliebte" : "Alle"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((service) => {
          const active = set.has(service.id);
          const src = icon(service);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggle(service.id)}
              aria-pressed={active}
              className={cx("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition", active ? "border-danger/60 bg-danger/10 text-fg" : "border-line bg-bg/40 text-dim hover:border-fg/30 hover:text-fg")}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-5 w-5 shrink-0 opacity-90 invert" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-fg/10 font-mono text-[10px]">{service.name[0]}</span>
              )}
              <span className="min-w-0 flex-1 truncate">{service.name}</span>
              <span className={cx("h-2 w-2 shrink-0 rounded-full", active ? "bg-danger" : "bg-line")} />
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-6 text-center text-sm text-dim">Kein Dienst gefunden.</p>}
    </div>
  );
}
