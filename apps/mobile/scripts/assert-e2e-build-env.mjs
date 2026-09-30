// EAS `eas-build-pre-install` hook. For the `e2e-cloud` profile only, fail
// the build early and clearly when the public Supabase configuration is
// missing, local-only or not a publishable key. Prints variable NAMES and
// problems, never values. Other profiles and local runs are untouched.
const profile = process.env.EAS_BUILD_PROFILE;
if (profile !== "e2e-cloud") process.exit(0);

const problems = [];
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
if (process.env.APP_VARIANT !== "e2e")
  problems.push("APP_VARIANT must be e2e (set by the e2e-cloud profile).");
if (!url) problems.push("EXPO_PUBLIC_SUPABASE_URL is missing.");
else {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    problems.push("EXPO_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (parsed && parsed.protocol !== "https:")
    problems.push("EXPO_PUBLIC_SUPABASE_URL must use HTTPS (cloud simulator).");
  if (
    parsed &&
    /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(parsed.hostname)
  )
    problems.push("EXPO_PUBLIC_SUPABASE_URL points to a local address.");
}
if (!key) problems.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.");
else if (key.startsWith("sb_secret_") || /service_role/.test(key))
  problems.push(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks like a SECRET key; only the publishable key may ship in the app.",
  );
else if (!key.startsWith("sb_publishable_"))
  problems.push(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key (sb_publishable_...).",
  );

if (problems.length) {
  console.error("E2E build configuration is invalid (values are not printed):");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "Configure them as EAS environment variables (environment: preview). See e2e/README.md.",
  );
  process.exit(1);
}
console.log(
  "E2E build configuration OK (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
);
