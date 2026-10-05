/**
 * Single dark "fitness minimal neon" theme (design decision 2026-10-01:
 * whole app, dark only). Legacy keys (background, surface, text, textMuted,
 * accent, danger, border) keep every existing screen working; new screens
 * use the richer tokens.
 */
const palette = {
  background: "#050B14",
  backgroundSecondary: "#08111F",
  surface: "#0B1626",
  surfaceSoft: "#101D31",
  surfaceCard: "#0C1829",
  border: "#17314D",
  borderGlow: "#0DA8FF",
  primary: "#16C8FF",
  primaryDark: "#155BFF",
  primaryGradientStart: "#1EDCFF",
  primaryGradientEnd: "#1D5CFF",
  brandAccent: "#2E90FF",
  textPrimary: "#FFFFFF",
  textSecondary: "#C9D4E5",
  textMuted: "#8FA1BA",
  success: "#19E27A",
  danger: "#FF4D67",
  /** Attention without alarm (set below plan). */
  warning: "#FFB547",
  divider: "#132235",
  shadow: "rgba(0,0,0,0.35)",
} as const;

export const fonts = {
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typography = {
  titleXL: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  titleLG: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  titleMD: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  bodyLG: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodyMD: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  bodySM: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
  },
} as const;

export const spacing = {
  screenHorizontal: 20,
  screenTop: 16,
  section: 20,
  card: 16,
  item: 12,
  radiusCard: 20,
  radiusButton: 18,
  radiusChip: 16,
  radiusRow: 18,
} as const;

export const appTheme = {
  dark: true,
  colors: {
    ...palette,
    // Legacy keys used across the app.
    text: palette.textPrimary,
    accent: palette.primary,
  },
  typography,
  spacing,
  fonts,
} as const;
export type AppTheme = typeof appTheme;

/** Kept for compatibility: both entries are the dark neon theme. */
export const themes = { light: appTheme, dark: appTheme } as const;

export const navigationColors = {
  primary: palette.primary,
  background: palette.background,
  card: palette.backgroundSecondary,
  text: palette.textPrimary,
  border: palette.divider,
  notification: palette.danger,
} as const;
