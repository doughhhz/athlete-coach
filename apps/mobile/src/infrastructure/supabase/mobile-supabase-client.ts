import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAthleteCoachSupabaseClient,
  type AthleteCoachSupabaseClient,
} from "@athlete-coach/data-access";
import "react-native-url-polyfill/auto";
import { AppState, Platform, type AppStateStatus } from "react-native";

export function createMobileSupabaseClient(): AthleteCoachSupabaseClient {
  const url = requirePublicEnvironmentVariable(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    "EXPO_PUBLIC_SUPABASE_URL",
  );
  const publishableKey = requirePublicEnvironmentVariable(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  return createAthleteCoachSupabaseClient({
    publishableKey,
    url,
    ...(Platform.OS === "web" ? {} : { storage: AsyncStorage }),
  });
}

let sharedClient: AthleteCoachSupabaseClient | undefined;

export type MobileBackendConfiguration =
  | Readonly<{ client: AthleteCoachSupabaseClient; status: "configured" }>
  | Readonly<{ message: string; status: "configuration_error" }>;

export function getMobileBackendConfiguration(): MobileBackendConfiguration {
  try {
    sharedClient ??= createMobileSupabaseClient();
    return { client: sharedClient, status: "configured" };
  } catch {
    return {
      message:
        "Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar autenticação e persistência. Consulte o README.md.",
      status: "configuration_error",
    };
  }
}

export function registerSupabaseAuthLifecycle(
  client: AthleteCoachSupabaseClient,
): () => void {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  const updateAutoRefresh = (state: AppStateStatus): void => {
    if (state === "active") {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  };

  updateAutoRefresh(AppState.currentState);
  const subscription = AppState.addEventListener("change", updateAutoRefresh);

  return () => {
    subscription.remove();
    client.auth.stopAutoRefresh();
  };
}

function requirePublicEnvironmentVariable(
  value: string | undefined,
  name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
): string {
  if (!value) {
    throw new Error(`Missing public Supabase configuration: ${name}.`);
  }

  return value;
}
