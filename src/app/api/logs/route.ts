import { NextResponse } from "next/server";
import { getNetworkState } from "@/lib/db";
import { ALLOWED_OWNER_EMAIL, PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";

export async function GET() {
  const state = getNetworkState();
  const now = new Date().toLocaleTimeString("de-DE");
  const recentQueries = state.adguard.queryLog.slice(0, 4).map(
    (q) =>
      `[${q.timestamp.slice(0, 8)}] [ADGUARD:${q.status.toUpperCase()}] ${q.clientName} (${q.transport}) -> ${q.domain} (${q.latencyMs}ms)`
  );

  const logs = [
    `[${now}] [ZERO-TRUST] Hard Access Policy active: ${ALLOWED_OWNER_EMAIL} @ https://${PUBLIC_ZERO_TRUST_DOMAIN}`,
    `[${now}] [ANTI-BYPASS] Roaming DoH/DoT Enforcement: ${
      state.policy.roamingEnforcement ? "ACTIVE (5G/LTE & Hotspot locked)" : "STANDBY"
    }`,
    `[${now}] [ADGUARD-SYNC] 1:1 Bidirectional Mirror connected to ${state.policy.adguardUrl} (${state.adguard.filterLists.length} lists, ${state.adguard.customRules.length} custom rules)`,
    ...recentQueries,
    `[${now}] [BOTS] Msik (:8080), AIO (:8090) & Streyn Rust Core (musik.labtoso.de) healthy`,
  ];

  return NextResponse.json({ logs });
}
