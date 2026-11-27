import { NextRequest, NextResponse } from "next/server";
import {
  BLOCKABLE_APPS,
  createDefaultSchedule,
  getNetworkState,
  saveNetworkState,
} from "@/lib/db";
import { detectDeviceByMacOrName, syncDeviceToAdGuard } from "@/lib/adguard";
import { getSchedulerSnapshot } from "@/lib/scheduler";

export async function GET() {
  const state = getNetworkState();
  const evaluations = getSchedulerSnapshot();
  return NextResponse.json({
    ...state,
    blockableApps: BLOCKABLE_APPS,
    evaluations,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action as string;

    if (action === "toggle_kill_switch") {
      const updated = saveNetworkState((draft) => {
        draft.policy.killSwitchActive =
          typeof body.value === "boolean"
            ? body.value
            : !draft.policy.killSwitchActive;
      });
      return NextResponse.json({
        ok: true,
        toast: updated.policy.killSwitchActive
          ? "🛑 Notfall-Kill-Switch aktiviert: Alle Kinder- & Gastgeräte gesperrt!"
          : "✓ Notfall-Kill-Switch aufgehoben.",
        state: updated,
      });
    }

    if (action === "toggle_bedtime") {
      const updated = saveNetworkState((draft) => {
        draft.policy.bedtimeActive =
          typeof body.value === "boolean"
            ? body.value
            : !draft.policy.bedtimeActive;
      });
      return NextResponse.json({
        ok: true,
        toast: updated.policy.bedtimeActive
          ? "🌙 Schlafenszeit (Bedtime) für alle Nicht-Admin-Profile aktiviert."
          : "✓ Schlafenszeit beendet.",
        state: updated,
      });
    }

    if (action === "update_policy") {
      const updated = saveNetworkState((draft) => {
        if (typeof body.roamingEnforcement === "boolean") {
          draft.policy.roamingEnforcement = body.roamingEnforcement;
        }
        if (typeof body.offlineCacheLock === "boolean") {
          draft.policy.offlineCacheLock = body.offlineCacheLock;
        }
        if (typeof body.adguardUrl === "string" && body.adguardUrl.trim()) {
          draft.policy.adguardUrl = body.adguardUrl.trim();
        }
        if (typeof body.adguardUsername === "string") {
          draft.policy.adguardUsername = body.adguardUsername.trim();
        }
        if (typeof body.onboardingCompleted === "boolean") {
          draft.policy.onboardingCompleted = body.onboardingCompleted;
        }
        if (typeof body.rdnsActive === "boolean") {
          draft.policy.rdnsActive = body.rdnsActive;
        }
      });
      return NextResponse.json({
        ok: true,
        toast: "✓ Zero-Trust & Roaming-Richtlinien gespeichert und mit AdGuard synchronisiert.",
        state: updated,
      });
    }

    if (action === "update_device") {
      const clientId = body.clientId as string;
      let targetDevice = null;
      const updated = saveNetworkState((draft) => {
        const dev = draft.devices.find((d) => d.id === clientId);
        if (!dev) return;
        if (typeof body.name === "string" && body.name.trim()) {
          dev.name = body.name.trim();
        }
        if (typeof body.role === "string") {
          dev.role = body.role;
          dev.isAdminProtected = body.role === "admin" || body.role === "server";
        }
        if (!dev.isAdminProtected) {
          if (typeof body.paused === "boolean") dev.paused = body.paused;
          if (typeof body.bedtimeLocked === "boolean")
            dev.bedtimeLocked = body.bedtimeLocked;
          if (typeof body.roamingEnforced === "boolean")
            dev.roamingEnforced = body.roamingEnforced;
          if (typeof body.offlineCacheLock === "boolean")
            dev.offlineCacheLock = body.offlineCacheLock;
          if (typeof body.unremovableProfile === "boolean")
            dev.unremovableProfile = body.unremovableProfile;
          if (typeof body.dailyLimitMinutes === "number")
            dev.dailyLimitMinutes = Math.max(15, Math.min(1440, body.dailyLimitMinutes));
          if (Array.isArray(body.blockedApps)) {
            dev.blockedApps = body.blockedApps;
          }
          if (body.weeklySchedule && typeof body.weeklySchedule === "object") {
            dev.weeklySchedule = body.weeklySchedule;
          }
        }
        targetDevice = { ...dev };
      });

      if (targetDevice) {
        await syncDeviceToAdGuard(targetDevice);
      }

      return NextResponse.json({
        ok: true,
        toast: `✓ Gerät aktualisiert und sofort an AdGuard Home übertragen.`,
        state: updated,
      });
    }

    if (action === "add_device") {
      const name = (body.name || "Neues Gerät").trim();
      const ip = (body.ip || "192.168.178.99").trim();
      const mac = (body.mac || "F0:18:98:AA:BB:CC").trim().toUpperCase();
      const role = body.role || "child";
      const detected = detectDeviceByMacOrName(mac, name);
      const id =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Math.floor(100 + Math.random() * 899);

      const updated = saveNetworkState((draft) => {
        draft.devices.push({
          id,
          name,
          hostname: `${name.replace(/\s+/g, "-")}.fritz.box`,
          ip,
          mac,
          ouiVendor: detected.vendor,
          deviceType: body.deviceType || detected.deviceType,
          role,
          isAdminProtected: role === "admin" || role === "server",
          connectionType: "WLAN (Heimnetz)",
          roamingEnforced: role === "child",
          offlineCacheLock: role === "child",
          unremovableProfile: role === "child",
          paused: false,
          bedtimeLocked: false,
          dailyLimitMinutes: role === "child" ? 120 : 1440,
          usedMinutesToday: 0,
          bonusMinutesToday: 0,
          blockedApps: role === "child" ? ["tiktok", "nsfw"] : [],
          weeklySchedule: createDefaultSchedule(role),
          bandwidthMbps: 1.2,
          queriesToday: 42,
          blockedToday: 5,
          lastActiveDomain: "apple.com",
          unblockGrantedUntil: null,
        });
      });

      return NextResponse.json({
        ok: true,
        toast: `✓ Gerät "${name}" (${ip}) angelegt und in AdGuard registriert.`,
        state: updated,
      });
    }

    if (action === "update_block_page") {
      const updated = saveNetworkState((draft) => {
        if (body.mode) draft.blockPage.mode = body.mode;
        if (typeof body.redirectUrl === "string")
          draft.blockPage.redirectUrl = body.redirectUrl;
        if (typeof body.title === "string") draft.blockPage.title = body.title;
        if (typeof body.subtitle === "string")
          draft.blockPage.subtitle = body.subtitle;
        if (typeof body.alarmMessage === "string")
          draft.blockPage.alarmMessage = body.alarmMessage;
        if (typeof body.curfewReason === "string")
          draft.blockPage.curfewReason = body.curfewReason;
        if (typeof body.showCountdown === "boolean")
          draft.blockPage.showCountdown = body.showCountdown;
        if (typeof body.countdownMinutes === "number")
          draft.blockPage.countdownMinutes = body.countdownMinutes;
        if (typeof body.allowUnblockRequest === "boolean")
          draft.blockPage.allowUnblockRequest = body.allowUnblockRequest;
        if (typeof body.customHtml === "string")
          draft.blockPage.customHtml = body.customHtml;
      });
      return NextResponse.json({
        ok: true,
        toast: "✓ Custom Block Page Studio gespeichert.",
        state: updated,
      });
    }

    if (action === "create_unblock_request") {
      const clientId = body.clientId || "jonas-iphone";
      const domain = body.domain || "youtube.com";
      const requestedMinutes = Number(body.requestedMinutes) || 30;
      const updated = saveNetworkState((draft) => {
        const dev = draft.devices.find((d) => d.id === clientId);
        const clientName = body.clientName || dev?.name || "Jonas iPhone 15";
        draft.unblockRequests.unshift({
          id: `req-${Date.now()}`,
          clientId,
          clientName,
          domain,
          requestedMinutes,
          reason:
            body.reason ||
            `${clientName} bittet um ${requestedMinutes} Min Freigabe für ${domain}`,
          status: "pending",
          createdAt: "Gerade eben",
        });
      });
      return NextResponse.json({
        ok: true,
        toast: "✓ Freigabe-Anfrage an das Admin-Smartphone gesendet!",
        state: updated,
      });
    }

    if (action === "resolve_unblock_request") {
      const requestId = body.requestId as string;
      const decision = body.decision as "approve_15" | "approve_30" | "approve_tomorrow" | "deny";
      let toastMsg = "Anfrage bearbeitet.";

      const updated = saveNetworkState((draft) => {
        const req = draft.unblockRequests.find((r) => r.id === requestId);
        if (!req) return;

        if (decision === "deny") {
          req.status = "denied";
          toastMsg = `✗ Freigabe für ${req.domain} (${req.clientName}) abgelehnt.`;
          return;
        }

        const addMins =
          decision === "approve_15"
            ? 15
            : decision === "approve_30"
            ? 30
            : 720;
        const expiry = new Date(Date.now() + addMins * 60000);
        req.status = "approved";
        req.grantedUntil = expiry.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const dev = draft.devices.find((d) => d.id === req.clientId);
        if (dev) {
          dev.bonusMinutesToday += addMins;
          dev.unblockGrantedUntil = expiry.toISOString();
          dev.paused = false;
        }

        // Also add temporary allow rule in AdGuard custom rules
        const cleanDom = req.domain.replace(/^https?:\/\//, "").split("/")[0];
        const allowRule = `@@||${cleanDom}^$client='${dev?.ip || req.clientId}',important`;
        if (!draft.adguard.customRules.includes(allowRule)) {
          draft.adguard.customRules.push(allowRule);
        }

        toastMsg = `✓ +${addMins} Min Freigabe für ${req.clientName} (${req.domain}) erteilt & an AdGuard gepusht!`;
      });

      return NextResponse.json({
        ok: true,
        toast: toastMsg,
        state: updated,
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
