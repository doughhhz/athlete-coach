import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AppSessionProvider } from "@/infrastructure/application/app-session-provider";
import { useAppSession } from "@/presentation/auth/app-session";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/presentation/components/form-controls";
import { getRouteAccess } from "@/presentation/auth/route-access";
import { appTheme, navigationColors } from "@/presentation/theme/theme";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

function RootNavigator() {
  const session = useAppSession();
  const { accessState, configurationMessage, error } = session;
  const theme = useAppTheme();
  const routes = getRouteAccess(accessState);

  if (accessState === "booting" || accessState === "configuration_error") {
    return (
      <SafeAreaView
        style={[styles.status, { backgroundColor: theme.colors.background }]}
      >
        {accessState === "booting" && !error ? (
          <ActivityIndicator color={theme.colors.accent} size="large" />
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.statusTitle, { color: theme.colors.text }]}
        >
          {accessState === "booting"
            ? error
              ? "Não foi possível carregar"
              : "Preparando seu perfil"
            : "Backend não configurado"}
        </Text>
        <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>
          {accessState === "booting"
            ? (error ?? "Restaurando sua sessão com segurança.")
            : configurationMessage}
        </Text>
        {accessState === "booting" && error ? (
          <View style={styles.statusActions}>
            <PrimaryButton
              label="Tentar novamente"
              onPress={() => void session.retryInitialization()}
            />
            <SecondaryButton
              label="Sair da conta"
              onPress={() => void session.signOut()}
            />
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Voltar",
        // Fluid page transitions (design ADR-0120).
        animation: "fade_from_bottom",
        animationDuration: 280,
      }}
    >
      <Stack.Protected guard={routes.auth}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={routes.onboarding}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={routes.ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Perfil" }} />
        <Stack.Screen
          name="initial-program"
          options={{ title: "Seu programa" }}
        />
        <Stack.Screen
          name="exercises/[slug]"
          options={{ title: "Exercício" }}
        />
        <Stack.Screen
          name="programs/index"
          options={{ title: "Meus programas" }}
        />
        {/* The workout runner draws its own header (ADR-0122). */}
        <Stack.Screen
          name="workouts/[id]/index"
          options={{ headerShown: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Without the fonts the app still works with the system font.
  if (!fontsLoaded && !fontError)
    return (
      <View style={{ flex: 1, backgroundColor: appTheme.colors.background }} />
    );

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{
          ...DarkTheme,
          colors: { ...DarkTheme.colors, ...navigationColors },
        }}
      >
        <StatusBar style="light" />
        <AppSessionProvider>
          <RootNavigator />
        </AppSessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },
  statusText: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 420,
    textAlign: "center",
  },
  statusActions: { gap: 10, marginTop: 20, width: "100%" },
});
