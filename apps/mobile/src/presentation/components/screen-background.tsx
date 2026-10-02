import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";

/** Dark gradient background (stands in for the blurred gym photo). */
export function ScreenBackground({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return (
    <LinearGradient
      colors={[
        theme.colors.backgroundSecondary,
        theme.colors.background,
        theme.colors.background,
      ]}
      locations={[0, 0.45, 1]}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </LinearGradient>
  );
}
