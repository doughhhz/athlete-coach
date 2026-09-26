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
  CreateTrainingProgramDraft,
  SaveTrainingProgramStructure,
  ActivateTrainingProgram,
  GetActiveTrainingProgram,
  GetTrainingProgram,
  CloneTrainingProgramAsDraft,
  StartWorkoutSession,
  GetInProgressWorkoutSession,
  RecordWorkoutSet,
  SkipWorkoutSet,
  CompleteWorkoutSession,
  AbandonWorkoutSession,
  ListWorkoutSessions,
  GetPerformanceOverview,
  GetExercisePerformanceHistory,
  GetExercisePersonalBests,
  BuildAthleteTrainingDossier,
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
import { SupabaseTrainingProgramRepository } from "../packages/data-access/src/supabase/training-program-repository.ts";
import { SupabaseWorkoutSessionRepository } from "../packages/data-access/src/supabase/workout-session-repository.ts";
import { SupabasePerformanceReadRepository } from "../packages/data-access/src/supabase/performance-read-repository.ts";

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
  const programs = new SupabaseTrainingProgramRepository(client);
  const workouts = new SupabaseWorkoutSessionRepository(client);
  const performance = new SupabasePerformanceReadRepository(client);
  const load = new LoadCurrentAthleteProfile(
    athlete,
    profile,
    goal,
    training,
    weight,
  );
  return {
    auth,
    complete: new CompleteAthleteOnboarding(
      new SupabaseOnboardingRepository(client),
    ),
    ensure: new EnsureCurrentAthlete(athlete),
    latest: new GetLatestBodyWeight(weight),
    load,
    record: new RecordBodyWeight(weight),
    restore: new RestoreSession(auth),
    signIn: new SignInWithEmail(auth),
    signOut: new SignOutCurrentSession(auth),
    signUp: new SignUpWithEmail(auth),
    updateProfile: new UpdateAthleteProfile(profile),
    createProgram: new CreateTrainingProgramDraft(programs),
    saveProgram: new SaveTrainingProgramStructure(programs),
    activateProgram: new ActivateTrainingProgram(programs),
    activeProgram: new GetActiveTrainingProgram(programs),
    getProgram: new GetTrainingProgram(programs),
    cloneProgram: new CloneTrainingProgramAsDraft(programs),
    startWorkout: new StartWorkoutSession(workouts),
    activeWorkout: new GetInProgressWorkoutSession(workouts),
    recordSet: new RecordWorkoutSet(workouts),
    skipSet: new SkipWorkoutSet(workouts),
    completeWorkout: new CompleteWorkoutSession(workouts),
    abandonWorkout: new AbandonWorkoutSession(workouts),
    listWorkouts: new ListWorkoutSessions(workouts),
    performanceOverview: new GetPerformanceOverview(performance),
    performanceHistory: new GetExercisePerformanceHistory(performance),
    personalBests: new GetExercisePersonalBests(performance),
    dossier: new BuildAthleteTrainingDossier(
      load,
      programs,
      workouts,
      performance,
    ),
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
const draft = await first.createProgram.execute({ name: "Programa local" });
await first.saveProgram.execute(draft.id, {
  blocks: [
    {
      sequence: 1,
      name: "Base",
      weeks: [
        {
          sequence: 1,
          name: "Semana 1",
          days: [
            {
              sequence: 1,
              name: "Treino A",
              prescriptions: [
                {
                  sequence: 1,
                  exerciseId: "50000000-0000-4000-8000-000000000001",
                  sets: [
                    {
                      sequence: 1,
                      targetMetric: "reps",
                      targetMin: 8,
                      targetMax: 10,
                      rirMin: 2,
                      rirMax: 2,
                      restMinSeconds: 120,
                      restMaxSeconds: 120,
                      tempo: "3-1-X-0",
                      loadKind: "athlete_selected",
                      loadKg: null,
                    },
                    {
                      sequence: 2,
                      targetMetric: "reps",
                      targetMin: 8,
                      targetMax: 10,
                      rirMin: 2,
                      rirMax: 2,
                      restMinSeconds: 120,
                      restMaxSeconds: 120,
                      tempo: null,
                      loadKind: "athlete_selected",
                      loadKg: null,
                    },
                    {
                      sequence: 3,
                      targetMetric: "reps",
                      targetMin: 8,
                      targetMax: 10,
                      rirMin: 2,
                      rirMax: 2,
                      restMinSeconds: 120,
                      restMaxSeconds: 120,
                      tempo: null,
                      loadKind: "athlete_selected",
                      loadKg: null,
                    },
                    {
                      sequence: 4,
                      targetMetric: "reps",
                      targetMin: 8,
                      targetMax: 10,
                      rirMin: 2,
                      rirMax: 2,
                      restMinSeconds: 120,
                      restMaxSeconds: 120,
                      tempo: null,
                      loadKind: "athlete_selected",
                      loadKg: null,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
const activated = await first.activateProgram.execute(draft.id);
assert.equal(activated.status, "active");
const workout = await first.startWorkout.execute(
  activated.blocks[0].weeks[0].days[0].id,
);
assert.equal(workout.exercises[0].sets.length, 4);
assert.equal(workout.programName, "Programa local");
await first.recordSet.execute(workout.id, workout.exercises[0].sets[0].id, {
  actualValue: 7,
  actualLoadKg: 30,
  actualRir: 2,
});

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
assert.equal((await reloaded.activeProgram.execute())?.id, draft.id);
assert.equal((await reloaded.activeWorkout.execute())?.id, workout.id);
const revision = await reloaded.cloneProgram.execute(draft.id);
assert.equal(revision.supersedesProgramId, draft.id);
assert.notEqual(revision.blocks[0].id, activated.blocks[0].id);
assert.equal((await reloaded.activeProgram.execute())?.id, draft.id);
const activatedRevision = await reloaded.activateProgram.execute(revision.id);
const retiredOriginal = await reloaded.getProgram.execute(draft.id);
assert.equal(activatedRevision.status, "active");
assert.equal(retiredOriginal?.status, "archived");
assert.equal(retiredOriginal?.completedAt, null);
assert.ok(retiredOriginal?.archivedAt);
assert.equal(retiredOriginal?.blocks[0].name, activated.blocks[0].name);
assert.equal((await reloaded.activeProgram.execute())?.id, revision.id);
const resumed = await reloaded.activeWorkout.execute();
assert.equal(
  resumed?.sourceTrainingDayId,
  activated.blocks[0].weeks[0].days[0].id,
);
assert.equal(resumed?.programName, "Programa local");
await reloaded.recordSet.execute(workout.id, resumed.exercises[0].sets[1].id, {
  actualValue: 9,
  actualLoadKg: 30,
  actualRir: 1,
});
await reloaded.recordSet.execute(workout.id, resumed.exercises[0].sets[2].id, {
  actualValue: 12,
  actualLoadKg: 27.5,
  actualRir: 0,
});
await reloaded.skipSet.execute(resumed.exercises[0].sets[3].id);
await reloaded.completeWorkout.execute(workout.id);
assert.equal((await reloaded.listWorkouts.execute())[0].status, "completed");
let performanceHistory = await reloaded.performanceHistory.execute(
  resumed.exercises[0].exerciseId,
);
assert.deepEqual(
  performanceHistory.slice(0, 3).map((point) => point.targetAttainment),
  ["below_range", "within_range", "above_range"],
);
assert.equal(performanceHistory[0].isNewMaxLoggedLoad, false);
assert.equal(performanceHistory[0].isNewEstimatedOneRepMax, false);
await assert.rejects(() =>
  reloaded.recordSet.execute(workout.id, resumed.exercises[0].sets[0].id, {
    actualValue: 8,
    actualLoadKg: 30,
    actualRir: 2,
  }),
);
const second = await reloaded.startWorkout.execute(
  activatedRevision.blocks[0].weeks[0].days[0].id,
);
await reloaded.recordSet.execute(second.id, second.exercises[0].sets[0].id, {
  actualValue: 8,
  actualLoadKg: 30,
  actualRir: 2,
});
await reloaded.abandonWorkout.execute(second.id);
const abandoned = (await reloaded.listWorkouts.execute()).find(
  (x) => x.id === second.id,
);
assert.equal(abandoned?.status, "abandoned");
assert.equal(abandoned?.completedSetCount, 1);
performanceHistory = await reloaded.performanceHistory.execute(
  second.exercises[0].exerciseId,
);
assert.equal(performanceHistory.at(-1)?.sessionStatus, "abandoned");
assert.equal(performanceHistory.at(-1)?.isNewMaxLoggedLoad, false);
const third = await reloaded.startWorkout.execute(
  activatedRevision.blocks[0].weeks[0].days[0].id,
);
await reloaded.recordSet.execute(third.id, third.exercises[0].sets[0].id, {
  actualValue: 8,
  actualLoadKg: 35,
  actualRir: 2,
});
for (const pending of third.exercises[0].sets.slice(1))
  await reloaded.skipSet.execute(pending.id);
await reloaded.completeWorkout.execute(third.id);
performanceHistory = await reloaded.performanceHistory.execute(
  third.exercises[0].exerciseId,
);
assert.equal(performanceHistory.at(-1)?.isNewMaxLoggedLoad, true);
assert.equal(performanceHistory.at(-1)?.isNewEstimatedOneRepMax, true);
assert.equal((await reloaded.personalBests.execute())[0].maxLoggedLoadKg, 35);
const overviewBeforeReload = await reloaded.performanceOverview.execute();
const dossierBeforeReload = await reloaded.dossier.execute();
assert.equal(dossierBeforeReload.schemaVersion, "athlete-training-dossier-v1");
assert.equal(dossierBeforeReload.activeProgram?.id, revision.id);
assert.equal(dossierBeforeReload.windows.at(-1)?.sessionsStarted, 3);
assert.equal(dossierBeforeReload.exerciseSignals.length, 1);
assert.ok(
  dossierBeforeReload.evidence.some((item) => item.kind === "training_program"),
);
await reloaded.signOut.execute();
await reloaded.signIn.execute(credentials);
assert.deepEqual(
  await reloaded.performanceOverview.execute(),
  overviewBeforeReload,
);
const dossierAfterReload = await reloaded.dossier.execute();
assert.deepEqual(
  { ...dossierAfterReload, generatedAt: dossierBeforeReload.generatedAt },
  dossierBeforeReload,
);

firstClient.auth.stopAutoRefresh();
reloadedClient.auth.stopAutoRefresh();
console.log(
  "Local Auth/onboarding/training/workout/derived-performance/dossier flow passed.",
);
