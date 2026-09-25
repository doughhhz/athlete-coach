import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { navigationColors } from "@/presentation/theme/theme";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const colors = isDark ? navigationColors.dark : navigationColors.light;

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{ ...baseTheme, colors: { ...baseTheme.colors, ...colors } }}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <Slot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
