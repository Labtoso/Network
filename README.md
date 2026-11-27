# Network · AdGuard Admin-Panel

Steuerzentrale fuer AdGuard Home: Live-Query-Log, Filterlisten, eigene Regeln, gesperrte Dienste, Rewrites, Roaming-Schutz per DoH/DoT im Mobilfunk und ein Studio fuer die eigene Sperrseite. Login nur mit Google, freigeschaltet ist ausschliesslich `sebirauch2022@gmail.com`.

```
 Browser ──► https://admin.labtoso.de (GitHub Pages, statisch, out/)
    │
    └─ API (Bearer-JWT, CORS) ──► https://labtoso.duckdns.org
                                     │  Caddy: Let's Encrypt per DuckDNS DNS-01
                                     ├─ /api/*, /dns-query/*, /blocked ──► Node-Backend :8787 (Fastify, SQLite)
                                     │                                        └─► AdGuard Home (LAN) /control/* und /dns-query/<id>
                                     └─ alles andere ──► out/ (dasselbe Panel lokal, ohne GitHub)
 Android ──► <clientid>.labtoso.duckdns.org:853 (DoT, Node) ──► AdGuard
 iPhone  ──► https://labtoso.duckdns.org/dns-query/<clientid> (DoH) ──► AdGuard
 Fallback ──► https://network.<tailnet>.ts.net (Tailscale-HTTPS)
```

## Inhalt

| Pfad | Zweck |
| --- | --- |
| `install.sh` | Proxmox-One-Click: legt Debian-12-LXC an, Terminal-Assistent, ruft `manage.sh install` |
| `manage.sh` | CLI: `install`, `uninstall`, `update`, `info`, `status`, `logs`, `setup`, `duckdns` |
| `Caddyfile` | HTTPS fuer `*.duckdns.org` (DNS-01), Reverse-Proxy, Sperrseite auf Port 80 |
| `duckdns-update.sh` | IP-Updater, laeuft per systemd-Timer alle 5 Minuten |
| `prisma/schema.prisma` | SQLite-Modell (Einstellungen, Roaming-Geraete, Freigaben, Sperrcache, Latenz, Audit) |
| `server/` | Backend: Google-Auth, AdGuard-Client, SSE-Stream, DoH/DoT, `.mobileconfig`, Sperrseite |
| `lib/canvas/` | Die fuenf Threadlines-Canvas-Animationen |
| `src/` | Next.js-Frontend (Static Export nach `out/`) |
| `.github/workflows/deploy.yml` | Build und Deployment auf GitHub Pages bei jedem Push auf `main` |

## Installation

### 1. Vorbereitung (einmalig)

1. **DuckDNS:** auf <https://www.duckdns.org> einloggen, Subdomain `labtoso` anlegen, Token kopieren.
2. **Google OAuth:** in der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) eine OAuth-Client-ID vom Typ *Webanwendung* anlegen. Unter *Autorisierte JavaScript-Quellen* eintragen:
   - `https://admin.labtoso.de`
   - `https://labtoso.duckdns.org`
   - optional `https://network.<tailnet>.ts.net`
   Eine Weiterleitungs-URI ist nicht noetig (Google Identity Services, ID-Token im Browser).
3. **Router:** TCP **443** (HTTPS + DoH) und TCP **853** (DoT) an die IP des LXC weiterleiten. Port 80 braucht es nur fuer eine eigene Backend-Domain.

### 2. Proxmox: ein Befehl im Host-Terminal

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
```

Das Skript erstellt einen unprivilegierten Debian-12-LXC mit Nesting und TUN-Device, fragt DuckDNS-Domain und Token, Tailscale-Key (optional), AdGuard-Adresse und Zugangsdaten sowie die Google-Client-ID ab, schreibt `/opt/network/.env` (Rechte 600, Geheimnisse per `openssl rand`) und fuehrt `./manage.sh install` aus. Am Ende stehen alle Links im Terminal.

Laeuft das Skript nicht auf einem Proxmox-Host, installiert es direkt in das aktuelle Debian/Ubuntu-System nach `/opt/network`.

### 3. AdGuard Home anpassen

| Einstellung | Wert | Warum |
| --- | --- | --- |
| *Einstellungen → DNS → Blockmodus* | Benutzerdefinierte IP = IP des LXC | Gesperrte Domains landen auf der eigenen Sperrseite |
| `AdGuardHome.yaml` → `tls:` → `allow_unencrypted_doh: true` | danach AdGuard neu starten | Das Backend reicht DoH/DoT mit ClientID an AdGuard weiter |

Der Setup-Assistent im Panel prueft beides und zeigt an, was fehlt.

### 4. GitHub Pages mit admin.labtoso.de

1. Repository → *Settings → Pages → Source*: **GitHub Actions**.
2. Unter *Custom domain* `admin.labtoso.de` eintragen und *Enforce HTTPS* aktivieren.
3. Beim DNS von `labtoso.de`: `admin` als **CNAME** auf `labtoso.github.io`.
4. Push auf `main` startet `.github/workflows/deploy.yml`. Der Build baut die Backend-Adresse `https://labtoso.duckdns.org` fest ein, das Panel verbindet sich also automatisch.

