import { NextResponse } from "next/server";
import { getNetworkState, saveNetworkState } from "@/lib/db";
import { AdGuardQueryLogEntry } from "@/lib/adguard-sync";

const LIVE_SAMPLE_DOMAINS: {
  domain: string;
  status: AdGuardQueryLogEntry["status"];
  clientId: string;
  transport: AdGuardQueryLogEntry["transport"];
  answer: string;
  rule?: string;
  filterListName?: string;
  serviceName?: string;
}[] = [
  {
    domain: "log16-normal-c-useast1a.tiktokv.com",
    status: "service_blocked",
    clientId: "jonas-iphone",
    transport: "DoH (5G Roaming)",
    answer: "BLOCKING_PAGE (192.168.178.67)",
    rule: "||tiktokv.com^",
    filterListName: "Blocked Service: TikTok",
    serviceName: "TikTok",
  },
  {
    domain: "gateway.discord.gg",
    status: "allowed",
    clientId: "predator-pc",
    transport: "UDP :53",
    answer: "162.159.135.234 (TTL 300)",
    rule: "Allowed",
    filterListName: "Upstream Cloudflare DoH",
  },
  {
    domain: "pagead2.googlesyndication.com",
    status: "blocked",
    clientId: "galaxy-s24",
    transport: "DoT (853)",
    answer: "0.0.0.0 (NXDOMAIN)",
    rule: "||googlesyndication.com^",
    filterListName: "HaGeZi Multi PRO",
  },
  {
    domain: "zimaos.home",
    status: "rewritten",
    clientId: "predator-pc",
    transport: "UDP :53",
    answer: "192.168.178.67 (DNS Rewrite)",
    rule: "Rewrite: zimaos.home -> 192.168.178.67",
    filterListName: "DNS Rewrites",
  },
  {
    domain: "client-telemetry.roblox.com",
    status: "service_blocked",
    clientId: "lena-ipad",
    transport: "UDP :53",
    answer: "BLOCKING_PAGE (192.168.178.67)",
    rule: "||roblox.com^$client='192.168.178.45'",
    filterListName: "Blocked Service: Roblox",
    serviceName: "Roblox",
  },
  {
    domain: "musik.labtoso.de",
    status: "allowed",
    clientId: "predator-pc",
    transport: "UDP :53",
    answer: "172.67.148.92 (Cloudflare Proxy)",
    rule: "@@||musik.labtoso.de^$important",
    filterListName: "Custom Rules",
  },
];

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let counter = 0;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (entry: AdGuardQueryLogEntry) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(entry)}\n\n`)
          );
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      };

      intervalId = setInterval(() => {
        const state = getNetworkState();
        const sample =
          LIVE_SAMPLE_DOMAINS[counter % LIVE_SAMPLE_DOMAINS.length];
        counter++;

        const dev =
          state.devices.find((d) => d.id === sample.clientId) ||
          state.devices[0];
        const now = new Date();
        const timeStr =
          now.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }) +
          "." +
          String(now.getMilliseconds()).padStart(3, "0");

        const entry: AdGuardQueryLogEntry = {
          id: `ql-live-${Date.now()}-${counter}`,
          timestamp: timeStr,
          domain: sample.domain,
          queryType: counter % 3 === 0 ? "HTTPS" : "A",
          status: sample.status,
          clientId: dev.id,
          clientName: dev.name,
          clientIp: dev.ip,
          clientMac: dev.mac,
          transport: sample.transport,
          answer: sample.answer,
          latencyMs: Number((0.8 + Math.random() * 4.5).toFixed(1)),
          rule: sample.rule,
          filterListName: sample.filterListName,
          serviceName: sample.serviceName,
        };

        saveNetworkState((draft) => {
          draft.adguard.queryLog = [
            entry,
            ...draft.adguard.queryLog.slice(0, 79),
          ];
        });

        sendEvent(entry);
      }, 3500);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
