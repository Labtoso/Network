"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Check,
  Clock,
  Copy,
  Cpu,
  Download,
  Edit3,
  Gamepad2,
  Laptop,
  Lock,
  Moon,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Tv,
  Wifi,
  Zap,
} from "lucide-react";
import { ThemeConfig } from "@/lib/themes";
import {
  BLOCKABLE_APPS,
  BlockedQueryEvent,
  ClientDeviceProfile,
  GlobalPolicySettings,
  UnblockRequestItem,
} from "@/lib/db";
import { generateDeterministicQrMatrix } from "@/lib/roaming-profiles";
import { PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";

interface DeviceAndRulesSuiteProps {
  mode: "devices" | "rules";
  theme: ThemeConfig;
  devices: ClientDeviceProfile[];
  policy: GlobalPolicySettings;
  unblockRequests: UnblockRequestItem[];
  blockedStream: BlockedQueryEvent[];
  onMutateControl: (payload: Record<string, unknown>) => Promise<void>;
  onNotify: (msg: string) => void;
}

const DAYS_ORDER = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function DeviceAndRulesSuite({
  mode,
  theme,
  devices,
  policy,
  unblockRequests,
  blockedStream,
  onMutateControl,
  onNotify,
}: DeviceAndRulesSuiteProps) {
  // Inline device rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState<string>("");

  // Add new device modal
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevName, setNewDevName] = useState("");
  const [newDevIp, setNewDevIp] = useState("192.168.178.");
  const [newDevMac, setNewDevMac] = useState("F0:18:98:44:11:22");
  const [newDevRole, setNewDevRole] = useState<"child" | "guest" | "admin">("child");

  // Selected device for Roaming Anti-Bypass Profile Drawer
  const [roamingModalDevice, setRoamingModalDevice] =
    useState<ClientDeviceProfile | null>(null);
  const [roamingTestResult, setRoamingTestResult] = useState<string | null>(null);

  // Selected device for Rules / 24/7 Schedule / Quotas tab
  const childDevices = devices.filter((d) => !d.isAdminProtected);
  const [selectedRuleDeviceId, setSelectedRuleDeviceId] = useState<string>(
    childDevices[0]?.id || devices[0]?.id || "jonas-iphone"
  );
  const [isDraggingSchedule, setIsDraggingSchedule] = useState(false);
  const [dragTargetValue, setDragTargetValue] = useState<boolean>(false);

  const selectedRuleDevice =
    devices.find((d) => d.id === selectedRuleDeviceId) || devices[0];

  const renderDeviceIcon = (type: ClientDeviceProfile["deviceType"]) => {
    const props = {
      className: "w-5 h-5",
      style: { color: theme.colors.accent },
    };
    switch (type) {
      case "apple":
        return <Smartphone {...props} />;
      case "android":
        return <Tablet {...props} />;
      case "pc":
        return <Laptop {...props} />;
      case "console":
        return <Gamepad2 {...props} />;
      case "tv":
        return <Tv {...props} />;
      default:
        return <Cpu {...props} />;
    }
  };

  const handleSaveRename = async (device: ClientDeviceProfile) => {
    if (!editNameVal.trim()) return;
    await onMutateControl({
      action: "update_device",
      clientId: device.id,
      name: editNameVal.trim(),
    });
    setEditingId(null);
  };

  const handleScheduleCellToggle = async (
    day: string,
    hour: number,
    explicitValue?: boolean
  ) => {
    if (!selectedRuleDevice || selectedRuleDevice.isAdminProtected) return;
    const currentGrid = selectedRuleDevice.weeklySchedule || {};
    const dayArr = Array.isArray(currentGrid[day])
      ? [...currentGrid[day]]
      : Array(24).fill(true);
    const nextVal =
      typeof explicitValue === "boolean" ? explicitValue : !dayArr[hour];
    dayArr[hour] = nextVal;

    const nextSchedule = {
      ...currentGrid,
      [day]: dayArr,
    };

    await onMutateControl({
      action: "update_device",
      clientId: selectedRuleDevice.id,
      weeklySchedule: nextSchedule,
    });
  };

  const handleApplySchedulePreset = async (
    preset: "school" | "weekend" | "allow_all" | "block_evenings"
  ) => {
    if (!selectedRuleDevice || selectedRuleDevice.isAdminProtected) return;
    const nextSchedule: Record<string, boolean[]> = {};
    for (const d of DAYS_ORDER) {
      const isWknd = d === "Sa" || d === "So";
      nextSchedule[d] = Array.from({ length: 24 }, (_, h) => {
        if (preset === "allow_all") return true;
        if (preset === "school") return isWknd ? h >= 8 && h <= 21 : h >= 7 && h <= 19;
        if (preset === "weekend") return h >= 8 && h <= 22;
        return h >= 7 && h <= 17;
      });
    }
    await onMutateControl({
      action: "update_device",
      clientId: selectedRuleDevice.id,
      weeklySchedule: nextSchedule,
    });
  };

  const runLiveRoamingDohSimulation = async (
    device: ClientDeviceProfile,
    testDomain: string
  ) => {
    setRoamingTestResult("Sende verschlüsselte 5G-DoH-Anfrage...");
    try {
      const res = await fetch(
        `/api/dns-query/${encodeURIComponent(
          device.id
        )}?domain=${encodeURIComponent(testDomain)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const allowed = data.Status === 0;
      setRoamingTestResult(
        allowed
          ? `🟢 ERLAUBT via 5G-DoH (${testDomain} -> ${data.Answer?.[0]?.data})`
          : `🔴 BLOCKIERT im 5G/Hotspot-Netz! Grund: ${data.policyResult?.reason} -> Sinkhole Custom Block Page`
      );
      onNotify(
        allowed
          ? `5G-DoH Test (${testDomain}): Erlaubt`
          : `5G-DoH Anti-Bypass griff für ${testDomain}!`
      );
    } catch {
      setRoamingTestResult("Fehler beim DoH-Test.");
    }
  };

  const pendingRequests = unblockRequests.filter((r) => r.status === "pending");

  return (
    <div
      className="space-y-6"
      onMouseUp={() => setIsDraggingSchedule(false)}
    >
      {/* ================================================================= */}
      {/* REAL-TIME UNBLOCK REQUESTS BANNER (FROM CUSTOM BLOCK PAGE)        */}
      {/* ================================================================= */}
      {pendingRequests.length > 0 && (
        <div
          className="rounded-xl p-4 backdrop-blur-xl space-y-3"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.10)",
            border: "1px solid rgba(245, 158, 11, 0.45)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold uppercase">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
              <span>
                Live Freigabe-Anfragen von gesperrten Geräten ({pendingRequests.length})
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-200/80">
              1-Klick Smartphone-Genehmigung
            </span>
          </div>

          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl p-3 bg-black/60 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-white">
                    {req.reason}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    Gerät: <strong className="text-amber-300">{req.clientName}</strong> · Domain:{" "}
                    <code className="text-white">{req.domain}</code> · {req.createdAt}
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onMutateControl({
                        action: "resolve_unblock_request",
                        requestId: req.id,
                        decision: "approve_15",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                  >
                    +15 Min
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onMutateControl({
                        action: "resolve_unblock_request",
                        requestId: req.id,
                        decision: "approve_30",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500 text-black hover:brightness-110"
                  >
                    +30 Min
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onMutateControl({
                        action: "resolve_unblock_request",
                        requestId: req.id,
                        decision: "approve_tomorrow",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
                  >
                    Bis morgen
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onMutateControl({
                        action: "resolve_unblock_request",
                        requestId: req.id,
                        decision: "deny",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-red-400 border border-red-500/30 hover:bg-red-500/15"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* VIEW A: GERÄTE- & PROFIL-MANAGEMENT MIT ROAMING ANTI-BYPASS       */}
      {/* ================================================================= */}
      {mode === "devices" && (
        <>
          {/* Anti-Bypass Global Enforcement Controls */}
          <div
            className="rounded-xl p-5 backdrop-blur-xl space-y-4"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.borderStrong}`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield
                    className="w-4 h-4"
                    style={{ color: theme.colors.accent }}
                  />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Anti-Bypass-Engine: Sperren außerhalb des WLANs (5G / LTE / Hotspot-Schutz)
                  </h2>
                </div>
                <p className="text-xs font-mono text-zinc-400 mt-1">
                  Erzwingt Always-On Encrypted DNS (DoH & DoT über{" "}
                  <code className="text-white">
                    https://{PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/&#123;client_id&#125;
                  </code>
                  ), sodass WLAN-Abschalten oder Mobilfunk-Hotspots keine Sperren umgehen können.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddDevice((s) => !s)}
                className="px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: "#050505",
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Gerät koppeln</span>
              </button>
            </div>

            {/* Two Required Anti-Bypass Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  onMutateControl({
                    action: "update_policy",
                    roamingEnforcement: !policy.roamingEnforcement,
                  })
                }
                className="p-3.5 rounded-xl text-left flex items-center justify-between gap-3 transition-all"
                style={{
                  backgroundColor: policy.roamingEnforcement
                    ? theme.colors.accentMuted
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    policy.roamingEnforcement
                      ? theme.colors.borderStrong
                      : theme.colors.border
                  }`,
                }}
              >
                <div>
                  <div className="text-xs sm:text-sm font-mono font-semibold text-white">
                    [{policy.roamingEnforcement ? "x" : " "}] Unterwegs- & Hotspot-Schutz erzwingen
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Roaming Policy Enforcement via DoH/DoT im 5G/LTE-Netz & fremden WLANs
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase shrink-0"
                  style={{
                    backgroundColor: policy.roamingEnforcement
                      ? theme.colors.accent
                      : "rgba(255,255,255,0.08)",
                    color: policy.roamingEnforcement ? "#050505" : "#A1A1AA",
                  }}
                >
                  {policy.roamingEnforcement ? "ENFORCED" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onMutateControl({
                    action: "update_policy",
                    offlineCacheLock: !policy.offlineCacheLock,
                  })
                }
                className="p-3.5 rounded-xl text-left flex items-center justify-between gap-3 transition-all"
                style={{
                  backgroundColor: policy.offlineCacheLock
                    ? theme.colors.accentMuted
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    policy.offlineCacheLock
                      ? theme.colors.borderStrong
                      : theme.colors.border
                  }`,
                }}
              >
                <div>
                  <div className="text-xs sm:text-sm font-mono font-semibold text-white">
                    [{policy.offlineCacheLock ? "x" : " "}] Letzte Sperren offline cachen & durchsetzen
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    DNS-Cache & Offline-Host-Lock blockiert gesperrte Apps auch bei Verbindungsabbruch
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase shrink-0"
                  style={{
                    backgroundColor: policy.offlineCacheLock
                      ? theme.colors.accent
                      : "rgba(255,255,255,0.08)",
                    color: policy.offlineCacheLock ? "#050505" : "#A1A1AA",
                  }}
                >
                  {policy.offlineCacheLock ? "LOCKED" : "OFF"}
                </span>
              </button>
            </div>

            {/* Add New Device Form */}
            <AnimatePresence>
              {showAddDevice && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onMutateControl({
                      action: "add_device",
                      name: newDevName,
                      ip: newDevIp,
                      mac: newDevMac,
                      role: newDevRole,
                    });
                    setNewDevName("");
                    setShowAddDevice(false);
                  }}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-3 border-t border-white/10"
                >
                  <input
                    type="text"
                    placeholder="Gerätename (z.B. Max iPhone)"
                    value={newDevName}
                    onChange={(e) => setNewDevName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="IP (192.168.178.x)"
                    value={newDevIp}
                    onChange={(e) => setNewDevIp(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="MAC (F0:18:98:...)"
                    value={newDevMac}
                    onChange={(e) => setNewDevMac(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                  />
                  <select
                    value={newDevRole}
                    onChange={(e) =>
                      setNewDevRole(e.target.value as "child" | "guest" | "admin")
                    }
                    className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                  >
                    <option value="child">Kinder-Profil (Roaming + Zeitlimit)</option>
                    <option value="guest">Gast-Gerät</option>
                    <option value="admin">Admin-Whitelist (Unblockierbar)</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg text-xs font-mono font-semibold"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: "#050505",
                    }}
                  >
                    Speichern & Sync
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Device Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((dev) => {
              const isLocked =
                !dev.isAdminProtected &&
                (policy.killSwitchActive ||
                  dev.paused ||
                  policy.bedtimeActive ||
                  dev.bedtimeLocked);
              const budgetTotal = dev.dailyLimitMinutes + dev.bonusMinutesToday;
              const budgetPercent = Math.min(
                100,
                Math.round((dev.usedMinutesToday / Math.max(1, budgetTotal)) * 100)
              );

              return (
                <div
                  key={dev.id}
                  className="rounded-xl p-4 backdrop-blur-xl flex flex-col justify-between space-y-4 transition-all"
                  style={{
                    backgroundColor: theme.colors.bgPanel,
                    border: `1px solid ${
                      isLocked
                        ? "rgba(239, 68, 68, 0.5)"
                        : dev.isAdminProtected
                        ? "rgba(16, 185, 129, 0.4)"
                        : theme.colors.border
                    }`,
                  }}
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon, Inline Rename, Role Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="p-2.5 rounded-xl shrink-0"
                          style={{
                            backgroundColor: theme.colors.accentMuted,
                            border: `1px solid ${theme.colors.borderStrong}`,
                          }}
                        >
                          {renderDeviceIcon(dev.deviceType)}
                        </div>

                        <div className="min-w-0">
                          {editingId === dev.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editNameVal}
                                onChange={(e) => setEditNameVal(e.target.value)}
                                className="px-2 py-1 rounded bg-black border border-white/20 text-xs font-mono text-white w-36"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(dev)}
                                className="p-1 rounded bg-emerald-500 text-black"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-white truncate">
                                {dev.name}
                              </h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(dev.id);
                                  setEditNameVal(dev.name);
                                }}
                                className="text-zinc-500 hover:text-white transition-colors"
                                title="Inline umbenennen (Sync mit AdGuard)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="text-[11px] font-mono text-zinc-400 truncate">
                            {dev.ip} · {dev.ouiVendor}
                          </div>
                        </div>
                      </div>

                      {dev.isAdminProtected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          ADMIN WHITELIST
                        </span>
                      ) : isLocked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">
                          🛑 GESPERRT
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono shrink-0"
                          style={{
                            backgroundColor: theme.colors.accentMuted,
                            color: theme.colors.accent,
                          }}
                        >
                          {dev.connectionType}
                        </span>
                      )}
                    </div>

                    {/* Telemetry & Screen-Time Quota Bar */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">Live-Bandbreite:</span>
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: theme.colors.accent }}
                        >
                          {dev.bandwidthMbps.toFixed(1)} Mbit/s · {dev.lastActiveDomain}
                        </span>
                      </div>

                      {!dev.isAdminProtected && (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400">Tageslimit / Screen-Time:</span>
                            <span className="text-white tabular-nums">
                              {dev.usedMinutesToday} / {budgetTotal} Min ({budgetPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${budgetPercent}%`,
                                backgroundColor:
                                  budgetPercent > 90
                                    ? "#EF4444"
                                    : theme.colors.accent,
                              }}
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/5">
                        <span>Anfragen: {dev.queriesToday.toLocaleString("de-DE")}</span>
                        <span className="text-red-400">
                          Geblockt: {dev.blockedToday.toLocaleString("de-DE")}
                        </span>
                        <span>MAC: {dev.mac}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions: Pause, Bedtime, Roaming Profile Generator */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    {!dev.isAdminProtected ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onMutateControl({
                              action: "update_device",
                              clientId: dev.id,
                              paused: !dev.paused,
                            })
                          }
                          className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
                          style={{
                            backgroundColor: dev.paused
                              ? "rgba(239, 68, 68, 0.2)"
                              : "rgba(255,255,255,0.04)",
                            color: dev.paused ? "#F87171" : "#E4E4E7",
                            border: `1px solid ${
                              dev.paused
                                ? "rgba(239, 68, 68, 0.45)"
                                : theme.colors.border
                            }`,
                          }}
                        >
                          {dev.paused ? (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Freigeben</span>
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>Sperren</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onMutateControl({
                              action: "update_device",
                              clientId: dev.id,
                              bedtimeLocked: !dev.bedtimeLocked,
                            })
                          }
                          className="py-1.5 px-2.5 rounded-lg text-xs font-mono flex items-center gap-1 transition-all"
                          style={{
                            backgroundColor: dev.bedtimeLocked
                              ? "rgba(168, 85, 247, 0.2)"
                              : "rgba(255,255,255,0.04)",
                            color: dev.bedtimeLocked ? "#C084FC" : "#A1A1AA",
                            border: `1px solid ${theme.colors.border}`,
                          }}
                          title="Schlafenszeit für dieses Gerät erzwingen"
                        >
                          <Moon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-400">
                        ✓ Geschütztes Admin-/Server-System
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setRoamingModalDevice(dev);
                        setRoamingTestResult(null);
                      }}
                      className="py-1.5 px-3 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all hover:brightness-110"
                      style={{
                        backgroundColor: theme.colors.accentMuted,
                        color: theme.colors.accent,
                        border: `1px solid ${theme.colors.borderStrong}`,
                      }}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>5G / DoH Profil</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Bandwidth Radar & Blocked Roaming Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Live Bandwidth Radar */}
            <div
              className="rounded-xl p-5 backdrop-blur-xl space-y-3"
              style={{
                backgroundColor: theme.colors.bgPanel,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity
                    className="w-4 h-4"
                    style={{ color: theme.colors.accent }}
                  />
                  <h3 className="text-sm font-semibold text-white">
                    Live-Bandbreiten-Radar (Echtzeit-Auslastung)
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  Gesamt:{" "}
                  {devices
                    .reduce((acc, d) => acc + d.bandwidthMbps, 0)
                    .toFixed(1)}{" "}
                  Mbit/s
                </span>
              </div>

              <div className="space-y-2.5">
                {[...devices]
                  .sort((a, b) => b.bandwidthMbps - a.bandwidthMbps)
                  .map((d) => {
                    const maxBw = 60;
                    const pct = Math.min(100, Math.round((d.bandwidthMbps / maxBw) * 100));
                    return (
                      <div key={d.id} className="space-y-1 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-white">
                            {d.name}{" "}
                            <span className="text-zinc-500">({d.lastActiveDomain})</span>
                          </span>
                          <span
                            className="font-bold tabular-nums"
                            style={{ color: theme.colors.accent }}
                          >
                            {d.bandwidthMbps.toFixed(1)} Mbit/s
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: theme.colors.accent,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Live Roaming & WLAN Blocked Stream */}
            <div
              className="rounded-xl p-5 backdrop-blur-xl space-y-3"
              style={{
                backgroundColor: theme.colors.bgPanel,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white">
                    Abgewehrte Bypass- & Roaming-Anfragen
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  5G DoH · Hotspot DoT · WLAN
                </span>
              </div>

              <div className="space-y-2">
                {blockedStream.slice(0, 6).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-lg bg-black/50 border border-red-500/20 flex items-center justify-between gap-2 font-mono text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold">{ev.domain}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">
                          {ev.appCategory}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {ev.clientName} · {ev.transport} · {ev.timestamp}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-amber-300 shrink-0">
                      {ev.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* VIEW B: ZEITPLÄNE (24/7 GRID), TAGESKONTINGENTE & 1-KLICK APPS    */}
      {/* ================================================================= */}
      {mode === "rules" && selectedRuleDevice && (
        <div className="space-y-5">
          {/* Device Picker Bar */}
          <div
            className="rounded-xl p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3"
            style={{
              backgroundColor: theme.colors.bgPanel,
              border: `1px solid ${theme.colors.borderStrong}`,
            }}
          >
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Zeitpläne, Tageskontingente & 1-Klick App-Sperren
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                Wähle ein Gerät/Profil zur feingranularen Steuerung (gilt im WLAN & via 5G/Hotspot-DoH):
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {devices.map((d) => {
                const active = d.id === selectedRuleDevice.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedRuleDeviceId(d.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
                    style={{
                      backgroundColor: active
                        ? theme.colors.accent
                        : "rgba(255,255,255,0.04)",
                      color: active ? "#050505" : "#E4E4E7",
                    }}
                  >
                    <span>{d.name}</span>
                    {d.isAdminProtected && <Lock className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRuleDevice.isAdminProtected ? (
            <div className="rounded-xl p-6 bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs text-emerald-300 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">
                  Admin-Schutz (Whitelist) aktiv für {selectedRuleDevice.name}
                </div>
                <p className="mt-1">
                  Dieses Gerät ist als Admin-/Server-System geschützt und hat 24/7 unbegrenzten Zugriff ohne App-Sperren. Wähle oben ein Kinder- oder Gastgerät (z. B. Jonas iPhone 15 oder Lena iPad Air), um Zeitlimits und Sperren zu bearbeiten.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Row 1: Daily Screen-Time Budget Slider & 1-Click App Blocks */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Daily Time Limit Card */}
                <div
                  className="lg:col-span-5 rounded-xl p-5 backdrop-blur-xl space-y-4"
                  style={{
                    backgroundColor: theme.colors.bgPanel,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock
                        className="w-4 h-4"
                        style={{ color: theme.colors.accent }}
                      />
                      <h3 className="text-sm font-semibold text-white">
                        Tägliches Zeitlimit (Screen-Time Budget)
                      </h3>
                    </div>
                    <span
                      className="text-sm font-mono font-bold tabular-nums"
                      style={{ color: theme.colors.accent }}
                    >
                      {Math.floor(selectedRuleDevice.dailyLimitMinutes / 60)}h{" "}
                      {selectedRuleDevice.dailyLimitMinutes % 60}m / Tag
                    </span>
                  </div>

                  <input
                    type="range"
                    min={15}
                    max={480}
                    step={15}
                    value={selectedRuleDevice.dailyLimitMinutes}
                    onChange={(e) =>
                      onMutateControl({
                        action: "update_device",
                        clientId: selectedRuleDevice.id,
                        dailyLimitMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>15 Min</span>
                    <span>1 Std</span>
                    <span>2 Std</span>
                    <span>4 Std</span>
                    <span>8 Std</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 font-mono text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Heute verbraucht:</span>
                      <span className="text-white font-bold">
                        {selectedRuleDevice.usedMinutesToday} Minuten
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Bonus-Freigaben heute:</span>
                      <span className="text-emerald-400 font-bold">
                        +{selectedRuleDevice.bonusMinutesToday} Minuten
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Verbleibend:</span>
                      <span style={{ color: theme.colors.accent }}>
                        {Math.max(
                          0,
                          selectedRuleDevice.dailyLimitMinutes +
                            selectedRuleDevice.bonusMinutesToday -
                            selectedRuleDevice.usedMinutesToday
                        )}{" "}
                        Minuten
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1-Click App Blocks Card */}
                <div
                  className="lg:col-span-7 rounded-xl p-5 backdrop-blur-xl space-y-4"
                  style={{
                    backgroundColor: theme.colors.bgPanel,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      1-Klick App- & Plattform-Sperren für {selectedRuleDevice.name}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">
                      Direkte Synchronisation mit AdGuard Home & dem Roaming-DoH-Filter
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {BLOCKABLE_APPS.map((app) => {
                      const isBlocked = selectedRuleDevice.blockedApps.includes(
                        app.id
                      ) || (app.id === "fortnite" && selectedRuleDevice.blockedApps.includes("epic_games"));

                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => {
                            const exists =
                              selectedRuleDevice.blockedApps.includes(app.id);
                            const nextApps = exists
                              ? selectedRuleDevice.blockedApps.filter(
                                  (x) => x !== app.id
                                )
                              : [...selectedRuleDevice.blockedApps, app.id];
                            onMutateControl({
                              action: "update_device",
                              clientId: selectedRuleDevice.id,
                              blockedApps: nextApps,
                            });
                          }}
                          className="p-3 rounded-xl text-left transition-all flex flex-col justify-between"
                          style={{
                            backgroundColor: isBlocked
                              ? "rgba(239, 68, 68, 0.16)"
                              : "rgba(255,255,255,0.03)",
                            border: `1px solid ${
                              isBlocked
                                ? "rgba(239, 68, 68, 0.45)"
                                : theme.colors.border
                            }`,
                          }}
                        >
                          <div className="text-xs font-bold text-white">
                            {app.name}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            {app.category}
                          </div>
                          <div className="mt-2 text-[10px] font-mono font-bold">
                            {isBlocked ? (
                              <span className="text-red-400">🔴 GESPERRT</span>
                            ) : (
                              <span className="text-emerald-400">🟢 ERLAUBT</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: 24/7 Weekly Schedule Matrix (Drag/Click to Select) */}
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
                      24/7 Wochenraster (Drag-to-Select Internet-Zeitplan)
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">
                      Klicke oder ziehe über die Stundenblöcke: 🟢 Erlaubt · 🔴 Gesperrt (Schlafens-/Lernzeit)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplySchedulePreset("school")}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10"
                    >
                      Schulwoche (07–20h)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySchedulePreset("block_evenings")}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10"
                    >
                      Streng (07–18h)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySchedulePreset("allow_all")}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10"
                    >
                      24/7 Freigeben
                    </button>
                  </div>
                </div>

                {/* 7x24 Matrix */}
                <div className="overflow-x-auto pb-2 select-none">
                  <div className="min-w-[680px] space-y-1.5 font-mono text-[10px]">
                    {/* Hours Header */}
                    <div className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-1 text-zinc-400 text-center">
                      <div>Tag</div>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h}>{String(h).padStart(2, "0")}</div>
                      ))}
                    </div>

                    {/* 7 Day Rows */}
                    {DAYS_ORDER.map((day) => {
                      const hours =
                        selectedRuleDevice.weeklySchedule?.[day] ||
                        Array(24).fill(true);
                      return (
                        <div
                          key={day}
                          className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-1 items-center"
                        >
                          <div className="font-bold text-xs text-white">
                            {day}
                          </div>
                          {hours.map((allowed, h) => (
                            <button
                              key={h}
                              type="button"
                              onMouseDown={() => {
                                setIsDraggingSchedule(true);
                                setDragTargetValue(!allowed);
                                handleScheduleCellToggle(day, h, !allowed);
                              }}
                              onMouseEnter={() => {
                                if (isDraggingSchedule) {
                                  handleScheduleCellToggle(
                                    day,
                                    h,
                                    dragTargetValue
                                  );
                                }
                              }}
                              className="h-6 rounded transition-colors"
                              style={{
                                backgroundColor: allowed
                                  ? theme.colors.accentMuted
                                  : "rgba(239, 68, 68, 0.22)",
                                border: `1px solid ${
                                  allowed
                                    ? theme.colors.borderStrong
                                    : "rgba(239, 68, 68, 0.45)"
                                }`,
                              }}
                              title={`${day} ${String(h).padStart(2, "0")}:00 - ${
                                allowed ? "Erlaubt" : "Gesperrt"
                              }`}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ROAMING ANTI-BYPASS DNS PROFILE (.mobileconfig & QR)       */}
      {/* ================================================================= */}
      <AnimatePresence>
        {roamingModalDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-2xl rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
              style={{
                backgroundColor: "#08080C",
                border: `1px solid ${theme.colors.borderStrong}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
                    style={{
                      backgroundColor: theme.colors.accentMuted,
                      color: theme.colors.accent,
                    }}
                  >
                    ALWAYS-ON ENCRYPTED DNS PROFILE
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                    5G / LTE & Hotspot Anti-Bypass für {roamingModalDevice.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRoamingModalDevice(null)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 text-zinc-400 hover:text-white"
                >
                  Schließen ✕
                </button>
              </div>

              {/* Unremovable Switch */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono font-bold text-white">
                    Profil als „Unremovable / Always-On“ sperren (PayloadRemovalDisallowed)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Verhindert, dass das Kind das DNS-Profil in den iOS/iPadOS-Einstellungen ohne Admin-Code löschen kann.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !roamingModalDevice.unremovableProfile;
                    setRoamingModalDevice({
                      ...roamingModalDevice,
                      unremovableProfile: nextVal,
                    });
                    await onMutateControl({
                      action: "update_device",
                      clientId: roamingModalDevice.id,
                      unremovableProfile: nextVal,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold"
                  style={{
                    backgroundColor: roamingModalDevice.unremovableProfile
                      ? theme.colors.accent
                      : "rgba(255,255,255,0.08)",
                    color: roamingModalDevice.unremovableProfile
                      ? "#050505"
                      : "#A1A1AA",
                  }}
                >
                  {roamingModalDevice.unremovableProfile
                    ? "UNREMOVABLE: EIN"
                    : "UNREMOVABLE: AUS"}
                </button>
              </div>

              {/* Platform Cards: iOS/macOS, Android, Windows/Linux */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Apple iOS / iPadOS / macOS .mobileconfig */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <div className="text-xs font-mono font-bold text-white">
                    🍎 Apple iOS / iPadOS / macOS
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Signiertes Apple Configuration Profile (<code className="text-white">.mobileconfig</code>) mit Cellular + Wi-Fi OnDemand-Regeln:
                  </p>
                  <div className="text-[11px] font-mono p-2 rounded bg-white/5 text-zinc-300 break-all">
                    https://{PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/{roamingModalDevice.id}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`/api/profiles/${encodeURIComponent(
                        roamingModalDevice.id
                      )}/mobileconfig?proto=doh`}
                      download
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: theme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DoH .mobileconfig</span>
                    </a>
                    <a
                      href={`/api/profiles/${encodeURIComponent(
                        roamingModalDevice.id
                      )}/mobileconfig?proto=dot`}
                      download
                      className="py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border border-white/15 text-white hover:bg-white/5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DoT</span>
                    </a>
                  </div>
                </div>

                {/* Android Private DNS & SVG QR Code */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">
                      🤖 Android 9+ („Privates DNS“) & QR-Code
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Einstellungen ➔ Netzwerk & Internet ➔ Privates DNS ➔ Hostname:
                    </p>
                    <div
                      className="mt-2 text-xs font-mono font-bold p-2 rounded bg-white/5 break-all"
                      style={{ color: theme.colors.accent }}
                    >
                      {roamingModalDevice.id}.dot.labtoso.de
                    </div>
                  </div>

                  {/* Deterministic SVG QR Code */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="p-2 rounded-lg bg-white inline-block shrink-0">
                      <svg width="72" height="72" viewBox="0 0 21 21">
                        {generateDeterministicQrMatrix(
                          `https://${PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/${roamingModalDevice.id}`
                        ).map((row, y) =>
                          row.map((cell, x) =>
                            cell ? (
                              <rect
                                key={`${x}-${y}`}
                                x={x}
                                y={y}
                                width={1}
                                height={1}
                                fill="#050505"
                              />
                            ) : null
                          )
                        )}
                      </svg>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      Kamera scannen für 1-Klick Profil-Download auf dem Smartphone.
                    </div>
                  </div>
                </div>
              </div>

              {/* Live 5G Roaming Anti-Bypass Simulator */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5">
                <div className="text-xs font-mono font-bold text-white">
                  ⚡ Live-Test: 5G / Hotspot Roaming-Anfrage simulieren
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      runLiveRoamingDohSimulation(
                        roamingModalDevice,
                        "tiktok.com"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  >
                    Test: tiktok.com (über 5G DoH)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runLiveRoamingDohSimulation(
                        roamingModalDevice,
                        "roblox.com"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  >
                    Test: roblox.com (über 5G DoH)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runLiveRoamingDohSimulation(
                        roamingModalDevice,
                        "wikipedia.org"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                  >
                    Test: wikipedia.org (Erlaubt)
                  </button>
                </div>
                {roamingTestResult && (
                  <div className="p-2.5 rounded-lg bg-black/70 border border-white/10 text-xs font-mono text-white">
                    {roamingTestResult}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
