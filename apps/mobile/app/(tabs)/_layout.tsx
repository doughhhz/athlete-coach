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
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.text, fontWeight: "700" },
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      {tabDefinitions.map((tab) => (
        <Tabs.Screen
          key={tab.route}
          name={tab.route}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.accessibilityLabel,
            // Stable E2E selector (Maestro): tab-index, tab-treino, ...
            tabBarButtonTestID: `tab-${tab.route}`,
          }}
        />
      ))}
    </Tabs>
  );
}
