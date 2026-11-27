import { ag, type QueryLogEntry } from "./adguard.js";
import { rememberBlocked } from "./blockcache.js";

type Listener = (entries: QueryLogEntry[]) => void;
type ErrorListener = (message: string) => void;

const listeners = new Set<Listener>();
const errorListeners = new Set<ErrorListener>();
const seen: string[] = [];
const seenSet = new Set<string>();
let newestMs = 0;
let timer: NodeJS.Timeout | null = null;
let running = false;

function keyOf(entry: QueryLogEntry): string {
  return `${entry.time}|${entry.client}|${entry.question.name}|${entry.question.type}`;
}

function remember(key: string): void {
  seen.push(key);
  seenSet.add(key);
  while (seen.length > 3000) seenSet.delete(seen.shift() as string);
}

async function poll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await ag.queryLog({ limit: 200 });
    const fresh: QueryLogEntry[] = [];
    for (const entry of result.data ?? []) {
      const key = keyOf(entry);
      const at = Date.parse(entry.time);
      if (seenSet.has(key) || (newestMs && at < newestMs - 2000)) continue;
      remember(key);
      fresh.push(entry);
      if (entry.reason.startsWith("Filtered") && entry.reason !== "FilteredSafeSearch") {
        rememberBlocked(entry.question.name, "querylog");
      }
    }
    for (const entry of fresh) newestMs = Math.max(newestMs, Date.parse(entry.time) || 0);
    if (fresh.length) {
      fresh.reverse(); // aelteste zuerst senden
      for (const listener of listeners) listener(fresh);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const listener of errorListeners) listener(message);
  } finally {
    running = false;
  }
}

/** Ein gemeinsamer Poller fuer alle offenen SSE-Verbindungen (AdGuard hat keinen eigenen Push-Kanal). */
export function subscribe(listener: Listener, onError: ErrorListener): () => void {
  listeners.add(listener);
  errorListeners.add(onError);
  if (!timer) {
    void poll();
    timer = setInterval(() => void poll(), 2000);
  }
  return () => {
    listeners.delete(listener);
    errorListeners.delete(onError);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Markiert die aktuell sichtbaren Eintraege als gesehen, damit ein neuer Stream nicht alles doppelt liefert. */
export function primeSeen(entries: QueryLogEntry[]): void {
  for (const entry of entries) {
    remember(keyOf(entry));
    newestMs = Math.max(newestMs, Date.parse(entry.time) || 0);
  }
}
