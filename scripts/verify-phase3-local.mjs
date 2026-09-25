import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  CompleteAthleteOnboarding,
  EnsureCurrentAthlete,
  GetLatestBodyWeight,
  LoadCurrentAthleteProfile,
  RecordBodyWeight,
  RestoreSession,
  SignInWithEmail,
  SignOutCurrentSession,
  SignUpWithEmail,
  UpdateAthleteProfile,
} from "../packages/application/src/index.ts";
import { createAthleteCoachSupabaseClient } from "../packages/data-access/src/supabase/create-athlete-coach-supabase-client.ts";
import {
  SupabaseAthleteGoalRepository,
  SupabaseAthleteProfileRepository,
  SupabaseAthleteRepository,
  SupabaseAuthRepository,
  SupabaseBodyWeightRepository,
  SupabaseOnboardingRepository,
  SupabaseTrainingContextRepository,
} from "../packages/data-access/src/supabase/supabase-repositories.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");
const temporaryDirectory = resolve(repositoryRoot, ".cache/supabase-cli-temp");
const supabaseCliPath = resolve(
  repositoryRoot,
  "node_modules/supabase/dist/supabase.js",
);

mkdirSync(temporaryDirectory, { recursive: true });
const status = spawnSync(
  process.execPath,
  [supabaseCliPath, "status", "-o", "json"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory },
  },
);
if (status.status !== 0) {
  throw new Error("A stack Supabase local precisa estar saudável.");
}

const local = JSON.parse(status.stdout);
const url = local.API_URL;
const publishableKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
assert.equal(typeof url, "string", "Supabase local API URL ausente.");
assert.equal(
  typeof publishableKey,
  "string",
  "Supabase local publishable key ausente.",
);

const values = new Map();
const storage = {
  async getItem(key) {
    return values.get(key) ?? null;
  },
  async removeItem(key) {
    values.delete(key);
  },
  async setItem(key, value) {
    values.set(key, value);
  },
};

function compose(client) {
  const auth = new SupabaseAuthRepository(client);
  const athlete = new SupabaseAthleteRepository(client);
  const profile = new SupabaseAthleteProfileRepository(client);
  const goal = new SupabaseAthleteGoalRepository(client);
  const training = new SupabaseTrainingContextRepository(client);
  const weight = new SupabaseBodyWeightRepository(client);
  return {
    auth,
    complete: new CompleteAthleteOnboarding(
      new SupabaseOnboardingRepository(client),
    ),
    ensure: new EnsureCurrentAthlete(athlete),
    latest: new GetLatestBodyWeight(weight),
    load: new LoadCurrentAthleteProfile(
      athlete,
      profile,
      goal,
      training,
      weight,
    ),
    record: new RecordBodyWeight(weight),
    restore: new RestoreSession(auth),
    signIn: new SignInWithEmail(auth),
    signOut: new SignOutCurrentSession(auth),
    signUp: new SignUpWithEmail(auth),
    updateProfile: new UpdateAthleteProfile(profile),
  };
}

const credentials = {
  email: `phase3-${Date.now()}@example.invalid`,
  password: `Local-only-${Date.now()}-A1`,
};
const firstClient = createAthleteCoachSupabaseClient({
  publishableKey,
  storage,
  url,
});
const first = compose(firstClient);
const signup = await first.signUp.execute(credentials);
assert.ok(signup.session, "Signup local deveria criar sessão confirmada.");

const identity = await first.ensure.execute();
assert.equal((await first.ensure.execute()).id, identity.id);
const initialMeasuredAt = new Date(Date.now() - 60_000).toISOString();
await first.complete.execute({
  availableWeekdays: [1, 3, 5],
  birthDate: "2000-01-15",
  constraintsNotes: "Observação artificial de teste local.",
  goalNotes: undefined,
  goalType: "strength",
  heightCm: 180,
  measuredAt: initialMeasuredAt,
  preferredName: "Atleta de teste",
  preferredSessionDurationMinutes: 60,
  preferencesNotes: undefined,
  recentTrainingConsistency: "consistent",
  resistanceTrainingMonths: 24,
  routineSummary: "Rotina artificial de teste local.",
  targetWeightKg: undefined,
  timezone: "America/Sao_Paulo",
  trainingEnvironment: "commercial_gym",
  weightKg: 76.4,
});

let snapshot = await first.load.execute();
assert.equal(snapshot.profile?.preferredName, "Atleta de teste");
await first.updateProfile.execute({
  birthDate: "2000-01-15",
  heightCm: 181,
  preferredName: "Atleta atualizado",
  timezone: "America/Sao_Paulo",
});
await first.record.execute({
  measuredAt: new Date().toISOString(),
  weightKg: 76.8,
});
assert.equal((await first.latest.execute())?.weightKg, 76.8);

const reloadedClient = createAthleteCoachSupabaseClient({
  publishableKey,
  storage,
  url,
});
const reloaded = compose(reloadedClient);
assert.equal((await reloaded.restore.execute())?.userId, identity.userId);
await reloaded.signOut.execute();
assert.equal(await reloaded.restore.execute(), null);
await reloaded.signIn.execute(credentials);
snapshot = await reloaded.load.execute();
assert.equal(snapshot.profile?.preferredName, "Atleta atualizado");
assert.equal(snapshot.latestWeight?.weightKg, 76.8);

firstClient.auth.stopAutoRefresh();
reloadedClient.auth.stopAutoRefresh();
console.log("Phase 3 local Auth/onboarding/profile flow passed.");
