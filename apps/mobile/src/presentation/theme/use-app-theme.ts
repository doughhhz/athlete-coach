import { appTheme, type AppTheme } from "@/presentation/theme/theme";

/** The app is dark only (design decision 2026-10-01). */
export function useAppTheme(): AppTheme {
  return appTheme;
}
