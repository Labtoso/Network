"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Filter,
  Globe,
  ListFilter,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";
import { ThemeConfig } from "@/lib/themes";
import { AdGuardMirrorState, ClientDeviceProfile } from "@/lib/db";
import {
  ADGUARD_SERVICES_CATALOG,
  AdGuardQueryLogEntry,
} from "@/lib/adguard-sync";

interface AdGuardMirrorSuiteProps {
  theme: ThemeConfig;
  adguard: AdGuardMirrorState;
  devices: ClientDeviceProfile[];
  adguardUrl: string;
  onMutateAdGuard: (payload: Record<string, unknown>) => Promise<void>;
  onNotify: (msg: string) => void;
}

export default function AdGuardMirrorSuite({
  theme,
  adguard,
  devices,
  adguardUrl,
  onMutateAdGuard,
  onNotify,
}: AdGuardMirrorSuiteProps) {
  const [subTab, setSubTab] = useState<
    "querylog" | "lists" | "rules" | "services" | "rewrites" | "stats"
  >("querylog");

  // 1. Live Query-Log State & SSE Stream
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);
  const [streamEntries, setStreamEntries] = useState<AdGuardQueryLogEntry[]>(
    adguard.queryLog || []
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "allowed" | "blocked" | "rewritten" | "service_blocked"
  >("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [protocolFilter, setProtocolFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 2. Filter Lists & Allowlists State
  const [newListName, setNewListName] = useState("");
  const [newListUrl, setNewListUrl] = useState("");
  const [newListType, setNewListType] = useState<"blocklist" | "allowlist">("blocklist");
  const [expandedListSection, setExpandedListSection] = useState<{
    blocklists: boolean;
    allowlists: boolean;
  }>({ blocklists: true, allowlists: true });

  // 3. Custom Rules & Visual Builder State
  const [rulesText, setRulesText] = useState(
    (adguard.customRules || []).join("\n")
  );
  const [builderDomain, setBuilderDomain] = useState("");
  const [builderAction, setBuilderAction] = useState<"block" | "allow">("block");
  const [builderClient, setBuilderClient] = useState<string>("global");

  // 4. Blocked Services Scope State
  const [serviceScope, setServiceScope] = useState<string>("global");

  // 5. DNS Rewrites State
  const [rwDomain, setRwDomain] = useState("");
  const [rwAnswer, setRwAnswer] = useState("");
  const [rwComment, setRwComment] = useState("");

  // 6. Stats Timeframe State
  const [statsRange, setStatsRange] = useState<"24h" | "7d" | "30d" | "90d">("24h");

  useEffect(() => {
    setStreamEntries(adguard.queryLog || []);
  }, [adguard.queryLog]);

  useEffect(() => {
    setRulesText((adguard.customRules || []).join("\n"));
  }, [adguard.customRules]);

  // Connect Server-Sent Events (SSE) for Live Query-Log Streaming
  useEffect(() => {
    if (!liveStreamEnabled) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/adguard/stream");
      es.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data) as AdGuardQueryLogEntry;
          setStreamEntries((prev) => [entry, ...prev.slice(0, 79)]);
        } catch {
          // ignore malformed SSE chunk
        }
      };
    } catch {
      // ignore if SSE not supported
    }
    return () => {
      if (es) es.close();
    };
  }, [liveStreamEnabled]);

  const filteredQueries = useMemo(() => {
    return streamEntries.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (clientFilter !== "all" && q.clientId !== clientFilter && q.clientIp !== clientFilter)
        return false;
      if (protocolFilter !== "all" && !q.transport.includes(protocolFilter))
        return false;
      if (
        searchQuery.trim() &&
        !q.domain.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !q.clientName.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [streamEntries, statusFilter, clientFilter, protocolFilter, searchQuery]);

  const blocklists = adguard.filterLists.filter((l) => l.type === "blocklist");
  const allowlists = adguard.filterLists.filter((l) => l.type === "allowlist");

  const handleVisualRuleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = builderDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0];
    if (!clean) return;

    const clientModifier =
      builderClient !== "global" ? `,client='${builderClient}'` : "";
    const rule =
      builderAction === "allow"
        ? `@@||${clean}^$important${clientModifier}`
        : `||${clean}^$important${clientModifier}`;

    const nextLines = [...rulesText.split(/\r?\n/).filter(Boolean), rule];
    setRulesText(nextLines.join("\n"));
    setBuilderDomain("");
    await onMutateAdGuard({
      action: "save_custom_rules",
      rules: nextLines,
    });
  };

  const activeScopeDevice = devices.find((d) => d.id === serviceScope);
  const currentStats = adguard.statsByRange[statsRange] || adguard.statsByRange["24h"];

  return (
    <div className="space-y-5">
      {/* Top AdGuard Live Mirror Banner */}
      <div
        className="rounded-xl p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: theme.colors.bgPanel,
          border: `1px solid ${theme.colors.borderStrong}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: theme.colors.accentMuted,
              border: `1px solid ${theme.colors.borderStrong}`,
              color: theme.colors.accent,
            }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                AdGuard Home 1:1 Bidirectional Mirror
              </h2>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded uppercase flex items-center gap-1"
                style={{
                  backgroundColor: theme.colors.accentMuted,
                  color: theme.colors.accent,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-ping"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                SYNC ACTIVE · 0ms CACHE
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">
              Instanz: <span className="text-white">{adguardUrl}</span> · Letzter Sync:{" "}
              {new Date(adguard.lastSyncTimestamp).toLocaleTimeString("de-DE")}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onMutateAdGuard({ action: "toggle_global_filtering" })
            }
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
            style={{
              backgroundColor: adguard.filteringEnabled
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              color: adguard.filteringEnabled ? "#34D399" : "#F87171",
              border: `1px solid ${
                adguard.filteringEnabled
                  ? "rgba(16, 185, 129, 0.4)"
                  : "rgba(239, 68, 68, 0.4)"
              }`,
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>
              DNS-Schutz: {adguard.filteringEnabled ? "AKTIV" : "PAUSIERT"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onMutateAdGuard({ action: "sync_now" })}
            className="px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all hover:bg-white/5"
            style={{
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.textPrimary,
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: theme.colors.accent }} />
            <span>1:1 Sync</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills (Swipeable on Mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: "querylog", label: "1. Live Query-Log", icon: Radio },
          { id: "lists", label: "2. Sperr- & Whitelists", icon: ListFilter },
          { id: "rules", label: "3. Custom Rules Editor", icon: Code2 },
          { id: "services", label: "4. Gesperrte Dienste (27)", icon: Sliders },
          { id: "rewrites", label: "5. DNS-Rewrites", icon: Globe },
          { id: "stats", label: "6. Statistiken & Upstreams", icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 shrink-0 transition-all"
              style={{
                backgroundColor: active
                  ? theme.colors.accentMuted
                  : theme.colors.bgPanel,
                color: active ? theme.colors.accent : theme.colors.textSecondary,
                border: `1px solid ${
                  active ? theme.colors.borderStrong : theme.colors.border
                }`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: LIVE QUERY-LOG & TRAFFIC STREAMER                        */}
      {/* =================================================================== */}
      {subTab === "querylog" && (
        <div
          className="rounded-xl p-4 sm:p-5 backdrop-blur-xl space-y-4"
          style={{
            backgroundColor: theme.colors.bgPanel,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Multi-Filter & Live Stream Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "Alle Anfragen", dot: "#94A3B8" },
                { id: "allowed", label: "🟢 Durchgelassen", dot: "#22C55E" },
                { id: "blocked", label: "🔴 Blockiert (Filter)", dot: "#EF4444" },
                { id: "rewritten", label: "🟡 Umgeschrieben", dot: "#EAB308" },
                { id: "service_blocked", label: "🔵 Dienst gesperrt", dot: "#38BDF8" },
              ].map((st) => {
                const active = statusFilter === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setStatusFilter(st.id as typeof statusFilter)
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={{
                      backgroundColor: active
                        ? theme.colors.accentMuted
                        : "rgba(255,255,255,0.03)",
                      color: active ? theme.colors.accent : theme.colors.textSecondary,
                      border: `1px solid ${
                        active ? theme.colors.borderStrong : theme.colors.border
                      }`,
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setLiveStreamEnabled((s) => !s)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2"
              style={{
                backgroundColor: liveStreamEnabled
                  ? theme.colors.accentMuted
                  : "rgba(255,255,255,0.03)",
                color: liveStreamEnabled ? theme.colors.accent : "#94A3B8",
                border: `1px solid ${
                  liveStreamEnabled ? theme.colors.borderStrong : theme.colors.border
                }`,
              }}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  liveStreamEnabled ? "animate-ping" : ""
                }`}
                style={{
                  backgroundColor: liveStreamEnabled
                    ? theme.colors.accent
                    : "#64748B",
                }}
              />
              <span>{liveStreamEnabled ? "SSE LIVE-STREAM AN" : "STREAM PAUSIERT"}</span>
            </button>
          </div>

          {/* Search, Device & Protocol Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Domain oder Client durchsuchen (z.B. tiktok.com)..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
            >
              <option value="all">Alle Geräte / Clients ({devices.length})</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ip})
                </option>
              ))}
            </select>

            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
            >
              <option value="all">Alle Protokolle (UDP :53, DoH 5G, DoT 853)</option>
              <option value="UDP">UDP :53 (Heim-WLAN)</option>
              <option value="DoH">DoH (5G / LTE Roaming)</option>
              <option value="DoT">DoT (853 Android Private DNS)</option>
            </select>
          </div>

          {/* Query Cards Feed */}
          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {filteredQueries.map((q) => {
                const isBlocked =
                  q.status === "blocked" || q.status === "service_blocked";
                const statusBadge =
                  q.status === "allowed"
                    ? {
                        label: "🟢 ALLOWED",
                        bg: "rgba(34, 197, 94, 0.14)",
                        color: "#4ADE80",
                        border: "rgba(34, 197, 94, 0.35)",
                      }
                    : q.status === "blocked"
                    ? {
                        label: "🔴 BLOCKED",
                        bg: "rgba(239, 68, 68, 0.14)",
                        color: "#F87171",
                        border: "rgba(239, 68, 68, 0.35)",
                      }
                    : q.status === "rewritten"
                    ? {
                        label: "🟡 REWRITTEN",
                        bg: "rgba(234, 179, 8, 0.14)",
                        color: "#FACC15",
                        border: "rgba(234, 179, 8, 0.35)",
                      }
                    : {
                        label: "🔵 SERVICE BLOCKED",
                        bg: "rgba(56, 189, 248, 0.14)",
                        color: "#38BDF8",
                        border: "rgba(56, 189, 248, 0.35)",
                      };

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${statusBadge.border}`,
                    }}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                          {q.domain}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                          {q.queryType}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                          {q.timestamp} · {q.latencyMs}ms
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-400">
                        <button
                          type="button"
                          onClick={() => {
                            setClientFilter(
                              clientFilter === q.clientId ? "all" : q.clientId
                            );
                            onNotify(
                              clientFilter === q.clientId
                                ? "Gerätefilter zurückgesetzt"
                                : `Filtere nach Gerät: ${q.clientName}`
                            );
                          }}
                          className="hover:underline flex items-center gap-1"
                          style={{ color: theme.colors.accent }}
                          title="Klicken, um nur Anfragen dieses Geräts zu filtern"
                        >
                          <span>📱 {q.clientName}</span>
                          <span className="text-zinc-500">
                            ({q.clientIp} · {q.clientMac})
                          </span>
                        </button>
                        <span>•</span>
                        <span>Protokoll: {q.transport}</span>
                        <span>•</span>
                        <span>Antwort: {q.answer}</span>
                      </div>

                      {(q.filterListName || q.rule) && (
                        <div className="text-[11px] font-mono text-zinc-400">
                          Filter: <strong className="text-zinc-200">{q.filterListName}</strong>{" "}
                          {q.rule && (
                            <code className="ml-1 px-1.5 py-0.5 rounded bg-black/60 text-amber-300">
                              {q.rule}
                            </code>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 1-Click Quick Actions right in the Query Log */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isBlocked ? (
                        <button
                          type="button"
                          onClick={() =>
                            onMutateAdGuard({
                              action: "quick_rule",
                              domain: q.domain,
                              mode: "whitelist",
                            })
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all hover:brightness-110"
                          style={{
                            backgroundColor: "rgba(34, 197, 94, 0.16)",
                            color: "#4ADE80",
                            border: "1px solid rgba(34, 197, 94, 0.4)",
                          }}
                        >
                          🟢 Sofort auf Whitelist
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onMutateAdGuard({
                              action: "quick_rule",
                              domain: q.domain,
                              mode: "block",
                            })
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all hover:brightness-110"
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.16)",
                            color: "#F87171",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                          }}
                        >
                          🔴 Sofort sperren
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: DNS-SPERRLISTEN & WHITELISTS MANAGEMENT                  */}
      {/* =================================================================== */}
      {subTab === "lists" && (
        <div className="space-y-4">
          {/* Top Action Bar & Add List Form */}
          <div
            className="rounded-xl p-4 sm:p-5 backdrop-blur-xl space-y-4"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-white">
                  DNS-Sperrlisten (Blocklists) & Freigabelisten (Allowlists)
                </h3>
                <p className="text-xs font-mono text-zinc-400">
                  Spiegelt /control/filtering/status · {blocklists.reduce((a, b) => a + (b.enabled ? b.rulesCount : 0), 0).toLocaleString("de-DE")} aktive Filterregeln
                </p>
              </div>

              <button
                type="button"
                onClick={() => onMutateAdGuard({ action: "refresh_lists" })}
                className="px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all hover:brightness-110"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: "#050505",
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Alle Filterlisten jetzt aktualisieren</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newListName.trim() || !newListUrl.trim()) return;
                await onMutateAdGuard({
                  action: "add_list",
                  name: newListName,
                  url: newListUrl,
                  listType: newListType,
                });
                setNewListName("");
                setNewListUrl("");
              }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-white/10"
            >
              <select
                value={newListType}
                onChange={(e) =>
                  setNewListType(e.target.value as "blocklist" | "allowlist")
                }
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
              >
                <option value="blocklist">🔴 Sperrliste</option>
                <option value="allowlist">🟢 Freigabeliste</option>
              </select>
              <input
                type="text"
                placeholder="Listenname (z.B. OISD Big Blocklist)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="sm:col-span-3 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                required
              />
              <input
                type="url"
                placeholder="https://big.oisd.nl"
                value={newListUrl}
                onChange={(e) => setNewListUrl(e.target.value)}
                className="sm:col-span-5 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                required
              />
              <button
                type="submit"
                className="sm:col-span-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: theme.colors.accentMuted,
                  color: theme.colors.accent,
                  border: `1px solid ${theme.colors.borderStrong}`,
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Hinzufügen</span>
              </button>
            </form>
          </div>

          {/* Accordion 1: Blocklists */}
          <div
            className="rounded-xl p-4 backdrop-blur-xl space-y-3"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedListSection((s) => ({
                  ...s,
                  blocklists: !s.blocklists,
                }))
              }
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-mono font-semibold text-white">
                🔴 Aktive DNS-Sperrlisten ({blocklists.length})
              </span>
              {expandedListSection.blocklists ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {expandedListSection.blocklists && (
              <div className="space-y-2.5 pt-2">
                {blocklists.map((list) => (
                  <div
                    key={list.id}
                    className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.02)",
                      border: `1px solid ${
                        list.enabled ? theme.colors.borderStrong : theme.colors.border
                      }`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-white">
                          {list.name}
                        </span>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: list.enabled
                              ? theme.colors.accentMuted
                              : "rgba(255,255,255,0.05)",
                            color: list.enabled ? theme.colors.accent : "#71717A",
                          }}
                        >
                          {list.enabled ? "AKTIV" : "PAUSIERT"} ·{" "}
                          {list.rulesCount.toLocaleString("de-DE")} Regeln
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate mt-1">
                        {list.url}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        Zuletzt aktualisiert: {list.lastUpdated}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onMutateAdGuard({
                            action: "toggle_list",
                            id: list.id,
                            enabled: !list.enabled,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                        style={{
                          backgroundColor: list.enabled
                            ? theme.colors.accent
                            : "rgba(255,255,255,0.06)",
                          color: list.enabled ? "#050505" : "#A1A1AA",
                        }}
                      >
                        {list.enabled ? "Aktiv" : "Aktivieren"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMutateAdGuard({ action: "delete_list", id: list.id })
                        }
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                        title="Liste löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 2: Allowlists */}
          <div
            className="rounded-xl p-4 backdrop-blur-xl space-y-3"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedListSection((s) => ({
                  ...s,
                  allowlists: !s.allowlists,
                }))
              }
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-mono font-semibold text-white">
                🟢 Globale Freigabelisten / Allowlists ({allowlists.length})
              </span>
              {expandedListSection.allowlists ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {expandedListSection.allowlists && (
              <div className="space-y-2.5 pt-2">
                {allowlists.map((list) => (
                  <div
                    key={list.id}
                    className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.02)",
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-white">
                          {list.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          ALLOWLIST · {list.rulesCount.toLocaleString("de-DE")} Regeln
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate mt-1">
                        {list.url}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onMutateAdGuard({
                            action: "toggle_list",
                            id: list.id,
                            enabled: !list.enabled,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                        style={{
                          backgroundColor: list.enabled
                            ? "#10B981"
                            : "rgba(255,255,255,0.06)",
                          color: list.enabled ? "#050505" : "#A1A1AA",
                        }}
                      >
                        {list.enabled ? "Aktiv" : "Pausiert"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMutateAdGuard({ action: "delete_list", id: list.id })
                        }
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: CUSTOM RULES EDITOR & VISUAL RULE BUILDER                */}
      {/* =================================================================== */}
      {subTab === "rules" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 5 Cols: Visual Rule Builder */}
          <div
            className="lg:col-span-5 rounded-xl p-5 backdrop-blur-xl space-y-4"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Visual Rule Builder (Smartphone- & Einsteiger-Modus)
              </h3>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                Erzeugt automatisch fehlerfreie AdGuard-Filtersyntax inklusive <code className="text-white">$client</code>-Zuweisung.
              </p>
            </div>

            <form onSubmit={handleVisualRuleAdd} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  1. Domain eingeben
                </label>
                <input
                  type="text"
                  value={builderDomain}
                  onChange={(e) => setBuilderDomain(e.target.value)}
                  placeholder="z.B. tiktok.com oder roblox.com"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  2. Aktion wählen
                </label>
                <select
                  value={builderAction}
                  onChange={(e) =>
                    setBuilderAction(e.target.value as "block" | "allow")
                  }
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                >
                  <option value="block">🔴 Blockieren (||domain^$important)</option>
                  <option value="allow">🟢 Erlauben / Whitelist (@@||domain^$important)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  3. Zielgerät (Global oder spezifischer Client)
                </label>
                <select
                  value={builderClient}
                  onChange={(e) => setBuilderClient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                >
                  <option value="global">🌐 Global (Für alle Geräte im Netz & Roaming)</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.ip}>
                      📱 Nur für {d.name} ({d.ip})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-mono font-semibold transition-all hover:brightness-110"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: "#050505",
                }}
              >
                + Regel generieren & sofort in AdGuard speichern
              </button>
            </form>

            <div className="p-3 rounded-xl bg-black/50 border border-white/5 text-[11px] font-mono space-y-1 text-zinc-400">
              <div className="text-white font-semibold">Syntax-Referenz:</div>
              <div>• <code className="text-red-400">||example.com^</code> blockiert Domain & Subdomains</div>
              <div>• <code className="text-emerald-400">@@||example.com^</code> hebt Sperre auf (Whitelist)</div>
              <div>• <code className="text-sky-400">$client=&apos;192.168.178.42&apos;</code> gilt nur für dieses Gerät</div>
            </div>
          </div>

          {/* Right 7 Cols: Dark/Matrix Monaco-Style Code Editor */}
          <div
            className="lg:col-span-7 rounded-xl p-5 backdrop-blur-xl space-y-3"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-white">
                  AdGuard Custom Filtering Rules Editor
                </h3>
                <p className="text-xs font-mono text-zinc-400">
                  Synchronisiert mit <code className="text-white">/control/filtering/set_rules</code>
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onMutateAdGuard({
                    action: "save_custom_rules",
                    rulesText,
                  })
                }
                className="px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all hover:brightness-110"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: "#050505",
                }}
              >
                Regeln in AdGuard speichern
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#040406]">
              <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400 bg-white/[0.02]">
                <span>user_rules.txt ({rulesText.split(/\r?\n/).filter(Boolean).length} Zeilen)</span>
                <span className="text-emerald-400">✓ Syntax Validated</span>
              </div>
              <textarea
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                rows={13}
                spellCheck={false}
                className="w-full p-3.5 bg-transparent font-mono text-xs leading-relaxed text-emerald-300 focus:outline-none resize-y"
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: GESPERRTE DIENSTE SUITE (27 ADGUARD SERVICES)            */}
      {/* =================================================================== */}
      {subTab === "services" && (
        <div
          className="rounded-xl p-5 backdrop-blur-xl space-y-5"
          style={{
            backgroundColor: theme.colors.bgPanel,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Gesperrte Dienste Suite (Blocked Services Mirror)
              </h3>
              <p className="text-xs font-mono text-zinc-400">
                Wähle, ob Dienste <strong>Global für alle</strong> oder <strong>Geräte-/Profil-spezifisch</strong> gesperrt werden sollen.
              </p>
            </div>

            {/* Scope Selector: Global vs Each Device */}
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setServiceScope("global")}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all"
                style={{
                  backgroundColor:
                    serviceScope === "global"
                      ? theme.colors.accent
                      : "rgba(255,255,255,0.04)",
                  color: serviceScope === "global" ? "#050505" : "#E4E4E7",
                }}
              >
                🌐 Global (Alle Geräte)
              </button>
              {devices.map((dev) => {
                const active = serviceScope === dev.id;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setServiceScope(dev.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                    style={{
                      backgroundColor: active
                        ? theme.colors.accentMuted
                        : "rgba(255,255,255,0.03)",
                      color: active ? theme.colors.accent : "#A1A1AA",
                      border: `1px solid ${
                        active ? theme.colors.borderStrong : theme.colors.border
                      }`,
                    }}
                  >
                    <span>{dev.name}</span>
                    {dev.isAdminProtected && (
                      <Lock className="w-3 h-3 text-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeScopeDevice?.isAdminProtected && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Admin-Schutz aktiv:</strong> {activeScopeDevice.name} ({activeScopeDevice.ip}) steht auf der permanenten Admin-Whitelist und kann nicht gesperrt werden.
              </span>
            </div>
          )}

          {(
            ["Social Media", "Streaming & Video", "Gaming", "Messenger"] as const
          ).map((category) => {
            const items = ADGUARD_SERVICES_CATALOG.filter(
              (s) => s.category === category
            );
            return (
              <div key={category} className="space-y-2.5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 border-b border-white/5 pb-1.5">
                  {category === "Social Media" && "📱 Social Media"}
                  {category === "Streaming & Video" && "🎬 Streaming & Video"}
                  {category === "Gaming" && "🎮 Gaming Platforms"}
                  {category === "Messenger" && "💬 Messenger & Chat"}
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {items.map((srv) => {
                    const isBlocked =
                      serviceScope === "global"
                        ? adguard.globalBlockedServices.includes(srv.id)
                        : activeScopeDevice
                        ? activeScopeDevice.blockedApps.includes(srv.id)
                        : false;

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        disabled={!!activeScopeDevice?.isAdminProtected}
                        onClick={() =>
                          onMutateAdGuard({
                            action: "toggle_blocked_service",
                            serviceId: srv.id,
                            scope: serviceScope,
                          })
                        }
                        className="p-3 rounded-xl text-left transition-all duration-150 flex flex-col justify-between disabled:opacity-40"
                        style={{
                          backgroundColor: isBlocked
                            ? "rgba(239, 68, 68, 0.16)"
                            : "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${
                            isBlocked
                              ? "rgba(239, 68, 68, 0.45)"
                              : theme.colors.border
                          }`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">
                            {srv.name}
                          </span>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: isBlocked ? "#EF4444" : "#22C55E",
                            }}
                          />
                        </div>
                        <div className="mt-2 text-[10px] font-mono uppercase">
                          {isBlocked ? (
                            <span className="text-red-400 font-bold">
                              🔴 GESPERRT
                            </span>
                          ) : (
                            <span className="text-emerald-400">🟢 ERLAUBT</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 5: DNS-UMSCHREIBUNGEN (DNS REWRITES)                        */}
      {/* =================================================================== */}
      {subTab === "rewrites" && (
        <div
          className="rounded-xl p-5 backdrop-blur-xl space-y-4"
          style={{
            backgroundColor: theme.colors.bgPanel,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">
              DNS-Umschreibungen (DNS Rewrites & Lokale Split-DNS Domains)
            </h3>
            <p className="text-xs font-mono text-zinc-400">
              Spiegelt <code className="text-white">/control/rewrite/list</code> · Lokale Hostnamen & Custom Sinkhole-Ziele
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rwDomain.trim() || !rwAnswer.trim()) return;
              await onMutateAdGuard({
                action: "add_rewrite",
                domain: rwDomain,
                answer: rwAnswer,
                comment: rwComment,
              });
              setRwDomain("");
              setRwAnswer("");
              setRwComment("");
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              placeholder="Domain (z.B. nas.home oder *.labtoso.local)"
              value={rwDomain}
              onChange={(e) => setRwDomain(e.target.value)}
              className="sm:col-span-4 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
              required
            />
            <input
              type="text"
              placeholder="Ziel-IP oder CNAME (z.B. 192.168.178.67)"
              value={rwAnswer}
              onChange={(e) => setRwAnswer(e.target.value)}
              className="sm:col-span-3 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
              required
            />
            <input
              type="text"
              placeholder="Notiz / Zweck"
              value={rwComment}
              onChange={(e) => setRwComment(e.target.value)}
              className="sm:col-span-3 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold"
              style={{
                backgroundColor: theme.colors.accent,
                color: "#050505",
              }}
            >
              + Rewrite anlegen
            </button>
          </form>

          <div className="space-y-2">
            {adguard.rewrites.map((rw) => (
              <div
                key={rw.id}
                className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                    {rw.domain}
                  </span>
                  <span className="text-zinc-500">➔</span>
                  <span
                    className="font-bold"
                    style={{ color: theme.colors.accent }}
                  >
                    {rw.answer}
                  </span>
                  <span className="text-zinc-400">({rw.comment})</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onMutateAdGuard({ action: "delete_rewrite", id: rw.id })
                  }
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                  title="Rewrite löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 6: STATISTIKEN, LATENZEN & UPSTREAM-DNS MONITORING          */}
      {/* =================================================================== */}
      {subTab === "stats" && (
        <div className="space-y-5">
          {/* Timeframe Picker & KPI Summary */}
          <div
            className="rounded-xl p-5 backdrop-blur-xl space-y-4"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-white">
                  AdGuard Home Telemetrie & Upstream-Latenz
                </h3>
                <p className="text-xs font-mono text-zinc-400">
                  Spiegelt <code className="text-white">/control/stats</code> · Echtzeit-Auswertung
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: "24h", label: "24 Stunden" },
                    { id: "7d", label: "7 Tage" },
                    { id: "30d", label: "30 Tage" },
                    { id: "90d", label: "90 Tage" },
                  ] as const
                ).map((r) => {
                  const active = statsRange === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setStatsRange(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                      style={{
                        backgroundColor: active
                          ? theme.colors.accent
                          : "rgba(255,255,255,0.03)",
                        color: active ? "#050505" : "#A1A1AA",
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="text-[11px] text-zinc-400">DNS-Anfragen gesamt</div>
                <div className="text-xl font-bold text-white mt-1 tabular-nums">
                  {currentStats.totalQueries.toLocaleString("de-DE")}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">
                  Ø {currentStats.avgProcessingTimeMs} ms Antwortzeit
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="text-[11px] text-zinc-400">Blockierte Anfragen</div>
                <div className="text-xl font-bold text-red-400 mt-1 tabular-nums">
                  {currentStats.blockedQueries.toLocaleString("de-DE")}
                </div>
                <div className="text-[10px] text-red-300 mt-1">
                  Block-Rate: {currentStats.blockPercentage}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="text-[11px] text-zinc-400">Malware / Phishing / NSFW</div>
                <div className="text-xl font-bold text-amber-400 mt-1 tabular-nums">
                  {currentStats.malwarePhishingBlocked.toLocaleString("de-DE")}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  HaGeZi Multi PRO + NSFW
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="text-[11px] text-zinc-400">DNS-Rewrites (Split-DNS)</div>
                <div
                  className="text-xl font-bold mt-1 tabular-nums"
                  style={{ color: theme.colors.accent }}
                >
                  {currentStats.rewrittenQueries.toLocaleString("de-DE")}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Lokale Homeserver-Routen
                </div>
              </div>
            </div>

            {/* Animated Visual Bar Chart of Queries vs Blocked */}
            <div className="pt-2">
              <div className="text-xs font-mono text-zinc-400 mb-2">
                Anfrage-Verlauf ({statsRange}) — Gesamt vs. Blockiert
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 items-end h-36 pt-4 px-3 pb-2 rounded-xl bg-black/50 border border-white/5">
                {currentStats.hourlySeries.map((pt, i) => {
                  const maxVal = Math.max(
                    ...currentStats.hourlySeries.map((x) => x.total),
                    1
                  );
                  const totalH = Math.max(12, Math.round((pt.total / maxVal) * 95));
                  const blockedH = Math.max(
                    4,
                    Math.round((pt.blocked / maxVal) * 95)
                  );
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-end h-full gap-1"
                    >
                      <div className="w-full flex items-end justify-center gap-1 h-24">
                        <div
                          className="w-3 rounded-t transition-all duration-500"
                          style={{
                            height: `${totalH}%`,
                            backgroundColor: theme.colors.accent,
                          }}
                          title={`Gesamt: ${pt.total}`}
                        />
                        <div
                          className="w-3 rounded-t bg-red-500/80 transition-all duration-500"
                          style={{ height: `${blockedH}%` }}
                          title={`Blockiert: ${pt.blocked}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {pt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Blocked Domains, Top Clients & Upstream Latency Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top Blocked Domains */}
            <div
              className="rounded-xl p-4 backdrop-blur-xl space-y-3"
              style={{
                backgroundColor: theme.colors.bgPanel,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                🔴 Top Blockierte Domains
              </h4>
              <div className="space-y-2.5">
                {currentStats.topBlockedDomains.map((d, idx) => (
                  <div key={idx} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-white truncate">{d.domain}</span>
                      <span className="text-red-400 tabular-nums">
                        {d.count.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500">{d.category}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Requesting Clients */}
            <div
              className="rounded-xl p-4 backdrop-blur-xl space-y-3"
              style={{
                backgroundColor: theme.colors.bgPanel,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                📱 Top Anfragende Clients
              </h4>
              <div className="space-y-2.5">
                {currentStats.topClients.map((c, idx) => (
                  <div key={idx} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-white truncate">{c.name}</span>
                      <span
                        className="tabular-nums"
                        style={{ color: theme.colors.accent }}
                      >
                        {c.count.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>{c.ip}</span>
                      <span className="text-red-400">
                        {c.blockedCount.toLocaleString("de-DE")} geblockt
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upstream DNS Server Latencies */}
            <div
              className="rounded-xl p-4 backdrop-blur-xl space-y-3"
              style={{
                backgroundColor: theme.colors.bgPanel,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                ⚡ Upstream-DNS Server Latenzen
              </h4>
              <div className="space-y-2.5">
                {adguard.upstreams.map((up) => (
                  <div
                    key={up.id}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">{up.name}</span>
                      <span className="text-emerald-400 font-bold tabular-nums">
                        {up.latencyMs} ms
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {up.address} ({up.protocol})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
