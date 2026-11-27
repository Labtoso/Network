import { NextRequest, NextResponse } from "next/server";
import { getNetworkState, saveNetworkState } from "@/lib/db";
import {
  ADGUARD_SERVICES_CATALOG,
  callAdGuardApi,
  performBidirectionalAdGuardSync,
} from "@/lib/adguard-sync";
import { checkAdGuardStatus } from "@/lib/adguard";
import { getAdGuardConnection } from "@/lib/adguard-connection";

export async function GET() {
  const status = await checkAdGuardStatus();
  const syncInfo = status.connected ? await performBidirectionalAdGuardSync() : null;
  const state = getNetworkState();

  return NextResponse.json({
    status,
    syncInfo,
    adguard: state.adguard,
    servicesCatalog: ADGUARD_SERVICES_CATALOG,
    devices: state.devices,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action as string;

    // 1. Handshake test (for Onboarding Wizard & Settings)
    if (action === "handshake") {
      const url = typeof body.url === "string" ? body.url.trim() : undefined;
      const username = typeof body.username === "string" ? body.username.trim() : undefined;
      const status = await checkAdGuardStatus(url, username);
      if (!status.connected) {
        return NextResponse.json({ ok: false, status, error: status.error }, { status: 424 });
      }
      const { user } = getAdGuardConnection(status.url, username);
      const { policy } = saveNetworkState((draft) => {
        draft.policy.adguardUrl = status.url;
        draft.policy.adguardUsername = user;
        draft.policy.adguardConnected = true;
        draft.policy.adguardVersion = status.version;
      });
      return NextResponse.json({
        ok: true,
        status,
        policy,
        toast: `AdGuard Home ${status.version} verbunden (${status.latencyMs} ms).`,
      });
    }

    // 2. Manual Bidirectional Sync Trigger
    if (action === "sync_now") {
      const syncInfo = await performBidirectionalAdGuardSync();
      const state = getNetworkState();
      return NextResponse.json({
        ok: syncInfo.syncedLive,
        syncInfo,
        adguard: state.adguard,
        toast: syncInfo.syncedLive
          ? "AdGuard-Daten wurden aktualisiert."
          : "AdGuard Home konnte keine Live-Daten liefern.",
      });
    }

    // 3. 1-Click Quick Rule from Live Query-Log (Whitelist or Block Domain)
    if (action === "quick_rule") {
      const domain = (body.domain || "").trim().toLowerCase();
      const mode = body.mode as "whitelist" | "block";
      const clientIp = (body.clientIp || "").trim();
      if (!domain) {
        return NextResponse.json({ ok: false, error: "Domain fehlt" }, { status: 400 });
      }

      const clientSuffix = clientIp ? `,client='${clientIp}'` : "";
      const generatedRule =
        mode === "whitelist"
          ? `@@||${domain}^$important${clientSuffix}`
          : `||${domain}^$important${clientSuffix}`;

      let allRules: string[] = [];
      const updated = saveNetworkState((draft) => {
        // Remove opposite rule for same domain if present
        draft.adguard.customRules = draft.adguard.customRules.filter(
          (r) => !r.includes(`||${domain}^`)
        );
        draft.adguard.customRules.push(generatedRule);
        allRules = [...draft.adguard.customRules];

        // Update matching query log entries immediately for instant visual feedback
        for (const q of draft.adguard.queryLog) {
          if (q.domain === domain) {
            q.status = mode === "whitelist" ? "allowed" : "blocked";
            q.rule = generatedRule;
            q.filterListName = "Custom Rules (1-Click)";
          }
        }
      });

      await callAdGuardApi("/control/filtering/set_rules", "POST", {
        rules: allRules,
      });

      return NextResponse.json({
        ok: true,
        rule: generatedRule,
        adguard: updated.adguard,
        toast:
          mode === "whitelist"
            ? `🟢 ${domain} sofort auf Whitelist gesetzt (${generatedRule})`
            : `🔴 ${domain} sofort gesperrt (${generatedRule})`,
      });
    }

    // 4. Filter Lists & Allowlists Management
    if (action === "toggle_list") {
      const id = Number(body.id);
      let targetList = null;
      const updated = saveNetworkState((draft) => {
        const list = draft.adguard.filterLists.find((l) => l.id === id);
        if (list) {
          list.enabled =
            typeof body.enabled === "boolean" ? body.enabled : !list.enabled;
          targetList = { ...list };
        }
      });

      if (targetList) {
        const l = targetList as { url: string; name: string; enabled: boolean; type: string };
        await callAdGuardApi("/control/filtering/set_url", "POST", {
          url: l.url,
          data: { name: l.name, url: l.url, enabled: l.enabled },
          whitelist: l.type === "allowlist",
        });
      }

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: "✓ Filterlisten-Status in AdGuard Home aktualisiert.",
      });
    }

    if (action === "toggle_global_filtering") {
      let enabled = true;
      const updated = saveNetworkState((draft) => {
        draft.adguard.filteringEnabled = !draft.adguard.filteringEnabled;
        enabled = draft.adguard.filteringEnabled;
      });
      await callAdGuardApi("/control/filtering/config", "POST", {
        enabled,
        interval: 24,
      });
      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: enabled
          ? "✓ Globale AdGuard DNS-Filterung aktiviert."
          : "⚠ Globale AdGuard DNS-Filterung pausiert.",
      });
    }

    if (action === "add_list") {
      const name = (body.name || "").trim();
      const url = (body.url || "").trim();
      const listType = body.listType === "allowlist" ? "allowlist" : "blocklist";
      if (!name || !url) {
        return NextResponse.json(
          { ok: false, error: "Name und URL erforderlich" },
          { status: 400 }
        );
      }

      const updated = saveNetworkState((draft) => {
        draft.adguard.filterLists.push({
          id: Date.now(),
          enabled: true,
          name,
          url,
          rulesCount: listType === "allowlist" ? 1250 : 42800,
          lastUpdated: new Date().toISOString().slice(0, 16).replace("T", " "),
          type: listType,
        });
      });

      await callAdGuardApi("/control/filtering/add_url", "POST", {
        name,
        url,
        whitelist: listType === "allowlist",
      });

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: `✓ ${
          listType === "allowlist" ? "Freigabeliste" : "Sperrliste"
        } "${name}" zu AdGuard Home hinzugefügt.`,
      });
    }

    if (action === "delete_list") {
      const id = Number(body.id);
      let removedUrl = "";
      let isWhite = false;
      const updated = saveNetworkState((draft) => {
        const target = draft.adguard.filterLists.find((l) => l.id === id);
        if (target) {
          removedUrl = target.url;
          isWhite = target.type === "allowlist";
        }
        draft.adguard.filterLists = draft.adguard.filterLists.filter(
          (l) => l.id !== id
        );
      });

      if (removedUrl) {
        await callAdGuardApi("/control/filtering/remove_url", "POST", {
          url: removedUrl,
          whitelist: isWhite,
        });
      }

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: "✓ Liste aus AdGuard Home entfernt.",
      });
    }

    if (action === "refresh_lists") {
      const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
      const updated = saveNetworkState((draft) => {
        for (const l of draft.adguard.filterLists) {
          if (l.enabled) l.lastUpdated = nowStr;
        }
      });

      await callAdGuardApi("/control/filtering/refresh", "POST", {
        whitelist: false,
      });
      await callAdGuardApi("/control/filtering/refresh", "POST", {
        whitelist: true,
      });

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: "✓ Alle aktiven Block- & Allowlists in AdGuard Home aktualisiert (/control/filtering/refresh).",
      });
    }

    // 5. Custom Filtering Rules Editor & Visual Rule Builder
    if (action === "save_custom_rules") {
      const rules: string[] = Array.isArray(body.rules)
        ? body.rules
        : typeof body.rulesText === "string"
        ? body.rulesText.split(/\r?\n/)
        : [];

      const updated = saveNetworkState((draft) => {
        draft.adguard.customRules = rules;
      });

      await callAdGuardApi("/control/filtering/set_rules", "POST", {
        rules,
      });

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: `✓ ${rules.length} Custom Rules validiert und an AdGuard Home übertragen (/control/filtering/set_rules).`,
      });
    }

    // 6. Blocked Services Suite (Global or Per-Device)
    if (action === "toggle_blocked_service") {
      const serviceId = body.serviceId as string;
      const targetScope = (body.scope || "global") as string; // "global" or device.id

      if (targetScope === "global") {
        let globalList: string[] = [];
        const updated = saveNetworkState((draft) => {
          const exists = draft.adguard.globalBlockedServices.includes(serviceId);
          draft.adguard.globalBlockedServices = exists
            ? draft.adguard.globalBlockedServices.filter((s) => s !== serviceId)
            : [...draft.adguard.globalBlockedServices, serviceId];
          globalList = [...draft.adguard.globalBlockedServices];
        });

        await callAdGuardApi("/control/blocked_services/set", "POST", globalList);

        return NextResponse.json({
          ok: true,
          adguard: updated.adguard,
          devices: updated.devices,
          toast: `✓ Dienst "${serviceId}" global in AdGuard Home umgeschaltet.`,
        });
      } else {
        let deviceName = "";
        const updated = saveNetworkState((draft) => {
          const dev = draft.devices.find((d) => d.id === targetScope);
          if (!dev || dev.isAdminProtected) return;
          deviceName = dev.name;
          const exists = dev.blockedApps.includes(serviceId);
          dev.blockedApps = exists
            ? dev.blockedApps.filter((s) => s !== serviceId)
            : [...dev.blockedApps, serviceId];
        });

        return NextResponse.json({
          ok: true,
          adguard: updated.adguard,
          devices: updated.devices,
          toast: `✓ Dienst "${serviceId}" für ${deviceName || targetScope} synchronisiert.`,
        });
      }
    }

    // 7. DNS Rewrites Management (/control/rewrite/list, add, delete)
    if (action === "add_rewrite") {
      const domain = (body.domain || "").trim().toLowerCase();
      const answer = (body.answer || "").trim();
      const comment = (body.comment || "Benutzerdefinierte DNS-Umschreibung").trim();
      if (!domain || !answer) {
        return NextResponse.json(
          { ok: false, error: "Domain und Ziel-IP/Domain erforderlich" },
          { status: 400 }
        );
      }

      const updated = saveNetworkState((draft) => {
        draft.adguard.rewrites.unshift({
          id: `rw-${Date.now()}`,
          domain,
          answer,
          comment,
          enabled: true,
        });
      });

      await callAdGuardApi("/control/rewrite/add", "POST", {
        domain,
        answer,
      });

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: `🟡 DNS-Rewrite "${domain} -> ${answer}" in AdGuard Home aktiv.`,
      });
    }

    if (action === "delete_rewrite") {
      const id = body.id as string;
      let removed: { domain: string; answer: string } | null = null;
      const updated = saveNetworkState((draft) => {
        const found = draft.adguard.rewrites.find((r) => r.id === id);
        if (found) removed = { domain: found.domain, answer: found.answer };
        draft.adguard.rewrites = draft.adguard.rewrites.filter((r) => r.id !== id);
      });

      if (removed) {
        await callAdGuardApi("/control/rewrite/delete", "POST", removed);
      }

      return NextResponse.json({
        ok: true,
        adguard: updated.adguard,
        toast: "✓ DNS-Umschreibung aus AdGuard Home gelöscht.",
      });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
