import { copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const legacyFile = ".next/standalone/data/network-state.json";
const dataDir = process.env.NETWORK_DATA_DIR || "data";
const stateFile = path.join(dataDir, "network-state.json");

const legacy = statSync(legacyFile, { throwIfNoEntry: false });
const current = statSync(stateFile, { throwIfNoEntry: false });
if (legacy?.isFile() && (!current || legacy.mtimeMs > current.mtimeMs)) {
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(legacyFile, stateFile);
}
