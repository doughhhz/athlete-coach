export const themes = {
  light: {
    dark: false,
    colors: {
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#17202A",
      textMuted: "#5E6B78",
      accent: "#146C5A",
      danger: "#B42318",
      border: "#DCE3E8",
    },
  },
  dark: {
    dark: true,
    colors: {
      background: "#0F1418",
      surface: "#171E23",
      text: "#F4F7F8",
      textMuted: "#AAB6BE",
      accent: "#69D2B9",
      danger: "#FF8A80",
      border: "#2C3941",
    },
  },
} as const;

export const navigationColors = {
  light: {
    primary: themes.light.colors.accent,
    background: themes.light.colors.background,
    card: themes.light.colors.surface,
    text: themes.light.colors.text,
    border: themes.light.colors.border,
    notification: themes.light.colors.accent,
  },
  dark: {
    primary: themes.dark.colors.accent,
    background: themes.dark.colors.background,
    card: themes.dark.colors.surface,
    text: themes.dark.colors.text,
    border: themes.dark.colors.border,
    notification: themes.dark.colors.accent,
  },
} as const;
