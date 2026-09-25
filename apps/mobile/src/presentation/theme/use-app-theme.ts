import { useColorScheme } from "react-native";

import { themes } from "@/presentation/theme/theme";

export function useAppTheme() {
  return useColorScheme() === "dark" ? themes.dark : themes.light;
}
