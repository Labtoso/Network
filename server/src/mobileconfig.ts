import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { findCaddyCertificate, splitPemChain } from "./certs.js";
import { config } from "./config.js";
import type { RoamingSettings } from "./settings.js";

const run = promisify(execFile);

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Deterministische UUID, damit eine Neuinstallation das alte Profil ersetzt statt zu duplizieren. */
function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toUpperCase();
}

export function dohUrl(clientId: string): string {
  return `${config.publicUrl}/dns-query/${clientId}`;
}

export function dotHostname(clientId: string): string {
  const base = config.duckdnsDomain ? `${config.duckdnsDomain}.duckdns.org` : config.primaryHost;
  return `${clientId}.${base}`;
}

export function buildMobileconfig(device: { id: string; name: string; clientId: string }, roaming: RoamingSettings): string {
  const reverse = config.primaryHost.split(".").reverse().join(".");
  const identifier = `${reverse}.network.${device.clientId}`;
  const onDemand = roaming.enforce || roaming.homeSsids.length === 0
    ? `<dict><key>Action</key><string>Connect</string></dict>`
    : `<dict><key>Action</key><string>Disconnect</string><key>InterfaceTypeMatch</key><string>WiFi</string><key>SSIDMatch</key><array>${roaming.homeSsids
        .map((ssid) => `<string>${xml(ssid)}</string>`)
        .join("")}</array></dict><dict><key>Action</key><string>Connect</string></dict>`;
  const enforceKeys = roaming.enforce ? "<key>ProhibitDisablement</key><true/>" : "";
  const removal = roaming.enforce ? "<key>PayloadRemovalDisallowed</key><true/>" : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key><string>HTTPS</string>
        <key>ServerURL</key><string>${xml(dohUrl(device.clientId))}</string>
      </dict>
      <key>OnDemandRules</key>
      <array>${onDemand}</array>
      ${enforceKeys}
      <key>PayloadDisplayName</key><string>Labtoso Network DNS (${xml(device.name)})</string>
      <key>PayloadIdentifier</key><string>${xml(identifier)}.dns</string>
      <key>PayloadType</key><string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key><string>${stableUuid(`${device.id}:dns`)}</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key><string>Verschluesseltes DNS (DoH) ueber ${xml(config.primaryHost)}. Sperren gelten auch im Mobilfunk und in fremden WLANs.</string>
  <key>PayloadDisplayName</key><string>Labtoso Network: ${xml(device.name)}</string>
  <key>PayloadIdentifier</key><string>${xml(identifier)}</string>
  ${removal}
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${stableUuid(`${device.id}:profile`)}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
`;
}

/**
 * Signiert das Profil mit dem Let's-Encrypt-Zertifikat der Domain (CMS/PKCS#7 via openssl).
 * iOS zeigt das Profil dann als "Verifiziert". Ohne Zertifikat wird unsigniert ausgeliefert.
 */
export async function signMobileconfig(plain: string): Promise<{ body: Buffer; signed: boolean }> {
  const pair = findCaddyCertificate();
  if (!pair) return { body: Buffer.from(plain, "utf8"), signed: false };
  const chain = splitPemChain(pair.certPem);
  if (chain.length === 0) return { body: Buffer.from(plain, "utf8"), signed: false };
  const dir = await mkdtemp(path.join(tmpdir(), "mobileconfig-"));
  try {
    const files = {
      input: path.join(dir, "profile.mobileconfig"),
      output: path.join(dir, "signed.mobileconfig"),
      leaf: path.join(dir, "leaf.pem"),
      chain: path.join(dir, "chain.pem"),
      key: path.join(dir, "key.pem"),
    };
    await writeFile(files.input, plain);
    await writeFile(files.leaf, `${chain[0]}\n`);
    await writeFile(files.key, pair.keyPem, { mode: 0o600 });
    const args = ["smime", "-sign", "-signer", files.leaf, "-inkey", files.key, "-nodetach", "-outform", "der", "-binary", "-in", files.input, "-out", files.output];
    if (chain.length > 1) {
      await writeFile(files.chain, `${chain.slice(1).join("\n")}\n`);
      args.splice(6, 0, "-certfile", files.chain);
    }
    await run("openssl", args, { timeout: 10_000 });
    return { body: await readFile(files.output), signed: true };
  } catch {
    return { body: Buffer.from(plain, "utf8"), signed: false };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
