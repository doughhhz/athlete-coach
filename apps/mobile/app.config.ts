import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Wraps app.json. Only the E2E simulator build (APP_VARIANT=e2e, set by the
 * `e2e-cloud` EAS profile) gets a distinct name and iOS bundle identifier, so
 * it can never be mistaken for, or collide with, a future production app.
 * Local development and every other build use app.json unchanged. No
 * production bundle identifier is defined here on purpose (not decided yet).
 */
export const E2E_IOS_BUNDLE_IDENTIFIER = "app.athletecoach.e2e";

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.APP_VARIANT !== "e2e") return base;
  return {
    ...base,
    name: "Athlete Coach E2E",
    ios: { ...base.ios, bundleIdentifier: E2E_IOS_BUNDLE_IDENTIFIER },
  };
};
