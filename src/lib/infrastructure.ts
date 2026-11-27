export interface ServiceMonitorItem {
  id: string;
  name: string;
  category: "docker" | "bot" | "system";
  containerName?: string;
  endpoint: string;
  publicUrl?: string;
  port: number;
  status: "online" | "standby" | "degraded";
  pingMs: number;
  uptime: string;
  cpuPercent: number;
  memoryMb: number;
  version: string;
  description: string;
  logs: string[];
}

export interface QuickLinkItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  lanIp: string;
  category: "core" | "network" | "bots" | "media" | "security";
  iconName:
    | "Server"
    | "ShieldCheck"
    | "Router"
    | "Globe"
    | "Cpu"
    | "Bot"
    | "Music"
    | "Lock"
    | "Network"
    | "HardDrive";
  badge: string;
}

export const DEFAULT_SERVICES: ServiceMonitorItem[] = [
  {
    id: "network-admin",
    name: "Network Control Center",
    category: "docker",
    containerName: "network-admin",
    endpoint: "http://127.0.0.1:3000",
    publicUrl: "https://admin.labtoso.de",
    port: 3000,
    status: "online",
    pingMs: 2,
    uptime: "Active",
    cpuPercent: 1.4,
    memoryMb: 94,
    version: "Next.js 15 · Node LTS",
    description: "Zero-Trust Admin Panel & Live Telemetry Engine",
    logs: [
      "[SYS] Zero-Trust Policy active: hard-locked to sebirauch2022@gmail.com",
      "[NET] Listening on 0.0.0.0:3000 (LAN + Tailscale + Cloudflared)",
      "[AUTH] Verified Cf-Access-Authenticated-User-Email header",
    ],
  },
  {
    id: "cloudflared-tunnel",
    name: "Cloudflare Zero-Trust Tunnel",
    category: "docker",
    containerName: "network-cloudflared",
    endpoint: "https://admin.labtoso.de",
    publicUrl: "https://admin.labtoso.de",
    port: 443,
    status: "online",
    pingMs: 14,
    uptime: "Active",
    cpuPercent: 0.6,
    memoryMb: 38,
    version: "cloudflared 2026.11 · QUIC",
    description: "Ingress Tunnel -> admin.labtoso.de (No open router ports)",
    logs: [
      "[INF] Connection registered connIndex=0 location=fra06 protocol=quic",
      "[INF] Updated ingress rule: hostname=admin.labtoso.de service=http://network-admin:3000",
      "[INF] Zero-Trust Access policy verification enabled (Google OAuth)",
    ],
  },
  {
    id: "tailscale-mesh",
    name: "Tailscale Mesh Daemon",
    category: "system",
    containerName: "tailscaled",
    endpoint: "100.64.0.1",
    port: 41641,
    status: "online",
    pingMs: 4,
    uptime: "Active",
    cpuPercent: 0.4,
    memoryMb: 32,
    version: "Tailscale WireGuard · MagicDNS",
    description: "Private Fallback Access via Tailnet & Direct LXC SSH/HTTP",
    logs: [
      "[WG] WireGuard engine active; DERP relay: Frankfurt (fra)",
      "[DNS] MagicDNS registered host: network-admin.tailnet.ts.net",
      "[NET] Direct peer-to-peer path established via UDP/41641",
    ],
  },
  {
    id: "adguard-home",
    name: "AdGuard Home DNS",
    category: "docker",
    containerName: "adguard-home",
    endpoint: "http://192.168.178.67:3001",
    publicUrl: "http://192.168.178.67:3001",
    port: 53,
    status: "online",
    pingMs: 3,
    uptime: "14d 08h",
    cpuPercent: 1.8,
    memoryMb: 112,
    version: "v0.107.79 · HaGeZi Multi PRO",
    description: "Network-wide DNS Sinkhole (Host 53 TCP/UDP, 853 DoT, HaGeZi PRO + NSFW)",
    logs: [
      "[DNS] Upstream DoH/DoT healthy · HaGeZi Multi PRO & NSFW lists active",
      "[QRY] Client 192.168.178.24 (Predator-PC.fritz.box) -> filtered tracker query",
      "[SYS] Listening on 192.168.178.67:53 (DNS) and :3001 (Web UI)",
    ],
  },
  {
    id: "nginx-proxy",
    name: "Nginx Reverse Proxy",
    category: "docker",
    containerName: "nginx",
    endpoint: "http://192.168.178.67:8088",
    publicUrl: "http://192.168.178.67:8088",
    port: 8088,
    status: "online",
    pingMs: 4,
    uptime: "11d 19h",
    cpuPercent: 0.3,
    memoryMb: 28,
    version: "LinuxServer.io · HTTP/3 QUIC",
    description: "ZimaOS Web & Custom Rewrite Engine (/DATA/AppData/nginx/config)",
    logs: [
      "[NGX] worker_processes auto; listening on 0.0.0.0:80 (Host 8088) & 443",
      "[SSL] TLS 1.3 + QUIC vhost configuration loaded from /config/nginx/site-confs",
      "[ACC] GET / HTTP/2.0 200 192.168.178.24",
    ],
  },
  {
    id: "msik-bot",
    name: "Msik Musikbot",
    category: "bot",
    containerName: "msik.service (CT 102)",
    endpoint: "https://bot.labtoso.de/Msik/",
    publicUrl: "https://bot.labtoso.de/Msik/",
    port: 8080,
    status: "online",
    pingMs: 18,
    uptime: "9d 04h",
    cpuPercent: 2.1,
    memoryMb: 148,
    version: "Node 22 · Native Opus · yt-dlp-fast",
    description: "Discord Music Bot (/web Studio Dashboard, PCM Effect Pipeline & Cloudflare Tunnel)",
    logs: [
      "[BOT] Eingeloggt als Msik · /web Slash-Command registriert",
      "[AUD] Opus: nativ · 4-MB PCM Buffer & Preload Queue [0..2] bereit",
      "[API] SSE & REST Backend verbunden mit https://bot.labtoso.de/Msik/",
    ],
  },
  {
    id: "aio-bot",
    name: "AIO Discord Bot",
    category: "bot",
    containerName: "aio.service (CT 102)",
    endpoint: "https://bot.labtoso.de/AIO/",
    publicUrl: "https://bot.labtoso.de/AIO/",
    port: 8090,
    status: "online",
    pingMs: 19,
    uptime: "9d 04h",
    cpuPercent: 1.7,
    memoryMb: 126,
    version: "Node 22 · 17 Modules · /aio Panel",
    description: "All-in-One Discord Suite (Moderation, Auto-Mod, Minecraft 24h/7d, Tickets, Boosts)",
    logs: [
      "[AIO] /aio command ready · Persistent session secret loaded from data/.secret",
      "[MOD] Active modules: AutoMod, Levels, ReactionRoles, Minecraft Ping, SocialAlerts, Boosts",
      "[WEB] Control panel reachable at https://bot.labtoso.de/AIO/ (DE/EN i18n)",
    ],
  },
  {
    id: "streyn-server",
    name: "Streyn Music Server",
    category: "bot",
    containerName: "streyn-core",
    endpoint: "https://musik.labtoso.de",
    publicUrl: "https://musik.labtoso.de",
    port: 8085,
    status: "online",
    pingMs: 16,
    uptime: "12d 15h",
    cpuPercent: 0.9,
    memoryMb: 64,
    version: "v1.26.7 · Rust Audio Core",
    description: "Self-Hosted Music Streaming, Chillscreen Room & Recommendation Engine on Proxmox",
    logs: [
      "[RST] Streyn v1.26.7 Rust server listening · Liquid Glass Web & Android Sync ready",
      "[STR] Chillscreen room websocket active · Preload & server download pipeline healthy",
      "[REC] Audio taste & recommendation index synchronized",
    ],
  },
];

