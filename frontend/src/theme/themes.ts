export interface ThemePalette {
  appBg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderSoft: string;
  titleColor: string;
  accentPrimary: string;
}

export type ThemeMode = "dark" | "light";

export const THEMES: Record<ThemeMode, ThemePalette> = {
  dark: {
    appBg: "#0f172a",
    surface: "#1e293b",
    surfaceAlt: "#334155",
    text: "#ffffff",
    textMuted: "#94a3b8",
    textFaint: "#64748b",
    border: "#475569",
    borderSoft: "#334155",
    titleColor: "#f1f5f9",
    accentPrimary: "#fbbf24",
  },
  light: {
    appBg: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    text: "#000000",
    textMuted: "#64748b",
    textFaint: "#94a3b8",
    border: "#e2e8f0",
    borderSoft: "#f1f5f9",
    titleColor: "#1e293b",
    accentPrimary: "#f97316",
  },
};
