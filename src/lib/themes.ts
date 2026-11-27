export type ThemeId =
  | "matrix"
  | "amber"
  | "obsidian"
  | "tokyo"
  | "bioluminescence";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  badge: string;
  shortcut: string;
  colors: {
    bgBase: string;
    bgPanel: string;
    bgPanelHover: string;
    border: string;
    borderStrong: string;
    accent: string;
    accentSecondary: string;
    accentMuted: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    statusOnline: string;
    statusWarn: string;
    statusDanger: string;
  };
  scanlines?: boolean;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  obsidian: {
    id: "obsidian",
    name: "Midnight Obsidian",
    subtitle: "Stealth Glass & Threadlines Code Streams",
    badge: "STEALTH // 01",
    shortcut: "1",
    colors: {
      bgBase: "#050505",
      bgPanel: "rgba(10, 10, 12, 0.78)",
      bgPanelHover: "rgba(18, 19, 24, 0.88)",
      border: "rgba(255, 255, 255, 0.08)",
      borderStrong: "rgba(56, 189, 248, 0.35)",
      accent: "#38BDF8",
      accentSecondary: "#94A3B8",
      accentMuted: "rgba(56, 189, 248, 0.12)",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      textMuted: "#52525B",
      statusOnline: "#38BDF8",
      statusWarn: "#F59E0B",
      statusDanger: "#EF4444",
    },
  },
  matrix: {
    id: "matrix",
    name: "Matrix",
    subtitle: "The Digital Rain · Katakana & Hex Streams",
    badge: "KATAKANA // 02",
    shortcut: "2",
    colors: {
      bgBase: "#030503",
      bgPanel: "rgba(5, 11, 6, 0.82)",
      bgPanelHover: "rgba(8, 18, 10, 0.90)",
      border: "rgba(0, 255, 102, 0.16)",
      borderStrong: "rgba(0, 255, 102, 0.45)",
      accent: "#00FF66",
      accentSecondary: "#00CC52",
      accentMuted: "rgba(0, 255, 102, 0.12)",
      textPrimary: "#E2FFEC",
      textSecondary: "#74C69D",
      textMuted: "#2D6A4F",
      statusOnline: "#00FF66",
      statusWarn: "#CCFF00",
      statusDanger: "#FF3366",
    },
  },
  amber: {
    id: "amber",
    name: "Cyber-Terminal",
    subtitle: "Phosphor Amber CRT & Tactical ASCII Grid",
    badge: "PHOSPHOR // 03",
    shortcut: "3",
    scanlines: true,
    colors: {
      bgBase: "#060400",
      bgPanel: "rgba(13, 9, 2, 0.84)",
      bgPanelHover: "rgba(22, 15, 3, 0.92)",
      border: "rgba(255, 176, 0, 0.18)",
      borderStrong: "rgba(255, 176, 0, 0.48)",
      accent: "#FFB000",
      accentSecondary: "#FF7700",
      accentMuted: "rgba(255, 176, 0, 0.13)",
      textPrimary: "#FFF3D1",
      textSecondary: "#D99B26",
      textMuted: "#7A5200",
      statusOnline: "#FFB000",
      statusWarn: "#FF6600",
      statusDanger: "#FF2A2A",
    },
  },
  tokyo: {
    id: "tokyo",
    name: "Neon Tokyo",
    subtitle: "Synth-Pulse Vector Mesh & Dual-Polarity Glow",
    badge: "SYNTH // 04",
    shortcut: "4",
    colors: {
      bgBase: "#05030C",
      bgPanel: "rgba(10, 7, 22, 0.80)",
      bgPanelHover: "rgba(16, 11, 34, 0.88)",
      border: "rgba(0, 240, 255, 0.16)",
      borderStrong: "rgba(255, 0, 127, 0.45)",
      accent: "#00F0FF",
      accentSecondary: "#FF007F",
      accentMuted: "rgba(0, 240, 255, 0.12)",
      textPrimary: "#F3F0FF",
      textSecondary: "#A594F9",
      textMuted: "#5A4E8C",
      statusOnline: "#00F0FF",
      statusWarn: "#FFB800",
      statusDanger: "#FF007F",
    },
  },
  bioluminescence: {
    id: "bioluminescence",
    name: "Bioluminescence",
    subtitle: "Abyssal Deep-Sea Spores & Emerald Currents",
    badge: "ABYSSAL // 05",
    shortcut: "5",
    colors: {
      bgBase: "#020706",
      bgPanel: "rgba(5, 15, 13, 0.80)",
      bgPanelHover: "rgba(8, 24, 21, 0.88)",
      border: "rgba(16, 185, 129, 0.16)",
      borderStrong: "rgba(45, 212, 191, 0.42)",
      accent: "#10B981",
      accentSecondary: "#2DD4BF",
      accentMuted: "rgba(16, 185, 129, 0.12)",
      textPrimary: "#ECFDF5",
      textSecondary: "#6EE7B7",
      textMuted: "#047857",
      statusOnline: "#10B981",
      statusWarn: "#FBBF24",
      statusDanger: "#F43F5E",
    },
  },
};

export const THEME_LIST: ThemeConfig[] = [
  THEMES.obsidian,
  THEMES.matrix,
  THEMES.amber,
  THEMES.tokyo,
  THEMES.bioluminescence,
];

export const DEFAULT_THEME: ThemeId = "obsidian";
export const THEME_STORAGE_KEY = "labtoso-network-theme";
