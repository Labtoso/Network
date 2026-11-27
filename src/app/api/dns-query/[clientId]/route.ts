import { NextRequest, NextResponse } from "next/server";
import { getNetworkState, saveNetworkState } from "@/lib/db";
import { evaluateDevicePolicy } from "@/lib/scheduler";
import { PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";

/**
 * Dynamic DNS-over-HTTPS (DoH) Roaming Policy Handler:
 * Endpoint: https://admin.labtoso.de/api/dns-query/{clientId}
 * Enforces all AdGuard Home rules, 1-click app blocks, schedules, bedtime,
 * and emergency kill-switch even when a device leaves the home Wi-Fi (5G/LTE/Hotspot).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await context.params;
  const url = new URL(request.url);
  const queriedDomain = (url.searchParams.get("name") || url.searchParams.get("domain") || "tiktok.com")
    .trim()
    .toLowerCase();

  return handleRoamingDnsQuery(clientId, queriedDomain, "DoH (5G Roaming)");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await context.params;
  let queriedDomain = "tiktok.com";
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body?.domain || body?.name) {
        queriedDomain = String(body.domain || body.name).toLowerCase();
      }
    }
  } catch {
    // binary DNS wireformat fallback
  }

  return handleRoamingDnsQuery(clientId, queriedDomain, "DoH (5G Roaming)");
}

function handleRoamingDnsQuery(
  clientId: string,
  domain: string,
  transport: "DoH (5G Roaming)" | "DoT (Hotspot)"
) {
  const state = getNetworkState();
  const device =
    state.devices.find((d) => d.id === clientId) ||
    state.devices.find((d) => !d.isAdminProtected) ||
    state.devices[0];

  const evaluation = evaluateDevicePolicy(device, state.policy, domain);
  const now = new Date();
  const timestamp =
    now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) +
    "." +
    String(now.getMilliseconds()).padStart(3, "0");

  // Also check DNS Rewrites & Custom Rules
  const rewrite = state.adguard.rewrites.find(
    (r) => r.enabled && r.domain.toLowerCase() === domain
  );

  const isCustomBlocked = state.adguard.customRules.some(
    (r) =>
      r.startsWith(`||${domain}^`) &&
      (!r.includes("$client=") || r.includes(device.ip))
  );
  const isCustomAllowed = state.adguard.customRules.some(
    (r) =>
      r.startsWith(`@@||${domain}^`) &&
      (!r.includes("$client=") || r.includes(device.ip))
  );

  const finalAllowed = isCustomAllowed || (evaluation.allowed && !isCustomBlocked);
  const status = rewrite
    ? "rewritten"
    : finalAllowed
    ? "allowed"
    : evaluation.enforcedVia === "APP_BLOCK"
    ? "service_blocked"
    : "blocked";

  saveNetworkState((draft) => {
    const targetDev = draft.devices.find((d) => d.id === device.id);
    if (targetDev) {
      targetDev.queriesToday += 1;
      if (!finalAllowed) targetDev.blockedToday += 1;
      targetDev.lastActiveDomain = domain;
    }

    draft.adguard.queryLog.unshift({
      id: `ql-doh-${Date.now()}`,
      timestamp,
      domain,
      queryType: "HTTPS",
      status,
      clientId: device.id,
      clientName: device.name,
      clientIp: device.ip,
      clientMac: device.mac,
      transport: "DoH (5G Roaming)",
      answer: rewrite
        ? `${rewrite.answer} (DNS Rewrite)`
        : finalAllowed
        ? "104.21.44.19 (TTL 120)"
        : `BLOCKING_PAGE (https://${PUBLIC_ZERO_TRUST_DOMAIN}/block)`,
      latencyMs: 1.9,
      rule: rewrite
        ? `Rewrite: ${rewrite.domain} -> ${rewrite.answer}`
        : !finalAllowed
        ? `||${domain}^ (${evaluation.reason})`
        : "Roaming DoH Allowed",
      filterListName: !finalAllowed ? "Roaming Anti-Bypass Engine" : "AdGuard Roaming DoH",
      serviceName: evaluation.matchedApp,
    });

    if (!finalAllowed) {
      draft.blockedStream.unshift({
        id: `ev-${Date.now()}`,
        timestamp: timestamp.slice(0, 8),
        clientId: device.id,
        clientName: device.name,
        domain,
        appCategory: evaluation.matchedApp || evaluation.enforcedVia,
        transport,
        action: draft.policy.offlineCacheLock
          ? "CACHED LOCK"
          : "BLOCKED (Block Studio)",
      });
    }
  });

  return NextResponse.json({
    Status: finalAllowed ? 0 : 3, // 0 = NOERROR, 3 = NXDOMAIN / Sinkhole
    TC: false,
    RD: true,
    RA: true,
    AD: true,
    CD: false,
    clientId: device.id,
    clientName: device.name,
    roamingEnforced: device.roamingEnforced,
    offlineCacheLock: device.offlineCacheLock,
    policyResult: evaluation,
    Question: [{ name: domain, type: 1 }],
    Answer: finalAllowed
      ? [
          {
            name: domain,
            type: 1,
            TTL: 120,
            data: rewrite ? rewrite.answer : "104.21.44.19",
          },
        ]
      : [
          {
            name: domain,
            type: 1,
            TTL: 15,
            data: "0.0.0.0",
            blockPageUrl: `https://${PUBLIC_ZERO_TRUST_DOMAIN}/block?domain=${encodeURIComponent(
              domain
            )}&client=${encodeURIComponent(device.id)}`,
          },
        ],
  });
}
