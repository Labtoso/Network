# 🛡️ Labtoso Network Control Suite (`admin.labtoso.de`)

Produktionsreifes **Zero-Trust Network, Device & AdGuard 1:1 Control Panel** für **Proxmox VE**, **ZimaOS**, **AdGuard Home**, **Tailscale Mesh VPN**, **Cloudflare Zero Trust** und **Discord/Audio-Bots** (`Msik`, `AIO`, `Streyn`).

---

## ⚡ 1-Befehl Proxmox VE Auto-Installation (LXC Helper Script)

Führe diesen einzigen Befehl als `root` in der **Proxmox VE Host-Shell** (*Datacenter ➔ Node ➔ Shell*) aus:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
```

### Was der Auto-Installer vollautomatisch erledigt (Zero-Friction Install):
1. **Debian 12 LXC-Container:** Erstellt einen unprivilegierten LXC-Container (`nesting=1,keyctl=1`, `/dev/net/tun` für WireGuard aktiviert, Autostart aktiv, Tag `network-admin`).
2. **System- & Runtime-Stack:** Installiert `curl`, `wget`, `git`, `jq`, `openssl`, `ca-certificates`, `iptables`, **Node.js 22 LTS**, `npm`, `pnpm`, **Docker & Docker Compose**, **Tailscale** und **Cloudflared**.
3. **Lokale Root-CA (`openssl`):** Generiert automatisch ein lokales Root-CA-Zertifikat (`certs/labtoso-root-ca.crt`) für die Custom-HTTPS-Sperrseite.
4. **Interaktive Token-Abfrage:** Fragt sicher nach dem **Tailscale Auth-Key** und dem **Cloudflare Tunnel Token** (Übergabe per `pct push` über eine `0600` Root-Datei – niemals in der Host-Prozessliste sichtbar).
5. **SQLite & Build:** Klont `https://github.com/Labtoso/Network.git` nach `/opt/network`, initialisiert die SQLite-Datenbank via Prisma (`prisma db push`) und startet das Panel über `./manage.sh install`.

---

## 🛠️ Management CLI (`manage.sh` / `admin.sh`)

Das Projekt folgt exakt dem gleichen strukturierten CLI-Workflow wie die Bot-Repositories:

```bash
./manage.sh install     # Prüft System/Node.js, generiert Root-CA, migriert SQLite (Prisma), baut & startet Services
./manage.sh update      # Zieht git pull, aktualisiert Pakete/Prisma-DB, baut neu & startet nahtlos durch
./manage.sh info        # Zeigt Node-Version, PID, RAM/CPU, LAN-IP, Tailscale-IP, Roaming-DoH & Cloudflare-Tunnel
./manage.sh status      # Prüft den Systemd-/Container-Dienststatus im Detail
./manage.sh logs        # Streamt die Live-Logs des Admin-Panels & Cloudflare-Tunnels
./manage.sh uninstall   # Stoppt Dienste, entfernt Container/Systemd & bereinigt das System (mit [y/N] Abfrage)
```

---

## 🔁 Lückenlose 1:1 Bidirektionale AdGuard Home Integration

Das Panel spiegelt **AdGuard Home** (`192.168.178.67:3001`) bidirektional in Echtzeit mit lokalem 0ms SQLite/JSON-Cache:
1. **Live Query-Log & Traffic-Streamer (`/control/querylog` + SSE `/api/adguard/stream`):**
   - Echtzeit-DNS-Stream mit Status-Farbcodes: 🟢 *Durchgelassen (Allowed)*, 🔴 *Blockiert (Blocked)*, 🟡 *Umgeschrieben (Rewritten)*, 🔵 *Blockierter Dienst (Service Blocked)*.
   - **1-Klick Quick Actions direkt im Log:** Rote Domains mit einem Klick auf die Whitelist setzen (`@@||domain^$important`), grüne Domains sofort sperren (`||domain^$important`), oder nach einzelnem Gerät filtern.
