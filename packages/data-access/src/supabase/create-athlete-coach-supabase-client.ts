import {
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";

import type { Database } from "../generated/database.types";

export type PublicSupabaseConfig = Readonly<{
  publishableKey: string;
  storage?: SupportedStorage;
  url: string;
}>;

export type AthleteCoachSupabaseClient = SupabaseClient<Database>;

export function createAthleteCoachSupabaseClient({
  publishableKey,
  storage,
  url,
}: PublicSupabaseConfig): AthleteCoachSupabaseClient {
  assertPublicSupabaseConfig(url, publishableKey);

  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      ...(storage ? { storage } : {}),
    },
  });
}

function assertPublicSupabaseConfig(url: string, publishableKey: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.");
  }

  if (publishableKey.trim().length === 0) {
    throw new Error("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  }
}
