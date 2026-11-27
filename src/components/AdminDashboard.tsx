"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Cpu,
  ExternalLink,
  Globe,
  HardDrive,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Lock,
  Moon,
  Music,
  Network,
  OctagonAlert,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Router,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  Wand2,
  Wifi,
  Zap,
} from "lucide-react";
import CanvasBackdrop from "@/components/CanvasBackdrop";
import AdGuardMirrorSuite from "@/components/AdGuardMirrorSuite";
import DeviceAndRulesSuite from "@/components/DeviceAndRulesSuite";
import {
  BlockPageStudio,
  SetupWizardModal,
} from "@/components/BlockStudioAndWizard";
import {
  DEFAULT_THEME,
  THEME_LIST,
  THEME_STORAGE_KEY,
  THEMES,
  ThemeId,
} from "@/lib/themes";
import {
  DEFAULT_QUICK_LINKS,
  DEFAULT_SERVICES,
  QuickLinkItem,
  ServiceMonitorItem,
} from "@/lib/infrastructure";
import { ALLOWED_OWNER_EMAIL, PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";
import { INITIAL_STATE, NetworkControlState } from "@/lib/network-state";

interface SystemTelemetry {
  nodeVersion: string;
  v8Version: string;
  npmVersion: string;
  platform: string;
  arch: string;
  pid: number;
  hostname: string;
  uptimeSeconds: number;
  processUptimeSeconds: number;
  cpuModel: string;
  cpuCores: number;
  cpuLoadPercent: number;
  loadAvg: [number, number, number];
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    hostUsedGb: number;
    hostTotalGb: number;
    hostPercent: number;
  };
  network: {
    localIp: string;
    tailscaleIp: string;
    tailscaleStatus: "Connected" | "Standby";
    cloudflareDomain: string;
    cloudflareStatus: "Active (QUIC)" | "Standby";
  };
  git: {
    branch: string;
    commit: string;
    repo: string;
  };
  auth: {
    authenticated: boolean;
    email: string;
    provider: string;
    accessVector: string;
    cfRay: string | null;
    clientIp: string;
    strictPolicy: boolean;
  };
}

export type MainNavTab =
  | "dashboard"
  | "adguard"
  | "devices"
  | "rules"
  | "studio"
  | "settings";