2. **DNS-Sperrlisten & Freigabelisten (`/control/filtering/status`, `add_url`, `set_url`, `refresh`):**
   - Volle Verwaltung aller Blocklists (*AdGuard DNS Filter*, *HaGeZi Multi PRO*, *HaGeZi NSFW*) und Allowlists inkl. 1-Klick Auto-Update.
3. **Custom Rules Editor & Visual Rule Builder (`/control/filtering/set_rules`):**
   - Dark/Matrix Code-Editor mit Syntax-Validierung + Einsteiger-Formular für Smartphone-Bedienung (inkl. `$client='192.168.178.x'`).
4. **Gesperrte Dienste Suite (`/control/blocked_services/list` & `set`):**
   - 27 native Dienste in 4 Kategorien (*Social Media*, *Streaming & Video*, *Gaming*, *Messenger*) – schaltbar **Global** oder **Geräte-spezifisch**.
5. **DNS-Umschreibungen (`/control/rewrite/list`, `add`, `delete`):**
   - Lokale Split-DNS-Routen (`admin.labtoso.de`, `proxmox.home`, `zimaos.home`, `adguard.home`, `fritz.home`).
6. **Statistiken & Upstream-DNS Latenzen (`/control/stats`):**
   - Zeitraffer (`24h`, `7d`, `30d`, `90d`), Top blockierte Domains, Top Clients und Live-Ping zu Cloudflare DoH, Quad9 DoT, Mullvad DoH & FRITZ!Box rDNS.

---

## 📵 Anti-Bypass-Engine: Sperren außerhalb des WLANs (5G / LTE / Hotspot-Schutz)

Damit Sperren (TikTok, Roblox, Fortnite, Zeitlimits, Nachtruhe) nicht durch Ausschalten des WLANs oder über mobile Hotspots umgangen werden können:
- **Apple iOS / iPadOS / macOS (`.mobileconfig`):**
  - Generiert unter `/api/profiles/{client_id}/mobileconfig` ein signiertes Apple Configuration Profile mit `DNS-over-HTTPS` (`https://admin.labtoso.de/api/dns-query/{client_id}`) und `PayloadRemovalDisallowed = true` (*Unremovable / Always-On*).
- **Android 9+ (Privates DNS & QR-Code):**
  - Personalisierter DoT-Hostname `{client_id}.dot.labtoso.de` inkl. SVG-QR-Code im Panel.
- **Dynamic DoH Policy Resolver (`/api/dns-query/[clientId]`):**
  - Prüft jede Anfrage unterwegs gegen Notfall-Kill-Switch, Schlafenszeit, 24/7-Wochenraster, Tageskontingent und 1-Klick-App-Sperren.

---

## 🎨 Visueller Blocking-Site Editor (Custom Block Page Studio) & Mobile-First PWA

- **Modus A (External Redirect):** Leitet gesperrte Aufrufe auf eine frei wählbare URL (z. B. Wikipedia oder Lernportal) um.
- **Modus B (Self-Built Blocking Page Studio + Code-Tab):**
  - Split-View mit Live-Smartphone- & Desktop-Vorschau im gewählten Theme.
  - Dynamische Variablen: `{domain}`, `{client_name}`, `{time_remaining}`, `{curfew_reason}`.
  - Live-Countdown-Timer & **„Zugang anfordern“-Button**: Sendet eine Echtzeit-Anfrage ans Admin-Smartphone (*„Jonas bittet um 30 Min Freigabe für YouTube“*), die mit einem Fingertipp (`+15 Min`, `+30 Min`, `Bis morgen`) genehmigt werden kann.
- **Mobile-First & 100 % PWA-Ready:**
  - Feste Daumen-Bottom-Navigationbar (*Dashboard*, *AdGuard*, *Geräte*, *Regeln*, *Studio*, *Settings*) sowie 🛑 **Notfall-Kill-Switch (Pause All)** und 🌙 **Schlafenszeit (Bedtime)** direkt im Header.

---

## 🎨 5 Integrierte Dark-Themes & Live-Canvas-Backdrops

