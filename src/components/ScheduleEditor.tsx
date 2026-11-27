"use client";

import { clockToMs, msToClock } from "@/lib/format";
import type { Schedule } from "@/lib/types";
import { cx } from "./ui";

const DAYS: { key: keyof Omit<Schedule, "time_zone">; label: string }[] = [
  { key: "mon", label: "Mo" },
  { key: "tue", label: "Di" },
  { key: "wed", label: "Mi" },
  { key: "thu", label: "Do" },
  { key: "fri", label: "Fr" },
  { key: "sat", label: "Sa" },
  { key: "sun", label: "So" },
];

/**
 * AdGuard-Zeitplan: In den eingetragenen Fenstern ist die Dienst-Sperre PAUSIERT (Dienste erlaubt).
 * Ausserhalb gilt die Sperre. Daraus berechnet die Sperrseite {time_remaining}.
 */
export function ScheduleEditor({ value, onChange }: { value: Schedule | undefined | null; onChange(schedule: Schedule): void }) {
  const schedule: Schedule = value ?? { time_zone: "Local" };
  const zone = schedule.time_zone ?? "Local";

  const setDay = (key: (typeof DAYS)[number]["key"], span: { start: number; end: number } | undefined) => {
    const next: Schedule = { ...schedule, time_zone: zone };
    if (span) next[key] = span;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-dim">Freizeit-Fenster: in diesen Zeiten sind die gesperrten Dienste erlaubt. Ausserhalb greift die Sperre.</p>
      {DAYS.map((day) => {
        const span = schedule[day.key];
        return (
          <div key={day.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDay(day.key, span ? undefined : { start: clockToMs("15:00"), end: clockToMs("18:00") })}
              className={cx("w-11 shrink-0 rounded-lg border py-1.5 text-xs font-medium", span ? "border-accent bg-accent/15 text-accent" : "border-line text-dim")}
            >
              {day.label}
            </button>
            {span ? (
              <div className="flex flex-1 items-center gap-2 font-mono text-sm">
                <input type="time" value={msToClock(span.start)} onChange={(e) => setDay(day.key, { ...span, start: clockToMs(e.target.value) })} className="rounded-lg border border-line bg-bg/60 px-2 py-1 outline-none focus:border-accent" />
                <span className="text-dim">bis</span>
                <input type="time" value={msToClock(span.end)} onChange={(e) => setDay(day.key, { ...span, end: Math.max(clockToMs(e.target.value), span.start + 60_000) })} className="rounded-lg border border-line bg-bg/60 px-2 py-1 outline-none focus:border-accent" />
              </div>
            ) : (
              <span className="text-xs text-dim">ganztaegig gesperrt</span>
            )}
          </div>
        );
      })}
      <p className="pt-1 font-mono text-[10px] text-dim">Zeitzone: {zone === "Local" ? "Server-Zeitzone von AdGuard" : zone}</p>
    </div>
  );
}
