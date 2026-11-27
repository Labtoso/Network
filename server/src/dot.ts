import { createSecureContext, createServer, type SecureContext, type TLSSocket } from "node:tls";
import { findCaddyCertificate, dotBaseHosts } from "./certs.js";
import { config } from "./config.js";
import { resolveDns } from "./dns.js";

/**
 * DNS-over-TLS (RFC 7858) fuer Android "Privates DNS".
 * Hostname auf dem Handy: <clientid>.<subdomain>.duckdns.org — die ClientID kommt per SNI.
 * Das Wildcard-Zertifikat stellt Caddy per DNS-01 (DuckDNS) aus; es wird hier nur gelesen.
 */
let context: SecureContext | null = null;
let loadedMtime = 0;
let lastLoadError: string | null = null;

function reloadContext(): void {
  const pair = findCaddyCertificate();
  if (!pair) {
    lastLoadError = `Kein Caddy-Zertifikat unter ${config.caddyCertDir} gefunden.`;
    return;
  }
  if (pair.mtimeMs === loadedMtime && context) return;
  try {
    context = createSecureContext({ cert: pair.certPem, key: pair.keyPem, minVersion: "TLSv1.2" });
    loadedMtime = pair.mtimeMs;
    lastLoadError = null;
  } catch (error) {
    lastLoadError = error instanceof Error ? error.message : String(error);
  }
}

export function dotStatus() {
  return { enabled: config.dotEnabled, port: config.dotPort, certificateLoaded: context !== null, error: lastLoadError };
}

function clientIdFromSni(servername: string | false | null | undefined): string | null {
  if (!servername) return null;
  const name = servername.toLowerCase();
  for (const base of dotBaseHosts()) {
    if (name.endsWith(`.${base}`)) {
      const label = name.slice(0, -(base.length + 1));
      if (label && !label.includes(".")) return label;
    }
  }
  return null;
}

function handleSocket(socket: TLSSocket): void {
  const clientId = clientIdFromSni(socket.servername);
  if (!clientId) {
    socket.destroy();
    return;
  }
  let buffer = Buffer.alloc(0);
  let pending = 0;
  socket.setTimeout(30_000, () => socket.end());
  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > 65_537 * 4) {
      socket.destroy();
      return;
    }
    while (buffer.length >= 2) {
      const length = buffer.readUInt16BE(0);
      if (buffer.length < 2 + length) break;
      const message = buffer.subarray(2, 2 + length);
      buffer = buffer.subarray(2 + length);
      pending += 1;
      void resolveDns(clientId, Buffer.from(message), "dot")
        .then((result) => {
          if (socket.destroyed) return;
          const header = Buffer.alloc(2);
          header.writeUInt16BE(result.body.length, 0);
          socket.write(Buffer.concat([header, result.body]));
        })
        .catch(() => socket.destroy())
        .finally(() => {
          pending -= 1;
        });
    }
  });
  socket.on("error", () => socket.destroy());
  socket.on("end", () => {
    if (pending === 0) socket.end();
  });
}

export function startDotServer(log: (message: string) => void): void {
  if (!config.dotEnabled) return;
  reloadContext();
  setInterval(reloadContext, 15 * 60_000).unref();
  const server = createServer(
    {
      SNICallback: (_servername, callback) => {
        if (!context) reloadContext();
        callback(context ? null : new Error("Kein Zertifikat"), context ?? undefined);
      },
    },
    handleSocket,
  );
  server.on("tlsClientError", () => undefined);
  server.on("error", (error) => log(`DoT-Server Fehler: ${error.message}`));
  server.listen(config.dotPort, "0.0.0.0", () => log(`DoT lauscht auf Port ${config.dotPort}`));
}