Reines Dark-Mode-Design (`#050505` / `#0a0a0a`) mit feinen `1px`-Borders, `Geist Sans` & `JetBrains Mono` und 60-FPS `requestAnimationFrame` Canvas-Hintergründen (pausiert automatisch bei `document.hidden`):

1. **Midnight Obsidian (`[1]`):** Minimalistisches Carbon-Schwarz, Eisblau-Akzente (`#38BDF8`) und fließende Threadlines-Code-Ströme mit 3D-Parallaxe.
2. **Matrix – The Digital Rain (`[2]`):** Tiefschwarzer Hintergrund mit fallenden Katakana- & Hex-Glyphen in Phosphor-Grün (`#00FF66`).
3. **Cyber-Terminal / Amber (`[3]`):** Vintage-Hacker-Phosphor-Bernstein (`#FFB000`) mit subtilen CRT-Scanlines und taktischem ASCII-Vektor-Grid.
4. **Neon Tokyo / Synth-Pulse (`[4]`):** Tiefes Nachtviolett mit pulsierendem Cyan/Magenta-Partikel-Mesh.
5. **Bioluminescence (`[5]`):** Dunkler Tiefsee-Look mit organischen Lichtsporen und Smaragd-/Teal-Strömungen (`#10B981`).

---

## 🔐 Cloudflare Zero Trust & Google OAuth Einrichtung (`admin.labtoso.de`)

Das Panel ist über **Cloudflare Access (Zero Trust)** geschützt und lässt über eine **Hard Access-Policy** ausschließlich **`sebirauch2022@gmail.com`** zu.

### Schritt 1: Cloudflare Tunnel (`cloudflared`) anlegen
1. Öffne das [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) ➔ **Networks** ➔ **Tunnels**.
2. Klicke auf **Create a tunnel** ➔ Typ **Cloudflared** ➔ Name: `labtoso-network-admin`.
3. Kopiere das **Tunnel Token** (`eyJhIjoi...`) und gib es beim Proxmox-Installer ein (oder trage es als `CLOUDFLARE_TUNNEL_TOKEN=...` in `/opt/network/.env` ein).
4. Lege unter **Public Hostname** folgende Route an:
   - **Subdomain:** `admin`
   - **Domain:** `labtoso.de`
   - **Service Type:** `HTTP`
   - **URL:** `localhost:3000` (bzw. `network-admin:3000` bei Docker Compose)

### Schritt 2: Google OAuth als Login-Provider einrichten
1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) ➔ **APIs & Services** ➔ **Credentials**.
2. Erstelle eine **OAuth 2.0 Client ID** (Web Application):
   - **Authorized JavaScript origins:** `https://<dein-team-name>.cloudflareaccess.com`
   - **Authorized redirect URIs:** `https://<dein-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
3. Trage **Client ID** und **Client Secret** in Cloudflare Zero Trust unter **Settings** ➔ **Authentication** ➔ **Login methods** ➔ **Add new** ➔ **Google** ein.

### Schritt 3: Hard Access-Policy für `sebirauch2022@gmail.com` aktivieren
1. Gehe in Cloudflare Zero Trust auf **Access** ➔ **Applications** ➔ **Add an application** ➔ **Self-hosted**.
2. **Application Configuration:**
   - **Application name:** `Labtoso Network Control Center`
   - **Application domain:** `admin.labtoso.de`
3. **Identity Providers:** Wähle **Google** aus.
4. **Policy:**
   - **Policy name:** `Owner Only (Hard Lock)`
   - **Action:** `Allow`
   - **Include Rule:** Selector `Emails` ➔ Value: `sebirauch2022@gmail.com`
5. Speichern. Das Backend validiert bei jedem Request automatisch den signierten Cloudflare-Header `Cf-Access-Authenticated-User-Email` sowie `Cf-Access-Jwt-Assertion` gegen `sebirauch2022@gmail.com`.

---

## 🐳 Docker Compose Deployment (Alternativ zu Systemd)

```bash
cp .env.example .env
# CLOUDFLARE_TUNNEL_TOKEN in .env eintragen
docker compose up -d --build
```