Repository-Variablen (*Settings → Secrets and variables → Actions → Variables*), alle optional:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `NETWORK_API_BASE` | `https://labtoso.duckdns.org` | Backend-Adresse, die ins Frontend gebaut wird |
| `NETWORK_PAGES_DOMAIN` | `admin.labtoso.de` | Inhalt der `CNAME`-Datei |
| `NETWORK_BASE_PATH` | leer | Nur ohne eigene Domain: `/Network` |

## manage.sh

```bash
cd /opt/network
./manage.sh install     # System, Node 22, Caddy+DuckDNS, Tailscale, Build, systemd
./manage.sh update      # git pull, npm ci, prisma migrate deploy, Build, Neustart (Rollback bei Build-Fehler)
./manage.sh info        # Versionen, Dienste mit PID/RAM/CPU/Uptime, lokale IP, Tailscale-IP, DuckDNS-Sync, Git
./manage.sh status      # systemctl status
./manage.sh logs        # Live-Logs Backend (caddy | duckdns | all)
./manage.sh setup       # Terminal-Assistent erneut, schreibt .env und startet neu
./manage.sh duckdns     # IP sofort aktualisieren
./manage.sh uninstall   # alles entfernen, jede Stufe mit [y/N]
```

Dienste: `network-admin.service` (Backend), `caddy.service`, `network-duckdns.timer`.

## Funktionen