const QUICK_LINKS_STORAGE_KEY = "labtoso-network-bookmarks-v1";

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0)
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState<MainNavTab>("dashboard");
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const [canvasPaused, setCanvasPaused] = useState(false);
  const [fps, setFps] = useState(60);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [authPopoverOpen, setAuthPopoverOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Control Suite & AdGuard 1:1 State
  const [controlState, setControlState] =
    useState<NetworkControlState>(INITIAL_STATE);

  // Telemetry & Services state
  const [telemetry, setTelemetry] = useState<SystemTelemetry>({
    nodeVersion: "v22.13.0",
    v8Version: "12.4.254.21",
    npmVersion: "10.9.2",
    platform: "linux (Debian 12 LXC)",
    arch: "x64",
    pid: 1042,
    hostname: "network-admin",
    uptimeSeconds: 1239420,
    processUptimeSeconds: 431200,
    cpuModel: "Proxmox Virtual CPU (x86_64)",
    cpuCores: 4,
    cpuLoadPercent: 12.4,
    loadAvg: [0.24, 0.19, 0.15],
    memory: {
      heapUsedMb: 58.4,
      heapTotalMb: 96.0,
      rssMb: 112.6,
      hostUsedGb: 1.84,
      hostTotalGb: 7.69,
      hostPercent: 23.9,
    },
    network: {
      localIp: "192.168.178.67",
      tailscaleIp: "100.94.18.42",
      tailscaleStatus: "Connected",
      cloudflareDomain: PUBLIC_ZERO_TRUST_DOMAIN,
      cloudflareStatus: "Active (QUIC)",
    },
    git: {
      branch: "main",
      commit: "f8a4c21",
      repo: "Labtoso/Network",
    },
    auth: {
      authenticated: true,
      email: ALLOWED_OWNER_EMAIL,
      provider: "Cloudflare Access (Google OAuth)",
      accessVector: `Zero-Trust Tunnel (${PUBLIC_ZERO_TRUST_DOMAIN})`,
      cfRay: "8e94c10a9ff2fra",
      clientIp: "192.168.178.24",
      strictPolicy: true,
    },
  });

  const [services, setServices] =
    useState<ServiceMonitorItem[]>(DEFAULT_SERVICES);
  const [serviceFilter, setServiceFilter] = useState<
    "all" | "docker" | "bot" | "system"
  >("all");
  const [expandedServiceLogs, setExpandedServiceLogs] = useState<
    Record<string, boolean>
  >({
    "network-admin": true,
    "msik-bot": true,
  });
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Links / Bookmarks state
  const [quickLinks, setQuickLinks] =
    useState<QuickLinkItem[]>(DEFAULT_QUICK_LINKS);
  const [bookmarkFilter, setBookmarkFilter] = useState<string>("all");
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [newBookmark, setNewBookmark] = useState({
    title: "",
    subtitle: "",
    url: "https://",
    lanIp: "192.168.178.",
    badge: "CUSTOM // NODE",
  });

  // Live Terminal / Management CLI Viewer
  const [activeCliCmd, setActiveCliCmd] = useState<
    "info" | "status" | "logs" | "install" | "update" | "proxmox"
  >("info");
  const [installerOsTab, setInstallerOsTab] = useState<"proxmox" | "linux" | "win">("proxmox");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([
    "[22:30:01] [ZERO-TRUST] Policy verified: Cf-Access-Authenticated-User-Email = sebirauch2022@gmail.com",
    "[22:30:02] [CLOUDFLARED] QUIC mux tunnel active -> fra06.cloudflare.net (14ms)",
    "[22:30:04] [TAILSCALE] Peer 100.94.18.42 online via WireGuard direct UDP/41641",
    "[22:30:06] [ADGUARD] DNS sinkhole 192.168.178.67:53 healthy (HaGeZi Multi PRO + NSFW active)",
    "[22:30:09] [BOT:MSIK] CT 102 /health 200 OK · Native Opus · 4MB PCM pipeline idle",
    "[22:30:11] [BOT:AIO] CT 102 /health 200 OK · 17 modules loaded · /aio session secret verified",
    "[22:30:14] [STREYN] Rust audio server musik.labtoso.de v1.26.7 online (16ms)",
  ]);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  // Load Theme & Bookmarks from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES[saved]) {
        setThemeId(saved);
      }
      const savedLinks = localStorage.getItem(QUICK_LINKS_STORAGE_KEY);
      if (savedLinks) {
        const parsed = JSON.parse(savedLinks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickLinks(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const t = THEMES[themeId] || THEMES[DEFAULT_THEME];
    const root = document.documentElement;
    root.style.setProperty("--bg-base", t.colors.bgBase);
    root.style.setProperty("--bg-panel", t.colors.bgPanel);
    root.style.setProperty("--bg-panel-hover", t.colors.bgPanelHover);
    root.style.setProperty("--border-color", t.colors.border);
    root.style.setProperty("--border-strong", t.colors.borderStrong);
    root.style.setProperty("--accent", t.colors.accent);
    root.style.setProperty("--accent-secondary", t.colors.accentSecondary);
    root.style.setProperty("--accent-muted", t.colors.accentMuted);
    root.style.setProperty("--text-primary", t.colors.textPrimary);
    root.style.setProperty("--text-secondary", t.colors.textSecondary);
    root.style.setProperty("--text-muted", t.colors.textMuted);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // ignore
    }
  }, [themeId]);

  // Keyboard shortcuts 1-5 for rapid theme switching
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const match = THEME_LIST.find((t) => t.shortcut === e.key);
      if (match) {
        setThemeId(match.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [sysRes, srvRes, logRes, ctrlRes] = await Promise.all([
        fetch("/api/system", { cache: "no-store" }),
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/logs", { cache: "no-store" }),
        fetch("/api/control", { cache: "no-store" }),
      ]);
      if (sysRes.ok) {
        const sysData = await sysRes.json();
        setTelemetry((prev) => ({ ...prev, ...sysData }));
      }
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (Array.isArray(srvData.services)) {
          setServices(srvData.services);
        }
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        if (Array.isArray(logData.logs) && logData.logs.length > 0) {
          setLiveLogs(logData.logs);
        }
      }
      if (ctrlRes.ok) {
        const ctrlData = await ctrlRes.json();
        if (ctrlData?.policy && Array.isArray(ctrlData?.devices)) {
          setControlState(ctrlData);
          try {
            const localDone =
              localStorage.getItem("labtoso-setup-completed") === "true";
            if (!ctrlData.policy.onboardingCompleted && !localDone) {
              setWizardOpen(true);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Fallback smoothly
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 12000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleMutateControl = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setControlState(data.state);
        if (data.toast) showToast(data.toast);
        return true;
      }
      showToast("Die Änderung konnte nicht gespeichert werden.");
    } catch {
      showToast("Fehler beim Speichern der Änderung.");
    }
    return false;
  };

  const handleMutateAdGuard = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/adguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setControlState((prev) => ({
          ...prev,
          adguard: data.adguard || prev.adguard,
          devices: data.devices || prev.devices,
        }));
        if (data.toast) showToast(data.toast);
      }
    } catch {
      showToast("AdGuard Sync-Fehler.");
    }
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    showToast("In die Zwischenablage kopiert!");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePingService = async (service: ServiceMonitorItem) => {
    setPingingId(service.id);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: service.id, endpoint: service.endpoint }),
      });
      if (res.ok) {
        const data = await res.json();
        setServices((prev) =>
          prev.map((item) =>
            item.id === service.id
              ? {
                  ...item,
                  pingMs: data.pingMs ?? item.pingMs,
                  status: data.status ?? item.status,
                  logs: [
                    `[${new Date().toLocaleTimeString("de-DE")}] Live probe to ${
                      service.endpoint
                    } -> ${data.pingMs ?? item.pingMs}ms (${(
                      data.status || "online"
                    ).toUpperCase()})`,
                    ...item.logs.slice(0, 4),
                  ],
                }
              : item
          )
        );
      }
    } finally {
      setTimeout(() => setPingingId(null), 350);
    }
  };

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmark.title.trim() || !newBookmark.url.trim()) return;
    const item: QuickLinkItem = {
      id: `custom-${Date.now()}`,
      title: newBookmark.title.trim(),
      subtitle: newBookmark.subtitle.trim() || "Benutzerdefinierter Endpunkt",
      url: newBookmark.url.trim(),
      lanIp: newBookmark.lanIp.trim() || "LAN / VPN",
      category: "core",
      iconName: "Server",
      badge: newBookmark.badge.trim() || "NODE",
    };
    const updated = [...quickLinks, item];
    setQuickLinks(updated);
    try {
      localStorage.setItem(QUICK_LINKS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewBookmark({
      title: "",
      subtitle: "",
      url: "https://",
      lanIp: "192.168.178.",
      badge: "CUSTOM // NODE",
    });
    setShowAddBookmark(false);
    showToast(`Bookmark "${item.title}" hinzugefügt.`);
  };

  const handleDeleteBookmark = (id: string) => {
    const updated = quickLinks.filter((q) => q.id !== id);
    setQuickLinks(updated);
    try {
      localStorage.setItem(QUICK_LINKS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const renderQuickLinkIcon = (iconName: QuickLinkItem["iconName"]) => {
    const props = {
      className:
        "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
      style: { color: currentTheme.colors.accent },
    };
    switch (iconName) {
      case "Server":
        return <Server {...props} />;
      case "ShieldCheck":
        return <ShieldCheck {...props} />;
      case "Router":
        return <Router {...props} />;
      case "Globe":
        return <Globe {...props} />;
      case "Cpu":
        return <Cpu {...props} />;
      case "Bot":
        return <Bot {...props} />;
      case "Music":
        return <Music {...props} />;
      case "Lock":
        return <Lock {...props} />;
      case "Network":
        return <Network {...props} />;
      case "HardDrive":
        return <HardDrive {...props} />;
      default:
        return <Server {...props} />;
    }
  };

  const filteredServices =
    serviceFilter === "all"
      ? services
      : services.filter((s) => s.category === serviceFilter);

  const filteredBookmarks =
    bookmarkFilter === "all"
      ? quickLinks
      : quickLinks.filter((q) => q.category === bookmarkFilter);

  const onlineServicesCount = services.filter(
    (s) => s.status === "online"
  ).length;
  const avgLatencyMs = Math.round(
    services.reduce((acc, s) => acc + s.pingMs, 0) /
      Math.max(1, services.length)
  );
  const pendingUnblockCount = controlState.unblockRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const cliOutputMap: Record<
    typeof activeCliCmd,
    { command: string; output: string[] }
  > = {
    info: {
      command: "./manage.sh info",
      output: [
        `┌──────────────────────────────────────────────────────────────────────┐`,
        `│ LABTOSO NETWORK CONTROL SUITE · SYSTEM & ZERO-TRUST TELEMETRY        │`,
        `├──────────────────────────────────────────────────────────────────────┤`,
        `│ Node.js Runtime : ${telemetry.nodeVersion} (V8 ${telemetry.v8Version}) · npm ${telemetry.npmVersion}`,
        `│ Service Status  : ACTIVE (PID ${telemetry.pid}) · Uptime ${formatDuration(
          telemetry.processUptimeSeconds
        )}`,
        `│ Resource Load   : CPU ${telemetry.cpuLoadPercent.toFixed(1)}% (${
          telemetry.cpuCores
        } Cores) · Heap ${telemetry.memory.heapUsedMb.toFixed(
          1
        )}/${telemetry.memory.heapTotalMb.toFixed(0)} MB`,
        `│ Local Network   : ${telemetry.network.localIp}:3000 (Proxmox LXC / ZimaOS Bridge)`,
        `│ Tailscale VPN   : ${telemetry.network.tailscaleIp} (${telemetry.network.tailscaleStatus} · MagicDNS enabled)`,
        `│ Cloudflare ZT   : https://${telemetry.network.cloudflareDomain} (${telemetry.network.cloudflareStatus})`,
        `│ AdGuard 1:1     : ${controlState.policy.adguardUrl} (${controlState.policy.adguardVersion})`,
        `│ Roaming DoH/DoT : ENFORCED (https://${PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/{id})`,
        `│ Access Policy   : Hard-Locked -> ${telemetry.auth.email}`,
        `│ Git Repository  : ${telemetry.git.repo} (${telemetry.git.branch} @ ${telemetry.git.commit})`,
        `└──────────────────────────────────────────────────────────────────────┘`,
      ],
    },
    status: {
      command: "./manage.sh status",
      output: [
        `● network-admin.service - Labtoso Zero-Trust Network & AdGuard 1:1 Control Suite`,
        `     Loaded: loaded (/etc/systemd/system/network-admin.service; enabled; preset: enabled)`,
        `     Active: active (running) since ${new Date(
          Date.now() - telemetry.processUptimeSeconds * 1000
        ).toISOString()}`,
        `   Main PID: ${telemetry.pid} (node)`,
        `     Memory: ${telemetry.memory.rssMb.toFixed(
          1
        )}M (Heap: ${telemetry.memory.heapUsedMb.toFixed(1)}M)`,
        `        CPU: ${telemetry.cpuLoadPercent.toFixed(1)}%`,
        `     Tunnel: cloudflared.service -> active (admin.labtoso.de QUIC)`,
        `  Tailscale: tailscaled.service -> active (${telemetry.network.tailscaleIp})`,
        `    Root-CA: /opt/network/certs/labtoso-root-ca.crt (Valid · TLS 1.3 Sinkhole)`,
      ],
    },
    logs: {
      command: "./manage.sh logs",
      output: liveLogs,
    },
    install: {
      command: "./manage.sh install",
      output: [
        `==> [1/6] Checking System Packages (curl, wget, git, jq, openssl, ca-certificates, tailscale, iptables)...`,
        `    ✓ System tools verified`,
        `==> [2/6] Checking Runtime Environment (Node.js ${telemetry.nodeVersion}, npm ${telemetry.npmVersion}, pnpm, Docker)...`,
        `    ✓ Node.js LTS & Docker Compose ready`,
        `==> [3/6] Generating Local Root-CA (openssl) for Custom HTTPS Block Page...`,
        `    ✓ Root-CA written to certs/labtoso-root-ca.crt`,
        `==> [4/6] Installing npm dependencies & initializing SQLite via Prisma (prisma db push)...`,
        `    ✓ SQLite schema synced (DeviceProfile, BlockPageConfig, UnblockRequest)`,
        `==> [5/6] Building Next.js standalone production bundle...`,
        `    ✓ Compiled App Router, Roaming DoH Resolver & AdGuard 1:1 Mirror`,
        `==> [6/6] Starting systemd service (network-admin.service) & cloudflared...`,
        `    ✓ Online at https://${PUBLIC_ZERO_TRUST_DOMAIN} & http://${telemetry.network.tailscaleIp}:3000`,
      ],
    },
    update: {
      command: "./manage.sh update",
      output: [
        `==> Pulling latest changes from https://github.com/Labtoso/Network.git (main)...`,
        `    ✓ Fast-forwarded to commit ${telemetry.git.commit}`,
        `==> Running prisma db push & rebuilding standalone output...`,
        `    ✓ Build succeeded with zero errors`,
        `==> Performing zero-downtime restart of network-admin.service...`,
        `    ✓ Service restarted cleanly (PID ${telemetry.pid})`,
      ],
    },
    proxmox: {
      command: `bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"`,
      output: [
        `✓ Proxmox VE Host detected · Creating Debian 12 LXC (unprivileged, nesting=1)`,
        `✓ Installed curl, wget, git, jq, openssl, iptables, Node.js 22 LTS, pnpm, Docker & Tailscale`,
        `✓ Generated Root-CA certificate & configured Cloudflare Zero-Trust Tunnel Token`,
        `✓ Cloned Labtoso/Network to /opt/network & executed ./manage.sh install`,
        `✓ Panel live at https://admin.labtoso.de (Protected for sebirauch2022@gmail.com)`,
      ],
    },
  };

  const navItems: {
    id: MainNavTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      shortLabel: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "adguard",
      label: "AdGuard 1:1 Mirror",
      shortLabel: "AdGuard",
      icon: ShieldCheck,
      badge: "LIVE",
    },
    {
      id: "devices",
      label: "Geräte & 5G-Roaming",
      shortLabel: "Geräte",
      icon: Smartphone,
      badge: pendingUnblockCount > 0 ? pendingUnblockCount : undefined,
    },
    {
      id: "rules",
      label: "Regeln & 24/7 Zeitplan",
      shortLabel: "Regeln",
      icon: Sliders,
    },
    {
      id: "studio",
      label: "Block-Page Studio",
      shortLabel: "Studio",
      icon: LayoutTemplate,
    },
    {
      id: "settings",
      label: "CLI & Settings",
      shortLabel: "Settings",
      icon: Settings,
    },
  ];

  return (
    <div
      className={`relative min-h-screen w-full pb-24 lg:pb-10 transition-colors duration-500 ${
        currentTheme.scanlines ? "scanlines" : ""
      }`}
      style={{
        backgroundColor: currentTheme.colors.bgBase,
        color: currentTheme.colors.textPrimary,
      }}
    >
      {/* Interactive 60-FPS HTML5 Canvas Live Art Backdrop */}
      <CanvasBackdrop
        theme={themeId}
        paused={canvasPaused}
        onFpsUpdate={setFps}
      />

      {/* Subtle Radial Vignette */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, transparent 0%, rgba(5, 5, 5, 0.55) 75%, rgba(5, 5, 5, 0.88) 100%)",
        }}
      />

      {/* Toast Notification Pill */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-2xl"
            style={{
              backgroundColor: "#08080D",
              border: `1.5px solid ${currentTheme.colors.accent}`,
              color: "#FFFFFF",
              boxShadow: `0 0 25px ${currentTheme.colors.accentMuted}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: currentTheme.colors.accent }}
            />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Setup Wizard Modal */}
      <SetupWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        themeId={themeId}
        onSelectTheme={setThemeId}
        policy={controlState.policy}
        devices={controlState.devices}
        onMutateControl={handleMutateControl}
        onAdGuardPaired={(policy) => setControlState((state) => ({ ...state, policy }))}
      />

      {/* Foreground Content Layer */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-5">
        {/* ================================================================= */}
        {/* TOP COMMAND HEADER BAR                                            */}
        {/* ================================================================= */}
        <header
          className="rounded-xl backdrop-blur-xl transition-all duration-300 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3.5"
          style={{
            backgroundColor: currentTheme.colors.bgPanel,
            border: `1px solid ${currentTheme.colors.border}`,
          }}
        >
          {/* Left: Brand & Live Tunnel Pill */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm tracking-tighter relative overflow-hidden"
              style={{
                backgroundColor: currentTheme.colors.accentMuted,
                border: `1px solid ${currentTheme.colors.borderStrong}`,
                color: currentTheme.colors.accent,
              }}
            >
              <span>LT</span>
              <span
                className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: currentTheme.colors.accent }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                  LABTOSO{" "}
                  <span className="font-mono font-normal opacity-50">//</span>{" "}
                  NETWORK
                </h1>
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono uppercase tracking-wider"
                  style={{
                    backgroundColor: currentTheme.colors.accentMuted,
                    color: currentTheme.colors.accent,
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-ping"
                    style={{ backgroundColor: currentTheme.colors.accent }}
                  />
                  {PUBLIC_ZERO_TRUST_DOMAIN}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
                <span>Zero-Trust · AdGuard 1:1 · 5G Anti-Bypass</span>
                <span className="opacity-40">•</span>
                <span
                  className="tabular-nums"
                  style={{ color: currentTheme.colors.accent }}
                >
                  {canvasPaused ? "CANVAS PAUSED" : `${fps} FPS`}
                </span>
              </p>
            </div>
          </div>

          {/* Right Controls: Emergency Quick-Actions, Wizard, Theme Switcher & User Badge */}
          <div className="flex items-center flex-wrap gap-2">
            {/* 🛑 NOTFALL-KILL-SWITCH / PAUSE ALL */}
            <button
              type="button"
              onClick={() =>
                handleMutateControl({ action: "toggle_kill_switch" })
              }
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              style={{
                backgroundColor: controlState.policy.killSwitchActive
                  ? "#EF4444"
                  : "rgba(239, 68, 68, 0.14)",
                color: controlState.policy.killSwitchActive
                  ? "#050505"
                  : "#F87171",
                border: "1px solid rgba(239, 68, 68, 0.45)",
                boxShadow: controlState.policy.killSwitchActive
                  ? "0 0 18px rgba(239, 68, 68, 0.6)"
                  : "none",
              }}
              title="Sperrt sofort alle Kinder- und Gastgeräte im WLAN & Mobilfunk (Admin bleibt frei)"
            >
              <OctagonAlert className="w-3.5 h-3.5" />
              <span>
                {controlState.policy.killSwitchActive
                  ? "🛑 KILL-SWITCH AKTIV"
                  : "🛑 Pause All"}
              </span>
            </button>

            {/* 🌙 SCHLAFENSZEIT / BEDTIME */}
            <button
              type="button"
              onClick={() => handleMutateControl({ action: "toggle_bedtime" })}
              className="px-3 py-2 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
              style={{
                backgroundColor: controlState.policy.bedtimeActive
                  ? "rgba(168, 85, 247, 0.28)"
                  : "rgba(255, 255, 255, 0.03)",
                color: controlState.policy.bedtimeActive
                  ? "#E9D5FF"
                  : currentTheme.colors.textSecondary,
                border: `1px solid ${
                  controlState.policy.bedtimeActive
                    ? "rgba(168, 85, 247, 0.55)"
                    : currentTheme.colors.border
                }`,
              }}
              title="Erzwingt sofortige Nachtruhe für alle Nicht-Admin-Profile"
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {controlState.policy.bedtimeActive
                  ? "🌙 Bedtime AN"
                  : "🌙 Bedtime"}
              </span>
            </button>

            {/* Setup Wizard Button */}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="px-2.5 py-2 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors hover:bg-white/5"
              style={{
                border: `1px solid ${currentTheme.colors.border}`,
                color: currentTheme.colors.accent,
              }}
              title="Interaktiven 5-Schritte Einrichtungsassistenten öffnen"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Setup-Wizard</span>
            </button>

            {/* 5-Theme Live Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setThemeMenuOpen((o) => !o);
                  setAuthPopoverOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: `1px solid ${currentTheme.colors.border}`,
                  color: currentTheme.colors.textPrimary,
                }}
                title="Live-Canvas-Theme wechseln (Tasten 1–5)"
              >
                <Palette
                  className="w-3.5 h-3.5"
                  style={{ color: currentTheme.colors.accent }}
                />
                <span
                  className="font-semibold"
                  style={{ color: currentTheme.colors.accent }}
                >
                  {currentTheme.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              <AnimatePresence>
                {themeMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-72 rounded-xl p-2 backdrop-blur-2xl z-50 shadow-2xl"
                    style={{
                      backgroundColor: "#08080A",
                      border: `1px solid ${currentTheme.colors.borderStrong}`,
                    }}
                  >
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-white/10 mb-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                        5 Live-Canvas Themes
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Hotkeys [1–5]
                      </span>
                    </div>
                    <div className="space-y-1">
                      {THEME_LIST.map((t) => {
                        const active = t.id === themeId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setThemeId(t.id);
                              setThemeMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-all duration-150 hover:bg-white/5"
                            style={{
                              backgroundColor: active
                                ? t.colors.accentMuted
                                : "transparent",
                              border: active
                                ? `1px solid ${t.colors.borderStrong}`
                                : "1px solid transparent",
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{
                                  backgroundColor: t.colors.accent,
                                  boxShadow: `0 0 10px ${t.colors.accent}`,
                                }}
                              />
                              <div className="truncate">
                                <div className="text-xs font-medium text-white flex items-center gap-1.5">
                                  <span>{t.name}</span>
                                  <span className="text-[10px] font-mono opacity-50">
                                    [{t.shortcut}]
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {t.subtitle}
                                </div>
                              </div>
                            </div>
                            {active && (
                              <Check
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: t.colors.accent }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pause / Resume Live Canvas Button */}
            <button
              type="button"
              onClick={() => setCanvasPaused((p) => !p)}
              title={
                canvasPaused
                  ? "Live-Canvas-Animation fortsetzen"
                  : "Live-Canvas-Animation pausieren"
              }
              className="p-2 rounded-lg text-xs font-mono transition-colors hover:bg-white/5"
              style={{
                border: `1px solid ${currentTheme.colors.border}`,
                color: canvasPaused
                  ? currentTheme.colors.statusWarn
                  : currentTheme.colors.textSecondary,
              }}
            >
              {canvasPaused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Telemetry Refresh Button */}
            <button
              type="button"
              onClick={fetchAllData}
              title="Telemetrie & AdGuard 1:1 Sync jetzt aktualisieren"
              className="p-2 rounded-lg text-xs font-mono transition-colors hover:bg-white/5"
              style={{
                border: `1px solid ${currentTheme.colors.border}`,
                color: currentTheme.colors.textSecondary,
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                style={{
                  color: isRefreshing ? currentTheme.colors.accent : undefined,
                }}
              />
            </button>

            {/* ZERO-TRUST USER BADGE ("Eingeloggt als sebirauch2022@gmail.com") */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAuthPopoverOpen((o) => !o);
                  setThemeMenuOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg text-left transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: currentTheme.colors.accentMuted,
                  border: `1px solid ${currentTheme.colors.borderStrong}`,
                }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-bold relative"
                  style={{
                    backgroundColor: currentTheme.colors.bgBase,
                    color: currentTheme.colors.accent,
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                  }}
                >
                  SR
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black"
                    style={{ backgroundColor: currentTheme.colors.statusOnline }}
                  />
                </div>
                <div className="leading-tight hidden sm:block">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <ShieldCheck
                      className="w-3 h-3"
                      style={{ color: currentTheme.colors.accent }}
                    />
                    <span>Zero Trust Verified</span>
                  </div>
                  <div className="text-xs font-mono font-medium text-white">
                    Eingeloggt als{" "}
                    <span style={{ color: currentTheme.colors.accent }}>
                      {telemetry.auth.email}
                    </span>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {authPopoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl p-4 backdrop-blur-2xl z-50 shadow-2xl space-y-3"
                    style={{
                      backgroundColor: "#08080A",
                      border: `1px solid ${currentTheme.colors.borderStrong}`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Lock
                          className="w-4 h-4"
                          style={{ color: currentTheme.colors.accent }}
                        />
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white">
                          Cloudflare Zero Trust Identity
                        </span>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{
                          backgroundColor: currentTheme.colors.accentMuted,
                          color: currentTheme.colors.accent,
                        }}
                      >
                        GOOGLE OAUTH
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Eingeloggt als:</span>
                        <span className="text-white font-semibold">
                          {telemetry.auth.email}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">Hard Access Policy:</span>
                        <span style={{ color: currentTheme.colors.accent }}>
                          ONLY {ALLOWED_OWNER_EMAIL}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400">CF Header:</span>
                        <span className="text-zinc-300">
                          Cf-Access-Authenticated-User-Email
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-400">Client IP / Vector:</span>
                        <span className="text-zinc-300">
                          {telemetry.auth.clientIp}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <a
                        href="/login"
                        className="flex-1 text-center py-2 px-3 rounded-lg text-xs font-mono transition-colors hover:brightness-110"
                        style={{
                          backgroundColor: currentTheme.colors.accentMuted,
                          border: `1px solid ${currentTheme.colors.borderStrong}`,
                          color: currentTheme.colors.accent,
                        }}
                      >
                        Zero-Trust Login-Gate öffnen
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ================================================================= */}
        {/* DESKTOP & TABLET PRIMARY NAVIGATION TABS                          */}
        {/* ================================================================= */}
        <nav
          aria-label="Hauptnavigation"
          className="hidden lg:flex items-center justify-between gap-2 p-1.5 rounded-xl backdrop-blur-xl"
          style={{
            backgroundColor: currentTheme.colors.bgPanel,
            border: `1px solid ${currentTheme.colors.border}`,
          }}
        >
          <div className="flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold flex items-center gap-2 transition-all"
                  style={{
                    backgroundColor: active
                      ? currentTheme.colors.accentMuted
                      : "transparent",
                    color: active
                      ? currentTheme.colors.accent
                      : currentTheme.colors.textSecondary,
                    border: `1px solid ${
                      active ? currentTheme.colors.borderStrong : "transparent"
                    }`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: currentTheme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
            <span>Eingeloggt als {ALLOWED_OWNER_EMAIL}</span>
          </div>
        </nav>

        {/* ================================================================= */}
        {/* TAB 1: DASHBOARD OVERVIEW                                         */}
        {/* ================================================================= */}
        {activeNav === "dashboard" && (
          <div className="space-y-6">
            {/* Node & Host Info Panel (4 Cards) */}
            <section
              aria-label="Node & Host Info Panel"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {/* Card 1: Node.js Runtime & Environment */}
              <div
                className="rounded-xl p-4 backdrop-blur-xl flex flex-col justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Node.js & Runtime Env
                  </span>
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: currentTheme.colors.accentMuted,
                      color: currentTheme.colors.accent,
                    }}
                  >
                    <Terminal className="w-4 h-4" />
                  </div>
                </div>

                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold tracking-tight text-white tabular-nums">
                      {telemetry.nodeVersion}
                    </span>
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: currentTheme.colors.accentMuted,
                        color: currentTheme.colors.accent,
                      }}
                    >
                      LTS // OK
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-400 mt-1">
                    npm {telemetry.npmVersion} · V8 {telemetry.v8Version}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>PID: {telemetry.pid}</span>
                  <span>
                    Git:{" "}
                    <strong className="text-zinc-200">
                      {telemetry.git.branch}@{telemetry.git.commit}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Card 2: Memory Heap & Host RAM */}
              <div
                className="rounded-xl p-4 backdrop-blur-xl flex flex-col justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Memory Heap & LXC RAM
                  </span>
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: currentTheme.colors.accentMuted,
                      color: currentTheme.colors.accent,
                    }}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div className="my-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-bold tracking-tight text-white tabular-nums">
                      {telemetry.memory.heapUsedMb.toFixed(1)}{" "}
                      <span className="text-sm font-normal text-zinc-400">
                        / {telemetry.memory.heapTotalMb.toFixed(0)} MB
                      </span>
                    </span>
                    <span
                      className="text-xs font-mono tabular-nums"
                      style={{ color: currentTheme.colors.accent }}
                    >
                      RSS {telemetry.memory.rssMb.toFixed(0)} MB
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (telemetry.memory.heapUsedMb /
                              Math.max(1, telemetry.memory.heapTotalMb)) *
                              100
                          )
                        )}%`,
                        backgroundColor: currentTheme.colors.accent,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                  <span>
                    Host RAM: {telemetry.memory.hostUsedGb.toFixed(2)} /{" "}
                    {telemetry.memory.hostTotalGb.toFixed(2)} GB
                  </span>
                  <span>{telemetry.memory.hostPercent.toFixed(1)}%</span>
                </div>
              </div>

              {/* Card 3: CPU Load & System Uptime */}
              <div
                className="rounded-xl p-4 backdrop-blur-xl flex flex-col justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    CPU Load & Host Uptime
                  </span>
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: currentTheme.colors.accentMuted,
                      color: currentTheme.colors.accent,
                    }}
                  >
                    <Cpu className="w-4 h-4" />
                  </div>
                </div>

                <div className="my-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-bold tracking-tight text-white tabular-nums">
                      {telemetry.cpuLoadPercent.toFixed(1)}%
                    </span>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">
                      Load{" "}
                      {telemetry.loadAvg.map((n) => n.toFixed(2)).join(" / ")}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(4, telemetry.cpuLoadPercent)
                        )}%`,
                        backgroundColor: currentTheme.colors.accent,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                  <span>{telemetry.cpuCores} vCPU Cores</span>
                  <span>Uptime: {formatDuration(telemetry.uptimeSeconds)}</span>
                </div>
              </div>

              {/* Card 4: Zero-Trust, Tailscale & AdGuard 1:1 Summary */}
              <div
                className="rounded-xl p-4 backdrop-blur-xl flex flex-col justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Zero-Trust & AdGuard 1:1
                  </span>
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: currentTheme.colors.accentMuted,
                      color: currentTheme.colors.accent,
                    }}
                  >
                    <Cloud className="w-4 h-4" />
                  </div>
                </div>

                <div className="my-2.5 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Cloudflare:</span>
                    <span
                      className="font-semibold"
                      style={{ color: currentTheme.colors.accent }}
                    >
                      {telemetry.network.cloudflareDomain}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Tailscale IP:</span>
                    <span className="text-zinc-200 tabular-nums">
                      {telemetry.network.tailscaleIp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">5G Anti-Bypass:</span>
                    <span className="text-emerald-400 font-bold">
                      {controlState.policy.roamingEnforcement
                        ? "DoH / DoT ACTIVE"
                        : "STANDBY"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>
                    {onlineServicesCount}/{services.length} Dienste Online
                  </span>
                  <span className="tabular-nums">Ø {avgLatencyMs} ms</span>
                </div>
              </div>
            </section>

            {/* Quick Feature Jump Cards for AdGuard 1:1, Roaming Anti-Bypass & Block Studio */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveNav("adguard")}
                className="rounded-xl p-4 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 flex items-center justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.borderStrong}`,
                }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase" style={{ color: currentTheme.colors.accent }}>
                    1:1 LIVE MIRROR // 0ms CACHE
                  </div>
                  <div className="text-sm font-bold text-white">
                    AdGuard Home Komplettsteuerung
                  </div>
                  <div className="text-xs text-zinc-400">
                    Live Query-Log (SSE), Filterlisten, Custom Rules, 27 Dienste & DNS-Rewrites
                  </div>
                </div>
                <ShieldCheck className="w-6 h-6 shrink-0" style={{ color: currentTheme.colors.accent }} />
              </button>

              <button
                type="button"
                onClick={() => setActiveNav("devices")}
                className="rounded-xl p-4 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 flex items-center justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase text-emerald-400">
                    5G / LTE / HOTSPOT SCHUTZ
                  </div>
                  <div className="text-sm font-bold text-white">
                    Geräte & Roaming Anti-Bypass ({controlState.devices.length})
                  </div>
                  <div className="text-xs text-zinc-400">
                    Unremovable iOS .mobileconfig, Android DoT QR-Code & Bandbreiten-Radar
                  </div>
                </div>
                <Smartphone className="w-6 h-6 shrink-0 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={() => setActiveNav("studio")}
                className="rounded-xl p-4 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 flex items-center justify-between"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase text-amber-400">
                    SPERRSEITEN-EDITOR // SSL CA
                  </div>
                  <div className="text-sm font-bold text-white">
                    Custom Block Page Studio
                  </div>
                  <div className="text-xs text-zinc-400">
                    Live-Vorschau, Countdown-Timer & 1-Klick „Zugang anfordern“-Freigaben
                  </div>
                </div>
                <LayoutTemplate className="w-6 h-6 shrink-0 text-amber-400" />
              </button>
            </section>

            {/* Quick Links / Bookmarks */}
            <section
              aria-label="Quick Links und Bookmarks"
              className="rounded-xl p-5 backdrop-blur-xl space-y-4"
              style={{
                backgroundColor: currentTheme.colors.bgPanel,
                border: `1px solid ${currentTheme.colors.border}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap
                      className="w-4 h-4"
                      style={{ color: currentTheme.colors.accent }}
                    />
                    <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white">
                      Quick Links & Infrastruktur-Bookmarks
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Direktzugriff auf Router, AdGuard Home, Proxmox VE, ZimaOS, Discord-Bots & Zero-Trust
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-1.5">
                  {[
                    { id: "all", label: "Alle" },
                    { id: "core", label: "Core / PVE" },
                    { id: "network", label: "DNS & Router" },
                    { id: "bots", label: "Bots" },
                    { id: "media", label: "Streyn" },
                    { id: "security", label: "Zero Trust" },
                  ].map((tab) => {
                    const active = bookmarkFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBookmarkFilter(tab.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
                        style={{
                          backgroundColor: active
                            ? currentTheme.colors.accentMuted
                            : "rgba(255,255,255,0.02)",
                          color: active
                            ? currentTheme.colors.accent
                            : currentTheme.colors.textSecondary,
                          border: `1px solid ${
                            active
                              ? currentTheme.colors.borderStrong
                              : currentTheme.colors.border
                          }`,
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setShowAddBookmark((s) => !s)}
                    className="ml-1 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1"
                    style={{
                      backgroundColor: currentTheme.colors.accentMuted,
                      color: currentTheme.colors.accent,
                      border: `1px solid ${currentTheme.colors.borderStrong}`,
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Neu</span>
                  </button>
                </div>
              </div>

              {showAddBookmark && (
                <form
                  onSubmit={handleAddBookmark}
                  className="p-3.5 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-2.5"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.45)",
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Name (z.B. Immich)"
                    value={newBookmark.title}
                    onChange={(e) =>
                      setNewBookmark({ ...newBookmark, title: e.target.value })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Beschreibung"
                    value={newBookmark.subtitle}
                    onChange={(e) =>
                      setNewBookmark({
                        ...newBookmark,
                        subtitle: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                  />
                  <input
                    type="url"
                    placeholder="https://192.168.178.67:2283"
                    value={newBookmark.url}
                    onChange={(e) =>
                      setNewBookmark({ ...newBookmark, url: e.target.value })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="IP / Port"
                    value={newBookmark.lanIp}
                    onChange={(e) =>
                      setNewBookmark({ ...newBookmark, lanIp: e.target.value })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                    style={{
                      backgroundColor: currentTheme.colors.accent,
                      color: "#050505",
                    }}
                  >
                    Hinzufügen
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {filteredBookmarks.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl p-3.5 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${currentTheme.colors.border}`,
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: currentTheme.colors.accentMuted,
                            border: `1px solid ${currentTheme.colors.border}`,
                          }}
                        >
                          {renderQuickLinkIcon(item.iconName)}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase"
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.04)",
                              color: currentTheme.colors.textSecondary,
                            }}
                          >
                            {item.badge}
                          </span>
                          {item.id.startsWith("custom-") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBookmark(item.id)}
                              className="p-1 text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:underline flex items-center justify-between">
                          <span className="truncate">{item.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 shrink-0" />
                        </h3>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                          {item.subtitle}
                        </p>
                      </a>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span
                        className="truncate"
                        style={{ color: currentTheme.colors.accent }}
                      >
                        {item.lanIp}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.url)}
                        className="hover:text-white"
                      >
                        {copiedKey === item.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Dienste- & Bot-Monitor + Management CLI */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section
                aria-label="Dienste- und Bot-Monitor"
                className="lg:col-span-7 rounded-xl p-5 backdrop-blur-xl space-y-4"
                style={{
                  backgroundColor: currentTheme.colors.bgPanel,
                  border: `1px solid ${currentTheme.colors.border}`,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity
                        className="w-4 h-4"
                        style={{ color: currentTheme.colors.accent }}
                      />
                      <h2 className="text-sm sm:text-base font-semibold text-white">
                        Dienste- & Bot-Monitor
                      </h2>
                    </div>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">
                      Docker-Container, Proxmox LXC Services & externe Bots mit Live-Ping & Logs
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "all", label: "Alle" },
                      { id: "docker", label: "Docker" },
                      { id: "bot", label: "Bots & Audio" },
                      { id: "system", label: "Mesh VPN" },
                    ].map((f) => {
                      const active = serviceFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            setServiceFilter(
                              f.id as "all" | "docker" | "bot" | "system"
                            )
                          }
                          className="px-2.5 py-1 rounded-lg text-xs font-mono"
                          style={{
                            backgroundColor: active
                              ? currentTheme.colors.accentMuted
                              : "rgba(255,255,255,0.02)",
                            color: active
                              ? currentTheme.colors.accent
                              : currentTheme.colors.textSecondary,
                            border: `1px solid ${
                              active
                                ? currentTheme.colors.borderStrong
                                : currentTheme.colors.border
                            }`,
                          }}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredServices.map((srv) => {
                    const logsOpen = !!expandedServiceLogs[srv.id];
                    const isPinging = pingingId === srv.id;
                    return (
                      <div
                        key={srv.id}
                        className="rounded-xl p-4"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${currentTheme.colors.border}`,
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  currentTheme.colors.statusOnline,
                                boxShadow: `0 0 10px ${currentTheme.colors.statusOnline}`,
                              }}
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">
                                  {srv.name}
                                </h3>
                                <span
                                  className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
                                  style={{
                                    backgroundColor:
                                      currentTheme.colors.accentMuted,
                                    color: currentTheme.colors.accent,
                                  }}
                                >
                                  {srv.status.toUpperCase()} · {srv.pingMs}ms
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500">
                                  :{srv.port}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1">
                                {srv.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-zinc-400">
                                <span>{srv.containerName}</span>
                                <span>•</span>
                                <span>CPU: {srv.cpuPercent.toFixed(1)}%</span>
                                <span>•</span>
                                <span>RAM: {srv.memoryMb} MB</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePingService(srv)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 hover:bg-white/5"
                              style={{
                                border: `1px solid ${currentTheme.colors.border}`,
                                color: currentTheme.colors.textSecondary,
                              }}
                            >
                              <Wifi
                                className={`w-3.5 h-3.5 ${
                                  isPinging ? "animate-ping" : ""
                                }`}
                                style={{ color: currentTheme.colors.accent }}
                              />
                              <span>Ping</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedServiceLogs((prev) => ({
                                  ...prev,
                                  [srv.id]: !prev[srv.id],
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1 hover:bg-white/5"
                              style={{
                                border: `1px solid ${currentTheme.colors.border}`,
                                color: logsOpen
                                  ? currentTheme.colors.accent
                                  : currentTheme.colors.textSecondary,
                              }}
                            >
                              <Terminal className="w-3.5 h-3.5" />
                              <span>Logs</span>
                            </button>
                          </div>
                        </div>

                        {logsOpen && (
                          <div className="mt-3 pt-2.5 border-t border-white/5">
                            <div className="rounded-lg bg-black/70 p-2.5 font-mono text-[11px] space-y-1 text-zinc-300 border border-white/5">
                              {srv.logs.map((line, i) => (
                                <div key={i} className="truncate">
                                  <span
                                    className="mr-2"
                                    style={{ color: currentTheme.colors.accent }}
                                  >
                                    ❯
                                  </span>
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Right 5 Columns: Bots-Style Multi-OS Installer & Management CLI */}
              <section className="lg:col-span-5 space-y-6">
                <div
                  className="rounded-xl p-5 backdrop-blur-xl space-y-4"
                  style={{
                    backgroundColor: currentTheme.colors.bgPanel,
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="w-4 h-4"
                        style={{ color: currentTheme.colors.accent }}
                      />
                      <h2 className="text-sm sm:text-base font-semibold text-white">
                        Network installieren (Proxmox · Linux · Windows)
                      </h2>
                    </div>
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
                      style={{
                        backgroundColor: currentTheme.colors.accentMuted,
                        color: currentTheme.colors.accent,
                      }}
                    >
                      BOTS-STYLE INSTALLER
                    </span>
                  </div>

                  {/* OS Tabs like bot.labtoso.de */}
                  <div
                    className="inline-flex gap-1 p-1 rounded-lg"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.45)",
                      border: `1px solid ${currentTheme.colors.border}`,
                    }}
                  >
                    {(
                      [
                        { id: "proxmox", label: "Proxmox VE" },
                        { id: "linux", label: "Linux / VPS" },
                        { id: "win", label: "Windows" },
                      ] as const
                    ).map((t) => {
                      const on = installerOsTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setInstallerOsTab(t.id)}
                          className="px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all"
                          style={{
                            backgroundColor: on
                              ? currentTheme.colors.accentMuted
                              : "transparent",
                            color: on ? currentTheme.colors.accent : "#94A3B8",
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {installerOsTab === "proxmox" && (
                    <div className="space-y-2.5">
                      <div
                        className="rounded-xl p-3 font-mono text-xs flex items-center justify-between gap-2"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.65)",
                          border: `1px solid ${currentTheme.colors.border}`,
                        }}
                      >
                        <code
                          className="truncate select-all"
                          style={{ color: currentTheme.colors.accent }}
                        >
                          {`bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"`}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              "proxmox-cmd",
                              `bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"`
                            )
                          }
                          className="px-3 py-1 rounded-lg text-xs font-mono shrink-0 transition-colors hover:bg-white/10"
                          style={{
                            border: `1px solid ${currentTheme.colors.borderStrong}`,
                            color: currentTheme.colors.textPrimary,
                          }}
                        >
                          {copiedKey === "proxmox-cmd" ? "Kopiert" : "Kopieren"}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        In der Shell des Proxmox-Hosts einfügen. Legt einen eigenen Debian-12-LXC an, fragt nach Tailscale &amp; Cloudflare Tunnel Token, schreibt die Adresse in die Container-Notizen (<code className="text-white">network-notes.timer</code>) und aktualisiert sich alle 15 Minuten selbst. Nochmal ausführen = Update.
                      </p>
                    </div>
                  )}

                  {installerOsTab === "linux" && (
                    <div className="space-y-2.5">
                      <div
                        className="rounded-xl p-3 font-mono text-xs flex items-center justify-between gap-2"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.65)",
                          border: `1px solid ${currentTheme.colors.border}`,
                        }}
                      >
                        <code
                          className="truncate select-all"
                          style={{ color: currentTheme.colors.accent }}
                        >
                          {`curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh | sudo bash`}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              "linux-cmd",
                              `curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh | sudo bash`
                            )
                          }
                          className="px-3 py-1 rounded-lg text-xs font-mono shrink-0 transition-colors hover:bg-white/10"
                          style={{
                            border: `1px solid ${currentTheme.colors.borderStrong}`,
                            color: currentTheme.colors.textPrimary,
                          }}
                        >
                          {copiedKey === "linux-cmd" ? "Kopiert" : "Kopieren"}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Debian, Ubuntu oder Fedora. Installiert Node.js 22 LTS, Docker, Tailscale, Root-CA &amp; SQLite, läuft als Dienst <code className="text-white">network-admin</code> und hält sich über <code className="text-white">network-update.timer</code> aktuell.
                      </p>
                    </div>
                  )}

                  {installerOsTab === "win" && (
                    <div className="space-y-2.5">
                      <div>
                        <a
                          href="/Install.bat"
                          download="Install.bat"
                          className="inline-block px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all hover:brightness-110"
                          style={{
                            backgroundColor: currentTheme.colors.accent,
                            color: "#050505",
                          }}
                        >
                          Install.bat herunterladen
                        </a>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Oder in PowerShell einfügen:
                      </div>
                      <div
                        className="rounded-xl p-3 font-mono text-xs flex items-center justify-between gap-2"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.65)",
                          border: `1px solid ${currentTheme.colors.border}`,
                        }}
                      >
                        <code
                          className="truncate select-all"
                          style={{ color: currentTheme.colors.accent }}
                        >
                          {`irm https://raw.githubusercontent.com/Labtoso/Network/main/install.ps1 | iex`}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              "win-cmd",
                              `irm https://raw.githubusercontent.com/Labtoso/Network/main/install.ps1 | iex`
                            )
                          }
                          className="px-3 py-1 rounded-lg text-xs font-mono shrink-0 transition-colors hover:bg-white/10"
                          style={{
                            border: `1px solid ${currentTheme.colors.borderStrong}`,
                            color: currentTheme.colors.textPrimary,
                          }}
                        >
                          {copiedKey === "win-cmd" ? "Kopiert" : "Kopieren"}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Keine extra Rechte nötig, portables Node.js LTS ist dabei. Installiert nach <code className="text-white">%LOCALAPPDATA%\LabtosoNetwork</code>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Management CLI Console */}
                <div
                  className="rounded-xl p-5 backdrop-blur-xl space-y-4"
                  style={{
                    backgroundColor: currentTheme.colors.bgPanel,
                    border: `1px solid ${currentTheme.colors.border}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal
                        className="w-4 h-4"
                        style={{ color: currentTheme.colors.accent }}
                      />
                      <h2 className="text-sm sm:text-base font-semibold text-white">
                        Management CLI (<code className="font-mono">manage.sh</code>)
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Bot-Repo Workflow
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "info", label: "info" },
                        { id: "status", label: "status" },
                        { id: "logs", label: "logs" },
                        { id: "install", label: "install" },
                        { id: "update", label: "update" },
                        { id: "proxmox", label: "install.sh" },
                      ] as const
                    ).map((cmd) => {
                      const active = activeCliCmd === cmd.id;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => setActiveCliCmd(cmd.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono"
                          style={{
                            backgroundColor: active
                              ? currentTheme.colors.accentMuted
                              : "rgba(255,255,255,0.03)",
                            color: active
                              ? currentTheme.colors.accent
                              : currentTheme.colors.textSecondary,
                            border: `1px solid ${
                              active
                                ? currentTheme.colors.borderStrong
                                : currentTheme.colors.border
                            }`,
                          }}
                        >
                          {cmd.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      backgroundColor: "#040406",
                      border: `1px solid ${currentTheme.colors.border}`,
                    }}
                  >
                    <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                      <span className="text-[11px] font-mono text-zinc-400">
                        root@network-admin:/opt/network#{" "}
                        <strong className="text-white">
                          {cliOutputMap[activeCliCmd].command}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            "cli-cmd",
                            cliOutputMap[activeCliCmd].command
                          )
                        }
                        className="text-[11px] font-mono text-zinc-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="p-3.5 font-mono text-[11px] leading-relaxed space-y-1 max-h-72 overflow-y-auto">
                      {cliOutputMap[activeCliCmd].output.map((line, idx) => (
                        <div
                          key={idx}
                          className="whitespace-pre-wrap break-all text-zinc-300"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ADGUARD HOME 1:1 BIDIRECTIONAL MIRROR SUITE                */}
        {/* ================================================================= */}
        {activeNav === "adguard" && (
          <AdGuardMirrorSuite
            theme={currentTheme}
            adguard={controlState.adguard}
            devices={controlState.devices}
            adguardUrl={controlState.policy.adguardUrl}
            onMutateAdGuard={handleMutateAdGuard}
            onNotify={showToast}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 3 & 4: GERÄTE & 5G ROAMING / REGELN & 24/7 ZEITPLAN           */}
        {/* ================================================================= */}
        {(activeNav === "devices" || activeNav === "rules") && (
          <DeviceAndRulesSuite
            mode={activeNav}
            theme={currentTheme}
            devices={controlState.devices}
            policy={controlState.policy}
            unblockRequests={controlState.unblockRequests}
            blockedStream={controlState.blockedStream}
            onMutateControl={async (payload) => { await handleMutateControl(payload); }}
            onNotify={showToast}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 5: CUSTOM BLOCK PAGE STUDIO                                   */}
        {/* ================================================================= */}
        {activeNav === "studio" && (
          <BlockPageStudio
            theme={currentTheme}
            blockPage={controlState.blockPage}
            onMutateControl={async (payload) => { await handleMutateControl(payload); }}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 6: SETTINGS, ZERO-TRUST & CLI MANAGEMENT                      */}
        {/* ================================================================= */}
        {activeNav === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="rounded-xl p-5 backdrop-blur-xl space-y-4"
              style={{
                backgroundColor: currentTheme.colors.bgPanel,
                border: `1px solid ${currentTheme.colors.border}`,
              }}
            >
              <h2 className="text-base font-bold text-white">
                System-, AdGuard- & Zero-Trust-Einstellungen
              </h2>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">
                    AdGuard Home Instanz-URL (ZimaOS / LXC)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={controlState.policy.adguardUrl}
                      onChange={(e) =>
                        setControlState({
                          ...controlState,
                          policy: {
                            ...controlState.policy,
                            adguardUrl: e.target.value,
                          },
                        })
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleMutateControl({
                          action: "update_policy",
                          adguardUrl: controlState.policy.adguardUrl,
                        })
                      }
                      className="px-4 py-2 rounded-lg font-bold"
                      style={{
                        backgroundColor: currentTheme.colors.accent,
                        color: "#050505",
                      }}
                    >
                      Speichern
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Zero-Trust Owner:</span>
                    <span className="text-white font-bold">
                      {ALLOWED_OWNER_EMAIL}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Public Tunnel:</span>
                    <span style={{ color: currentTheme.colors.accent }}>
                      https://{PUBLIC_ZERO_TRUST_DOMAIN}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Roaming DoH Endpoint:</span>
                    <span className="text-zinc-200">
                      https://{PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/&#123;id&#125;
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Android Private DNS:</span>
                    <span className="text-zinc-200">
                      &#123;id&#125;.dot.labtoso.de
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: currentTheme.colors.accentMuted,
                    color: currentTheme.colors.accent,
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                  }}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>5-Schritte Einrichtungsassistent (Setup Wizard) starten</span>
                </button>
              </div>
            </div>

            <div
              className="rounded-xl p-5 backdrop-blur-xl space-y-4"
              style={{
                backgroundColor: currentTheme.colors.bgPanel,
                border: `1px solid ${currentTheme.colors.border}`,
              }}
            >
              <h2 className="text-base font-bold text-white">
                5 Integrierte Dark-Themes & Live-Canvas
              </h2>
              <div className="space-y-2">
                {THEME_LIST.map((t) => {
                  const active = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeId(t.id)}
                      className="w-full p-3 rounded-xl text-left flex items-center justify-between"
                      style={{
                        backgroundColor: active
                          ? t.colors.accentMuted
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          active ? t.colors.borderStrong : t.colors.border
                        }`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{
                            backgroundColor: t.colors.accent,
                            boxShadow: `0 0 10px ${t.colors.accent}`,
                          }}
                        />
                        <div>
                          <div className="text-xs font-bold text-white">
                            {t.name} [{t.shortcut}]
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {t.subtitle}
                          </div>
                        </div>
                      </div>
                      {active && (
                        <Check
                          className="w-4 h-4"
                          style={{ color: t.colors.accent }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MOBILE-FIRST THUMB BOTTOM-NAVIGATIONBAR (PWA READY)               */}
      {/* ================================================================= */}
      <nav
        aria-label="Mobile Daumen-Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-2xl px-2 py-1.5 border-t"
        style={{
          backgroundColor: "rgba(5, 5, 7, 0.92)",
          borderColor: currentTheme.colors.borderStrong,
        }}
      >
        <div className="grid grid-cols-6 gap-1 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className="relative py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  backgroundColor: active
                    ? currentTheme.colors.accentMuted
                    : "transparent",
                  color: active ? currentTheme.colors.accent : "#94A3B8",
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-mono font-medium truncate max-w-full">
                  {item.shortLabel}
                </span>
                {item.badge !== undefined && (
                  <span
                    className="absolute top-1 right-1 px-1 rounded-full text-[8px] font-mono font-bold"
                    style={{
                      backgroundColor: currentTheme.colors.accent,
                      color: "#050505",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
