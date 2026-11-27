import {
  BLOCKABLE_APPS,
  ClientDeviceProfile,
  GlobalPolicySettings,
  getNetworkState,
} from "@/lib/db";

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason: string;
  matchedApp?: string;
  remainingMinutes: number;
  enforcedVia: "ADMIN_WHITELIST" | "KILL_SWITCH" | "BEDTIME" | "QUOTA" | "SCHEDULE" | "APP_BLOCK" | "UNBLOCK_GRANT" | "ALLOWED";
}

const DAY_KEYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Evaluates whether a given device (and optional queried DNS domain)
 * is currently allowed or blocked according to all active Zero-Trust & Parental rules.
 */
export function evaluateDevicePolicy(
  device: ClientDeviceProfile,
  policy: GlobalPolicySettings,
  queriedDomain?: string,
  now: Date = new Date()
): PolicyEvaluationResult {
  // 1. Admin & Server Whitelist Protection (Never Blocked!)
  if (device.isAdminProtected || device.role === "admin" || device.role === "server") {
    return {
      allowed: true,
      reason: "Admin-Whitelist aktiv (Unblockierbar)",
      remainingMinutes: 1440,
      enforcedVia: "ADMIN_WHITELIST",
    };
  }

  // 2. Temporary Unblock Grant check (+15 Min / +30 Min / Bis morgen)
  if (device.unblockGrantedUntil) {
    const grantExpiry = new Date(device.unblockGrantedUntil).getTime();
    if (!isNaN(grantExpiry) && grantExpiry > now.getTime()) {
      const rem = Math.ceil((grantExpiry - now.getTime()) / 60000);
      return {
        allowed: true,
        reason: `Temporäre Admin-Freigabe aktiv (+${rem} Min verbleibend)`,
        remainingMinutes: rem,
        enforcedVia: "UNBLOCK_GRANT",
      };
    }
  }

  // 3. Global Emergency Kill-Switch or Per-Device Pause
  if (policy.killSwitchActive || device.paused) {
    return {
      allowed: false,
      reason: policy.killSwitchActive
        ? "Notfall-Kill-Switch (Alle Kinder-/Gastgeräte pausiert)"
        : `Gerät manuell pausiert (${device.name})`,
      remainingMinutes: 0,
      enforcedVia: "KILL_SWITCH",
    };
  }

  // 4. Global Bedtime / Curfew or Per-Device Bedtime Lock
  if (policy.bedtimeActive || device.bedtimeLocked) {
    return {
      allowed: false,
      reason: "Schlafenszeit / Nachtruhe aktiv (Bedtime Enforcement)",
      remainingMinutes: 0,
      enforcedVia: "BEDTIME",
    };
  }

  // 5. Weekly 24/7 Schedule Grid check
  const dayKey = DAY_KEYS[now.getDay()] || "Mo";
  const hour = now.getHours();
  const dayHours = device.weeklySchedule?.[dayKey];
  if (Array.isArray(dayHours) && dayHours[hour] === false) {
    return {
      allowed: false,
      reason: `Wochenzeitplan-Sperre (${dayKey} ${String(hour).padStart(2, "0")}:00 Uhr ist als Lern-/Ruhezeit markiert)`,
      remainingMinutes: 0,
      enforcedVia: "SCHEDULE",
    };
  }

  // 6. Daily Screen-Time Quota check
  const totalBudget = device.dailyLimitMinutes + device.bonusMinutesToday;
  const remainingMinutes = Math.max(0, totalBudget - device.usedMinutesToday);
  if (remainingMinutes <= 0) {
    return {
      allowed: false,
      reason: `Tageskontingent (${totalBudget} Min) aufgebraucht`,
      remainingMinutes: 0,
      enforcedVia: "QUOTA",
    };
  }

  // 7. 1-Click App Block domain inspection
  if (queriedDomain) {
    const cleanDomain = queriedDomain.toLowerCase().replace(/^\.+|\.+$/g, "");
    for (const appId of device.blockedApps) {
      const appDef = BLOCKABLE_APPS.find((a) => a.id === appId);
      if (!appDef) continue;
      const isMatch = appDef.domains.some(
        (d) => cleanDomain === d || cleanDomain.endsWith(`.${d}`)
      );
      if (isMatch) {
        return {
          allowed: false,
          reason: `1-Klick App-Sperre: ${appDef.name} ist für ${device.name} gesperrt`,
          matchedApp: appDef.name,
          remainingMinutes,
          enforcedVia: "APP_BLOCK",
        };
      }
    }
  }

  return {
    allowed: true,
    reason: "Zugriff erlaubt",
    remainingMinutes,
    enforcedVia: "ALLOWED",
  };
}

/**
 * Returns a full scheduler snapshot across all managed devices
 */
export function getSchedulerSnapshot() {
  const state = getNetworkState();
  const now = new Date();
  return state.devices.map((dev) => ({
    clientId: dev.id,
    name: dev.name,
    evaluation: evaluateDevicePolicy(dev, state.policy, dev.lastActiveDomain, now),
  }));
}
