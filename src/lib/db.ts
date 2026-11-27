import fs from "fs";
import path from "path";
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
  const current = getNetworkState();
  updater(current);
  // Enforce Admin Whitelist Invariant: Admin devices can NEVER be paused or blocked
  for (const dev of current.devices) {
    if (dev.isAdminProtected || dev.role === "admin" || dev.role === "server") {
      dev.paused = false;
      dev.bedtimeLocked = false;
      dev.blockedApps = [];
    }
  }
  memoryState = current;
  try {
    const file = getStateFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
  } catch {
    // In read-only container layers, memoryState holds the state
  }
  return current;
}