export const DEFAULT_QUICK_LINKS: QuickLinkItem[] = [
  {
    id: "proxmox",
    title: "Proxmox VE Node",
    subtitle: "Hypervisor · LXC Containers & ZFS Storage",
    url: "https://192.168.178.103:8006",
    lanIp: "192.168.178.103:8006",
    category: "core",
    iconName: "Server",
    badge: "PVE // HOST",
  },
  {
    id: "zimaos",
    title: "ZimaOS Homeserver",
    subtitle: "Docker Host, RAID Storage, Immich & Files",
    url: "http://192.168.178.67",
    lanIp: "192.168.178.67",
    category: "core",
    iconName: "HardDrive",
    badge: "ZIMA // NAS",
  },
  {
    id: "adguard",
    title: "AdGuard Home",
    subtitle: "DNS Sinkhole · HaGeZi Multi PRO & NSFW Filter",
    url: "http://192.168.178.67:3001",
    lanIp: "192.168.178.67:3001",
    category: "network",
    iconName: "ShieldCheck",
    badge: "DNS // :53",
  },
  {
    id: "fritzbox",
    title: "FRITZ!Box 6660 Cable",
    subtitle: "Gateway Router · DHCP (192.168.178.20-200) & DNS",
    url: "http://192.168.178.1",
    lanIp: "192.168.178.1",
    category: "network",
    iconName: "Router",
    badge: "GATEWAY // .1",
  },
  {
    id: "nginx",
    title: "Nginx Web & Proxy",
    subtitle: "Reverse Proxy & Custom Domain Routing",
    url: "http://192.168.178.67:8088",
    lanIp: "192.168.178.67:8088",
    category: "network",
    iconName: "Globe",
    badge: "PROXY // :8088",
  },
  {
    id: "msik",
    title: "Msik Bot Studio",
    subtitle: "Discord Music Controller & Live Audio Effects",
    url: "https://bot.labtoso.de/Msik/",
    lanIp: "CT 102 :8080",
    category: "bots",
    iconName: "Music",
    badge: "BOT // MSIK",
  },
  {
    id: "aio",
    title: "AIO Bot Dashboard",
    subtitle: "All-in-One Discord Management &Discohook JSON",
    url: "https://bot.labtoso.de/AIO/",
    lanIp: "CT 102 :8090",
    category: "bots",
    iconName: "Bot",
    badge: "BOT // AIO",
  },
  {
    id: "streyn",
    title: "Streyn Music",
    subtitle: "Self-Hosted Rust Audio Server & Chillscreen",
    url: "https://musik.labtoso.de",
    lanIp: "musik.labtoso.de",
    category: "media",
    iconName: "Cpu",
    badge: "RUST // v1.26.7",
  },
  {
    id: "cloudflare-zt",
    title: "Cloudflare Zero Trust",
    subtitle: "Tunnels, Google OAuth & Access Policies",
    url: "https://one.dash.cloudflare.com",
    lanIp: "admin.labtoso.de",
    category: "security",
    iconName: "Lock",
    badge: "ZERO // TRUST",
  },
  {
    id: "tailscale",
    title: "Tailscale Admin Console",
    subtitle: "Mesh VPN ACLs, MagicDNS & LXC Nodes",
    url: "https://login.tailscale.com/admin/machines",
    lanIp: "100.64.0.0/10",
    category: "security",
    iconName: "Network",
    badge: "MESH // VPN",
  },
];
