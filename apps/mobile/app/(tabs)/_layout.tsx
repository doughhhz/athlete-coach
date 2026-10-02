import { Ionicons } from "@expo/vector-icons";
import { type Href, Tabs, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAppSession } from "@/presentation/auth/app-session";
import { tabDefinitions } from "@/presentation/navigation/tabs";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

export default function TabsLayout() {
  const theme = useAppTheme();
  const { initialProgramOffer } = useAppSession();
  const router = useRouter();
  // Right after onboarding, the Personal offers the first program once.
  useEffect(() => {
    if (initialProgramOffer) router.push("/initial-program" as Href);
  }, [initialProgramOffer, router]);

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        animation: "fade",
        headerStyle: { backgroundColor: theme.colors.backgroundSecondary },
        headerTitleStyle: {
          color: theme.colors.textPrimary,
          fontFamily: theme.fonts.bold,
        },
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "#A8B6CB",
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.fonts.semibold },
        tabBarStyle: {
          backgroundColor: "rgba(8,16,28,0.95)",
          borderTopColor: theme.colors.divider,
        },
      }}
    >
      {tabDefinitions.map((tab) => (
        <Tabs.Screen
          key={tab.route}
          name={tab.route}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={tab.icon as keyof typeof Ionicons.glyphMap}
                size={size}
                color={color}
              />
            ),
            // Home and Treino draw their own headers (ADR-0120/0121).
            headerShown: tab.route !== "treino" && tab.route !== "index",
            tabBarAccessibilityLabel: tab.accessibilityLabel,
            // Stable E2E selector (Maestro): tab-index, tab-treino, ...
            tabBarButtonTestID: `tab-${tab.route}`,
          }}
        />
      ))}
    </Tabs>
  );
}
