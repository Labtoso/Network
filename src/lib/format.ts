export const nf = new Intl.NumberFormat("de-DE");

export function formatTime(value: string | null | undefined): string {
  if (!value) return "nie";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "nie";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function relative(value: string | null | undefined): string {
  if (!value) return "nie";
  const diff = Date.now() - new Date(value).getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "her" : "";
  const prefix = diff >= 0 ? "vor " : "in ";
  if (abs < 60_000) return diff >= 0 ? "gerade eben" : "gleich";
  if (abs < 3600_000) return `${prefix}${Math.round(abs / 60_000)} Min ${suffix}`.trim();
  if (abs < 86_400_000) return `${prefix}${Math.round(abs / 3600_000)} Std ${suffix}`.trim();
  return `${prefix}${Math.round(abs / 86_400_000)} T ${suffix}`.trim();
}

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = value / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d} T` : "", h ? `${h} Std` : "", `${m} Min`].filter(Boolean).join(" ");
}

/** AdGuard-Grund in lesbares Deutsch. */
export function reasonLabel(reason: string): { label: string; tone: "ok" | "block" | "allow" | "rewrite" } {
  switch (reason) {
    case "FilteredBlackList":
      return { label: "Gesperrt (Filter)", tone: "block" };
    case "FilteredBlockedService":
      return { label: "Gesperrt (Dienst)", tone: "block" };
    case "FilteredSafeBrowsing":
      return { label: "Gesperrt (Safe Browsing)", tone: "block" };
    case "FilteredParental":
      return { label: "Gesperrt (Jugendschutz)", tone: "block" };
    case "FilteredInvalid":
      return { label: "Ungueltig", tone: "block" };
    case "NotFilteredWhiteList":
      return { label: "Erlaubt (Regel)", tone: "allow" };
    case "Rewrite":
    case "RewriteEtcHosts":
    case "RewriteRule":
      return { label: "Umgeschrieben", tone: "rewrite" };
    case "FilteredSafeSearch":
      return { label: "SafeSearch", tone: "rewrite" };
    default:
      return { label: "Verarbeitet", tone: "ok" };
  }
}

export function isBlocked(reason: string): boolean {
  return reason.startsWith("Filtered") && reason !== "FilteredSafeSearch";
}

export function msToClock(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function clockToMs(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
}
