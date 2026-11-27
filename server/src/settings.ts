import { z } from "zod";
import { config } from "./config.js";
import { decrypt, encrypt } from "./crypto.js";
import { prisma } from "./db.js";

export const THEME_IDS = ["matrix", "cyber-terminal", "midnight-obsidian", "neon-tokyo", "bioluminescence"] as const;

export const blockPageSchema = z.object({
  mode: z.enum(["studio", "redirect"]),
  redirectUrl: z.string().max(2048),
  theme: z.enum(THEME_IDS),
  title: z.string().max(200),
  alert: z.string().max(2000),
  alertLevel: z.enum(["info", "warning", "critical"]),
  showDomain: z.boolean(),
  showClient: z.boolean(),
  showCountdown: z.boolean(),
  showRequestButton: z.boolean(),
  requestHint: z.string().max(500),
  footer: z.string().max(500),
  expertMode: z.boolean(),
  customHtml: z.string().max(100_000),
});
export type BlockPageConfig = z.infer<typeof blockPageSchema>;

export const roamingSchema = z.object({
  enforce: z.boolean(),
  offlineCache: z.boolean(),
  homeSsids: z.array(z.string().min(1).max(64)).max(20),
});
export type RoamingSettings = z.infer<typeof roamingSchema>;

export const generalSchema = z.object({
  theme: z.enum(THEME_IDS),
  canvasIntensity: z.number().int().min(0).max(100),
  setupComplete: z.boolean(),
  notifyUrl: z.string().max(2048),
  accessDefaultMinutes: z.number().int().min(5).max(1440),
});
export type GeneralSettings = z.infer<typeof generalSchema>;

export const DEFAULT_BLOCKPAGE: BlockPageConfig = {
  mode: "studio",
  redirectUrl: "",
  theme: "matrix",
  title: "Zugriff gesperrt",
  alert: "Die Seite {domain} ist fuer {client_name} im Moment gesperrt.",
  alertLevel: "warning",
  showDomain: true,
  showClient: true,
  showCountdown: true,
  showRequestButton: true,
  requestHint: "Du brauchst die Seite wirklich? Schick eine Anfrage, der Admin kann sie direkt freigeben.",
  footer: "Labtoso Network · geschuetzt durch AdGuard Home",
  expertMode: false,
  customHtml: "",
};

export const DEFAULT_ROAMING: RoamingSettings = { enforce: true, offlineCache: true, homeSsids: [] };

export const DEFAULT_GENERAL: GeneralSettings = {
  theme: "matrix",
  canvasIntensity: 70,
  setupComplete: false,
  notifyUrl: "",
  accessDefaultMinutes: 30,
};

async function readJson<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    const parsed = schema.safeParse({ ...(fallback as object), ...JSON.parse(row.value) });
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: text }, update: { value: text } });
}

export const getBlockPage = () => readJson("blockpage", blockPageSchema, DEFAULT_BLOCKPAGE);
export const setBlockPage = (value: BlockPageConfig) => writeJson("blockpage", blockPageSchema.parse(value));
export const getRoaming = () => readJson("roaming", roamingSchema, DEFAULT_ROAMING);
export const setRoaming = (value: RoamingSettings) => writeJson("roaming", roamingSchema.parse(value));
export const getGeneral = () => readJson("general", generalSchema, DEFAULT_GENERAL);
export const setGeneral = (value: GeneralSettings) => writeJson("general", generalSchema.parse(value));

export interface AdGuardConnection {
  url: string;
  user: string;
  pass: string;
  source: "database" | "env" | "none";
}

const adguardStoredSchema = z.object({ url: z.string(), user: z.string(), passEnc: z.string() });

let connectionCache: AdGuardConnection | null = null;

export async function getAdGuardConnection(): Promise<AdGuardConnection> {
  if (connectionCache) return connectionCache;
  const row = await prisma.setting.findUnique({ where: { key: "adguard" } });
  if (row) {
    const parsed = adguardStoredSchema.safeParse(JSON.parse(row.value));
    if (parsed.success && parsed.data.url) {
      connectionCache = {
        url: parsed.data.url,
        user: parsed.data.user,
        pass: parsed.data.passEnc ? decrypt(parsed.data.passEnc) : "",
        source: "database",
      };
      return connectionCache;
    }
  }
  connectionCache = config.adguardUrl
    ? { url: config.adguardUrl, user: config.adguardUser, pass: config.adguardPass, source: "env" }
    : { url: "", user: "", pass: "", source: "none" };
  return connectionCache;
}

export async function setAdGuardConnection(url: string, user: string, pass: string | null): Promise<void> {
  const current = await getAdGuardConnection();
  const password = pass === null ? current.pass : pass;
  await writeJson("adguard", { url: url.replace(/\/+$/, ""), user, passEnc: password ? encrypt(password) : "" });
  connectionCache = null;
}

export function normalizeAdGuardUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Nur http:// oder https:// ist erlaubt.");
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}