- **Dashboard:** Schutz an/aus/pausieren, Statistik, 24-Std-Diagramm, Top-Listen, Systemzustand (AdGuard, DuckDNS, DoT-Zertifikat, Offline-Cache, Upstream-Latenz), offene Freigabe-Anfragen, Roaming-Warnungen.
- **Live-Query-Log:** Server-Sent Events, ein Poller fuer alle Verbindungen, Filter, Pause, Details, 1-Klick sperren/erlauben.
- **Regeln:** Filterlisten (an/aus, hinzufuegen, entfernen, Auto-Update-Intervall, sofort aktualisieren), Editor fuer eigene Regeln mit Zeilennummern, Syntax-Highlighting und Lint, visueller Rule-Builder, Domain-Pruefung, gesperrte Dienste global und pro Geraet mit Freizeit-Zeitplan, DNS-Rewrites.
- **Geraete:** AdGuard-Clients bearbeiten (Kennungen, Filter, Jugendschutz, SafeSearch, Dienste, Upstreams, Tags), erkannte Geraete uebernehmen, Roaming-Geraete mit eigener ClientID.
- **Anti-Bypass:** `.mobileconfig` fuer iOS/macOS (DoH, signiert mit dem Let's-Encrypt-Zertifikat, sobald es existiert), QR-Code und Hostname fuer Android *Privates DNS* (DoT), Offline-Durchsetzung der letzten Sperren, Warnung bei Geraeten ohne DoH/DoT-Kontakt seit 24 Std.
- **Block-Page-Studio:** Redirect-Modus oder eigene Seite mit Live-Vorschau (Mobil/Desktop), Variablen `{domain}`, `{client_name}`, `{time_remaining}`, Live-Countdown, Button "Zugang anfordern", Experten-Modus mit eigenem HTML/Tailwind.
- **Freigaben:** Anfrage von der Sperrseite → Dashboard → Freigabe fuer 15 Min / 1 Std / 4 Std mit einem Tipp. Die Ausnahme-Regel wird nach Ablauf automatisch entfernt. Optional Push per ntfy/Webhook.
- **Themes:** Matrix, Cyber-Terminal, Midnight Obsidian, Neon Tokyo, Bioluminescence. Canvas mit 60 FPS, reagiert auf Maus, Touch und Taps, pausiert im Hintergrund, respektiert *reduzierte Bewegung*.
- **PWA:** Manifest, Icons, Service Worker, feste Daumen-Navigation unten.

## Technische Entscheidungen

Bewusst anders als in der urspruenglichen Vorgabe, mit Grund:

1. **Login per Bearer-Token statt Session-Cookie.** Frontend (`admin.labtoso.de`) und Backend (`labtoso.duckdns.org`) sind verschiedene Sites. Ein Session-Cookie waere ein Third-Party-Cookie, das Safari und zunehmend Chrome blockieren. Das Backend prueft das Google-ID-Token mit `google-auth-library` (Signatur, Audience, Ablauf, `email_verified`, E-Mail-Whitelist) und gibt ein eigenes HS256-JWT (12 Std) zurueck. Die Whitelist wird bei jedem Request erneut geprueft.
2. **Caddy mit DuckDNS-Modul.** Das Standard-Caddy kann kein DuckDNS-DNS-01. `manage.sh` laedt deshalb einen Build mit `github.com/caddy-dns/duckdns` vom offiziellen Caddy-Download-Dienst (kein Go/xcaddy auf dem LXC noetig). DNS-01 liefert auch das Wildcard-Zertifikat, das Android-DoT mit ClientID im Hostnamen braucht.
3. **DoH/DoT ueber das Backend statt Caddy direkt zu AdGuard.** So kennt das Panel jedes Roaming-Geraet (zuletzt gesehen, Protokoll), kann es sperren und bei AdGuard-Ausfall die letzten Sperren selbst durchsetzen. Die eigentliche Filterung macht weiter AdGuard ueber `/dns-query/<clientid>`.
4. **Signierte `.mobileconfig` nur mit Zertifikat.** Signiert wird mit dem Let's-Encrypt-Zertifikat der Domain. Fehlt es noch, wird unsigniert ausgeliefert; iOS zeigt dann "Nicht verifiziert", das Profil funktioniert trotzdem.
5. **Grenzen der Anti-Bypass-Engine (ehrlich):** Auf nicht betreuten iPhones kann ein Profil immer entfernt werden; `ProhibitDisablement`/`PayloadRemovalDisallowed` greifen erst mit Apple Configurator oder MDM. Android *Privates DNS* laesst sich ohne Family Link/Device Owner in den Einstellungen aendern. Das Panel erkennt solche Faelle ueber die 24-Std-Warnung, verhindern kann es sie technisch nicht.
6. **Sperrseite nur per HTTP.** Fuer fremde HTTPS-Domains hat niemand ein gueltiges Zertifikat. Bei `https://tiktok.com` zeigt der Browser daher einen Zertifikatsfehler statt der Sperrseite. Die Seite erscheint bei HTTP-Aufrufen und in Apps, die HTTP nutzen.
7. **`{time_remaining}`** kommt aus dem AdGuard-Zeitplan des Geraets: In AdGuard beschreibt der Zeitplan, wann die Dienst-Sperre pausiert. Die Restzeit ist die Zeit bis zum naechsten Freizeit-Fenster. Ohne Zeitplan: "unbestimmt".
8. **Backend laeuft als root im unprivilegierten LXC:** Port 853 und Lesezugriff auf Caddys Zertifikate. Der Container-root ist auf dem Proxmox-Host ein unprivilegierter Benutzer; der Dienst laeuft mit `NoNewPrivileges`, `ProtectSystem=full`, `PrivateTmp`.
9. **Tailscale als Fallback** nutzt Caddys eingebaute Tailscale-Zertifikate (`*.ts.net`). Dafuer muss im Tailnet *HTTPS Certificates* aktiviert sein; `manage.sh` setzt `TS_PERMIT_CERT_UID=caddy`.

## API (Auszug)

Alle Pfade unter `/api` ausser `public/*`, `health` und `auth/google` brauchen `Authorization: Bearer <token>`.

| Methode | Pfad | |
| --- | --- | --- |
| POST | `/api/auth/google` | `{credential}` → `{token, expiresAt, email}`; 403 bei fremdem Account |
| GET | `/api/dashboard` | Status, Statistik, DuckDNS, DoT, Roaming, Latenz |
| GET | `/api/querylog/stream` | SSE: `snapshot`, `entries`, `upstream-error` |
| POST | `/api/quick-rule` | `{domain, action, client?}` (action: block oder allow) |
| GET/POST/PATCH | `/api/filters`, `/api/filters/remove`, `/api/filters/refresh`, `/api/filters/config` | Filterlisten |
| GET/PUT | `/api/rules`, POST `/api/rules/check` | Benutzerregeln |
| GET/PUT | `/api/services` | Dienste global inkl. Zeitplan |
| GET/POST/PUT | `/api/clients`, PATCH `/api/clients/:name/services` | Clients |
| GET/POST/PUT | `/api/rewrites`, POST `/api/rewrites/delete` | Rewrites |
| GET/POST | `/api/roaming`, `/api/roaming/devices`, `/api/roaming/devices/:id/profile-link` | Roaming |
| GET/PUT | `/api/blockpage`, POST `/api/blockpage/preview` | Studio |
| GET/POST | `/api/access-requests`, `/:id/approve`, `/:id/deny` | Freigaben |
| GET/POST | `/dns-query/:clientId` | DoH nach RFC 8484 |

## Entwicklung

```bash
npm ci
cp .env.example .env          # DATABASE_URL auf eine lokale Datei setzen
npx prisma migrate deploy
npm run dev:server            # Backend auf :8787
NEXT_PUBLIC_API_BASE=http://localhost:8787 npm run dev   # Frontend auf :3000 (CORS_ORIGINS um http://localhost:3000 ergaenzen)
npm run typecheck
npm run build                 # dist-server/ + out/
```

## Lizenz

MIT
