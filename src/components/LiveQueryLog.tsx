"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, CheckCircle2, Pause, Play, Radio, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, streamEvents } from "@/lib/api";
import { formatTime, isBlocked, reasonLabel } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { QueryLogEntry } from "@/lib/types";
import { Badge, Button, Card, cx } from "./ui";

const MAX_ROWS = 300;

function keyOf(entry: QueryLogEntry): string {
  return `${entry.time}|${entry.client}|${entry.question.name}|${entry.question.type}`;
}

export function LiveQueryLog() {
  const { run } = useApp();
  const [entries, setEntries] = useState<QueryLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | "blocked" | "allowed">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  const buffer = useRef<QueryLogEntry[]>([]);
  pausedRef.current = paused;

  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      streamEvents(
        "/api/querylog/stream",
        (event, data) => {
          setConnected(true);
          if (event === "snapshot") {
            setEntries((data as QueryLogEntry[]).slice(0, MAX_ROWS));
          } else if (event === "entries") {
            const fresh = [...(data as QueryLogEntry[])].reverse();
            setUpstreamError(null);
            if (pausedRef.current) buffer.current = [...fresh, ...buffer.current].slice(0, MAX_ROWS);
            else setEntries((list) => [...fresh, ...list].slice(0, MAX_ROWS));
          } else if (event === "upstream-error") {
            setUpstreamError((data as { message: string }).message);
          }
        },
        controller.signal,
      )
        .catch(() => undefined)
        .finally(() => {
          setConnected(false);
          if (!controller.signal.aborted) retry = setTimeout(connect, 3000);
        });
    };
    connect();
    return () => {
      controller.abort();
      if (retry) clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    if (!paused && buffer.current.length) {
      const pending = buffer.current;
      buffer.current = [];
      setEntries((list) => [...pending, ...list].slice(0, MAX_ROWS));
    }
  }, [paused]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const blocked = isBlocked(entry.reason);
      if (filter === "blocked" && !blocked) return false;
      if (filter === "allowed" && blocked) return false;
      if (!term) return true;
      return entry.question.name.toLowerCase().includes(term) || entry.client.includes(term) || (entry.client_info?.name ?? "").toLowerCase().includes(term);
    });
  }, [entries, filter, search]);

  const quick = (domain: string, action: "block" | "allow") =>
    run(() => api("/api/quick-rule", { body: { domain, action } }), action === "block" ? `${domain} gesperrt` : `${domain} freigegeben`);

  return (
    <Card
      title="Live Query-Log"
      icon={<Radio className="h-4 w-4" />}
      action={
        <div className="flex items-center gap-2">
          <Badge tone={connected ? "ok" : "danger"}>{connected ? "live" : "offline"}</Badge>
          <Button size="sm" variant="ghost" icon={paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} onClick={() => setPaused((p) => !p)}>
            {paused ? `Weiter${buffer.current.length ? ` (${buffer.current.length})` : ""}` : "Pause"}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Domain oder Client filtern" className="w-full rounded-xl border border-line bg-bg/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent/70" />
        </label>
        <div className="flex gap-1 rounded-xl border border-line bg-bg/40 p-1">
          {(["all", "blocked", "allowed"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cx("flex-1 rounded-lg px-3 py-1 text-xs transition", filter === f ? "bg-accent text-bg" : "text-dim hover:text-fg")}>
              {f === "all" ? "Alle" : f === "blocked" ? "Gesperrt" : "Erlaubt"}
            </button>
          ))}
        </div>
      </div>
      {upstreamError && <p className="mb-2 rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-warn">{upstreamError}</p>}
      <div className="max-h-[520px] overflow-y-auto rounded-xl border border-line/60">
        <ul className="divide-y divide-line/50 font-mono text-xs">
          <AnimatePresence initial={false}>
            {visible.map((entry) => {
              const key = keyOf(entry);
              const blocked = isBlocked(entry.reason);
              const reason = reasonLabel(entry.reason);
              const domain = entry.question.name.replace(/\.$/, "");
              return (
                <motion.li key={key} layout="position" className="row-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setExpanded(expanded === key ? null : key)}>
                      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", blocked ? "bg-danger" : reason.tone === "allow" ? "bg-ok" : reason.tone === "rewrite" ? "bg-accent2" : "bg-dim")} />
                      <span className="hidden w-16 shrink-0 text-dim sm:inline">{formatTime(entry.time)}</span>
                      <span className={cx("min-w-0 flex-1 truncate", blocked ? "text-danger" : "text-fg")}>{domain}</span>
                      <span className="hidden w-28 shrink-0 truncate text-right text-dim md:inline">{entry.client_info?.name || entry.client}</span>
                    </button>
                    {blocked ? (
                      <button type="button" title="Freigeben" onClick={() => quick(domain, "allow")} className="rounded-lg border border-ok/40 p-1.5 text-ok hover:bg-ok/10">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button type="button" title="Sperren" onClick={() => quick(domain, "block")} className="rounded-lg border border-danger/40 p-1.5 text-danger hover:bg-danger/10">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {expanded === key && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-bg/40 px-3 pb-3 pt-1 text-[11px]">
                      <span className="text-dim">Zeit</span><span>{new Date(entry.time).toLocaleString("de-DE")}</span>
                      <span className="text-dim">Client</span><span>{entry.client_info?.name ? `${entry.client_info.name} (${entry.client})` : entry.client}{entry.client_id ? ` · ID ${entry.client_id}` : ""}</span>
                      <span className="text-dim">Typ</span><span>{entry.question.type} · {entry.client_proto || "dns"}</span>
                      <span className="text-dim">Status</span><span className={blocked ? "text-danger" : ""}>{reason.label}{entry.service_name ? ` · ${entry.service_name}` : ""}</span>
                      {entry.rules?.length ? (<><span className="text-dim">Regel</span><span className="break-all">{entry.rules.map((r) => r.text).join(", ")}</span></>) : null}
                      {entry.answer?.length ? (<><span className="text-dim">Antwort</span><span className="break-all">{entry.answer.map((a) => a.value).join(", ")}</span></>) : null}
                      <span className="text-dim">Upstream</span><span className="break-all">{entry.upstream || (entry.cached ? "Cache" : "–")} · {Number(entry.elapsedMs).toFixed(1)} ms</span>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {visible.length === 0 && <p className="px-3 py-8 text-center text-sm text-dim">{connected ? "Warte auf DNS-Anfragen…" : "Verbinde mit dem Stream…"}</p>}
      </div>
    </Card>
  );
}
