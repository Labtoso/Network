import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { INITIAL_STATE, type NetworkControlState } from "@/lib/network-state";

export * from "@/lib/network-state";

let memoryState: NetworkControlState | null = null;

function getStateFilePath(): string {
  const cwd = process.cwd();
  const installDir = path.basename(cwd) === "standalone" && path.basename(path.dirname(cwd)) === ".next"
    ? path.resolve(cwd, "../..")
    : cwd;
  const dataDir = process.env.NETWORK_DATA_DIR || path.join(installDir, "data");
  return path.join(dataDir, "network-state.json");
}

export function getNetworkState(): NetworkControlState {
  if (memoryState) return memoryState;
  try {
    const file = getStateFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as NetworkControlState;
      if (parsed && parsed.policy && Array.isArray(parsed.devices) && parsed.adguard) {
        memoryState = parsed;
        return memoryState;
      }
    }
  } catch {
    // Fallback to initial state
  }
  memoryState = JSON.parse(JSON.stringify(INITIAL_STATE)) as NetworkControlState;
  return memoryState;
}

export function saveNetworkState(
  updater: (draft: NetworkControlState) => void
): NetworkControlState {
  const current = structuredClone(getNetworkState());
  updater(current);
  // Enforce Admin Whitelist Invariant: Admin devices can NEVER be paused or blocked
  for (const dev of current.devices) {
    if (dev.isAdminProtected || dev.role === "admin" || dev.role === "server") {
      dev.paused = false;
      dev.bedtimeLocked = false;
      dev.blockedApps = [];
    }
  }
  const file = getStateFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(current, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temporaryFile, file);
  } catch {
    try { fs.rmSync(temporaryFile, { force: true }); } catch { /* Best effort. */ }
    throw new Error("Die Panel-Daten konnten nicht gespeichert werden.");
  }
  memoryState = current;
  return current;
}
