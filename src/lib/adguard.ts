import {
  BLOCKABLE_APPS,
  ClientDeviceProfile,
  DeviceCategory,
} from "@/lib/db";
import { getAdGuardConnection } from "@/lib/adguard-connection";
import type { AdGuardStatusResponse } from "@/lib/adguard-model";

const OUI_VENDOR_MAP: { prefix: string; vendor: string; type: DeviceCategory }[] = [
  { prefix: "F0:18:98", vendor: "Apple, Inc.", type: "apple" },
  { prefix: "BC:D0:74", vendor: "Apple, Inc.", type: "apple" },
  { prefix: "00:1C:B3", vendor: "Apple, Inc.", type: "apple" },
  { prefix: "50:85:69", vendor: "Samsung Electronics", type: "android" },
  { prefix: "28:39:5E", vendor: "Samsung Electronics", type: "android" },
  { prefix: "78:C8:81", vendor: "Sony Interactive (PlayStation)", type: "console" },
  { prefix: "A8:A1:59", vendor: "MSI / Predator Workstation", type: "pc" },
  { prefix: "00:E0:4C", vendor: "Realtek / ZimaOS Server", type: "pc" },
  { prefix: "38:8C:50", vendor: "LG Electronics (Smart TV)", type: "tv" },
];

export function detectDeviceByMacOrName(
  mac: string,
  name: string
): { vendor: string; deviceType: DeviceCategory } {
  const upperMac = (mac || "").toUpperCase();
  for (const item of OUI_VENDOR_MAP) {
    if (upperMac.startsWith(item.prefix)) {
      return { vendor: item.vendor, deviceType: item.type };
    }
  }
  const lower = (name || "").toLowerCase();
  if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("mac")) {
    return { vendor: "Apple, Inc.", deviceType: "apple" };
  }
  if (lower.includes("galaxy") || lower.includes("android") || lower.includes("pixel")) {
    return { vendor: "Android OEM", deviceType: "android" };
  }
  if (lower.includes("ps5") || lower.includes("xbox") || lower.includes("switch")) {
    return { vendor: "Gaming Console", deviceType: "console" };
  }
  if (lower.includes("tv") || lower.includes("oled") || lower.includes("firetv")) {
    return { vendor: "Smart TV", deviceType: "tv" };
  }
  if (lower.includes("pc") || lower.includes("predator") || lower.includes("zima")) {
    return { vendor: "Workstation / Server", deviceType: "pc" };
  }
  return { vendor: "Network Endpoint", deviceType: "iot" };
}

export async function checkAdGuardStatus(customUrl?: string, username?: string): Promise<AdGuardStatusResponse> {
  const { baseUrl, headers } = getAdGuardConnection(customUrl, username);
  if (!baseUrl) {
    return { connected: false, url: "", error: "Gib eine gültige HTTP- oder HTTPS-Adresse ein." };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/control/status`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      const error = headers.Authorization
        ? `AdGuard lehnt die hinterlegten Zugangsdaten ab (HTTP ${res.status}).`
        : `AdGuard verlangt Zugangsdaten (HTTP ${res.status}). Prüfe ADGUARD_URL, ADGUARD_USER und ADGUARD_PASSWORD in der Serverkonfiguration.`;
      return { connected: false, url: baseUrl, error };
    }
    if (!res.ok) {
      return { connected: false, url: baseUrl, error: `AdGuard-Statusabfrage fehlgeschlagen (HTTP ${res.status}).` };
    }
    const data = await res.json().catch(() => null);
    if (typeof data?.version !== "string" || typeof data.running !== "boolean") {
      return { connected: false, url: baseUrl, error: "Die Adresse liefert keinen gültigen AdGuard-Status." };
    }
    return {
      connected: true,
      version: data.version,
      dnsAddresses: Array.isArray(data.dns_addresses) ? data.dns_addresses : [],
      protectionEnabled: data.protection_enabled === true,
      running: data.running,
      latencyMs: Math.max(1, Date.now() - start),
      url: baseUrl,
    };
  } catch {
    return { connected: false, url: baseUrl, error: "AdGuard Home ist vom Panel-Server aus nicht erreichbar." };
  }
}

/**
 * Pushes updated client name & blocked_services array to AdGuard Home (`/control/clients/update`)
 */
export async function syncDeviceToAdGuard(device: ClientDeviceProfile): Promise<boolean> {
  const { baseUrl, headers } = getAdGuardConnection();
  if (!baseUrl) return false;
  const adguardServices = device.blockedApps
    .map((appId) => BLOCKABLE_APPS.find((a) => a.id === appId)?.adguardServiceId)
    .filter(Boolean);

  try {
    const response = await fetch(`${baseUrl}/control/clients/update`, {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(1600),
      body: JSON.stringify({
        name: device.name,
        data: {
          name: device.name,
          ids: [device.ip, device.mac, device.id].filter(Boolean),
          use_global_settings: false,
          filtering_enabled: true,
          use_global_blocked_services: false,
          blocked_services: adguardServices,
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
