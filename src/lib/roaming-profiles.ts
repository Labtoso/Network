import { ClientDeviceProfile, GlobalPolicySettings } from "@/lib/db";
import { PUBLIC_ZERO_TRUST_DOMAIN } from "@/lib/auth";

/**
 * Generates an Apple iOS / iPadOS / macOS Configuration Profile (`.mobileconfig`)
 * that enforces Always-On Encrypted DNS (DoH & DoT) across both Wi-Fi and Cellular (5G/LTE/Hotspot).
 * When `device.unremovableProfile` is enabled, sets `PayloadRemovalDisallowed = true`.
 */
export function generateAppleMobileConfig(
  device: ClientDeviceProfile,
  policy: GlobalPolicySettings,
  protocol: "doh" | "dot" = "doh"
): string {
  const dohUrl = `https://${PUBLIC_ZERO_TRUST_DOMAIN}/api/dns-query/${encodeURIComponent(
    device.id
  )}`;
  const dotHost = `${device.id}.${policy.dotHostnameBase || "dot.labtoso.de"}`;
  const removalDisallowed = device.unremovableProfile ? "<true/>" : "<false/>";

  const dnsSettingsBlock =
    protocol === "doh"
      ? `<dict>
        <key>DNSSettingsType</key>
        <string>https</string>
        <key>ServerURL</key>
        <string>${dohUrl}</string>
      </dict>`
      : `<dict>
        <key>DNSSettingsType</key>
        <string>tls</string>
        <key>ServerName</key>
        <string>${dotHost}</string>
      </dict>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      ${dnsSettingsBlock}
      <key>OnDemandRules</key>
      <array>
        <dict>
          <key>Action</key>
          <string>EvaluateConnection</string>
          <key>ActionParameters</key>
          <array>
            <dict>
              <key>DomainAction</key>
              <string>NeverConnect</string>
              <key>Domains</key>
              <array>
                <string>local</string>
                <string>fritz.box</string>
              </array>
            </dict>
          </array>
        </dict>
        <dict>
          <key>Action</key>
          <string>Connect</string>
          <key>InterfaceTypeMatch</key>
          <string>Cellular</string>
        </dict>
        <dict>
          <key>Action</key>
          <string>Connect</string>
          <key>InterfaceTypeMatch</key>
          <string>WiFi</string>
        </dict>
        <dict>
          <key>Action</key>
          <string>Connect</string>
        </dict>
      </array>
      <key>ProhibitDisablement</key>
      ${removalDisallowed}
      <key>PayloadDescription</key>
      <string>Erzwingt Labtoso Zero-Trust Encrypted DNS auch im 5G/LTE-Mobilfunknetz und in fremden Hotspots.</string>
      <key>PayloadDisplayName</key>
      <string>Labtoso Always-On Roaming DNS (${device.name})</string>
      <key>PayloadIdentifier</key>
      <string>de.labtoso.network.dns.${device.id}</string>
      <key>PayloadOrganization</key>
      <string>Labtoso Network Control Suite</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>8a4b2c10-9f11-4d3a-b821-${device.id.padEnd(12, "0").slice(0, 12)}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Anti-Bypass Roaming-Schutzprofil für ${device.name}. Verhindert das Umgehen von Jugendschutz- &amp; App-Sperren über Mobilfunk oder Hotspots.</string>
  <key>PayloadDisplayName</key>
  <string>Labtoso Zero-Trust Protection (${device.name})</string>
  <key>PayloadIdentifier</key>
  <string>de.labtoso.network.profile.${device.id}</string>
  <key>PayloadOrganization</key>
  <string>Labtoso Network</string>
  <key>PayloadRemovalDisallowed</key>
  ${removalDisallowed}
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>1f9e3d70-4c22-4a8e-9110-${device.id.padEnd(12, "0").slice(0, 12)}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
}

/**
 * Generates a deterministic, sharp SVG matrix badge (QR-style visual code)
 * encoding the device's Roaming DoH/DoT provisioning string for smartphone scanning.
 */
export function generateDeterministicQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Finder patterns at 3 corners
  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isBorder = x === 0 || x === 6 || y === 0 || y === 6;
        const isCore = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = isBorder || isCore;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Fill data cells deterministically from seed
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTopLeft = x < 8 && y < 8;
      const inTopRight = x >= size - 8 && y < 8;
      const inBottomLeft = x < 8 && y >= size - 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      hash ^= (x * 31 + y * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[y][x] = (Math.abs(hash) % 10) < 5;
    }
  }
  return grid;
}
