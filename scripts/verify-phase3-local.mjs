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
  AnalyzeAthleteWithCoach,
  InvalidCoachEvidenceError,
  GenerateCoachProposal,
  BuildInterventionOutcomes,
  BuildInterventionHistory,
  ListInterventionOutcomes,
  GetCoachDecisionOutcome,
  GetIndividualResponseEvidence,
} from "../packages/application/src/index.ts";
import {
  DeterministicCoachSafetyPolicy,
  FixtureCoachModelProvider,
  FixtureCoachProposalProvider,
} from "../packages/ai/src/index.ts";
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
import { SupabaseCoachDecisionRepository } from "../packages/data-access/src/supabase/coach-decision-repository.ts";

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
assert.equal(dossierBeforeReload.schemaVersion, "athlete-training-dossier-v2");
assert.equal(dossierBeforeReload.activeProgram?.id, revision.id);
assert.equal(dossierBeforeReload.windows.at(-1)?.sessionsStarted, 3);
assert.equal(dossierBeforeReload.exerciseSignals.length, 1);
assert.ok(
  dossierBeforeReload.evidence.some((item) => item.kind === "training_program"),
);
assert.equal(
  dossierBeforeReload.recentSessions.items[0].sourceProgram?.id,
  revision.id,
);
assert.equal(
  dossierBeforeReload.recentSessions.items[0].sourceProgram?.revision,
  revision.revision,
);
const workoutEvidence = dossierBeforeReload.recentSessions.items[0].evidence[0];
const coachFixture = {
  schemaVersion: "coach-analysis-v1",
  analysisId: "integration-analysis",
  requestId: "integration-request",
  createdAt: "2026-09-26T12:00:00.000Z",
  summary: "O histórico recente contém sessões registradas.",
  observations: [
    {
      id: "o1",
      statement: "Há treino recente registrado.",
      evidence: [workoutEvidence],
      confidence: "high",
      limitations: [],
    },
  ],
  hypotheses: [],
  recommendations: [
    {
      id: "r1",
      statement: "Mantenha o registro consistente.",
      evidence: [workoutEvidence],
      confidence: "medium",
      limitations: [],
      category: "maintain",
      rationale: "Preserva a base factual para comparações.",
      requiresHumanReview: true,
    },
  ],
  questions: [],
  uncertainties: [],
  evidenceUsed: [workoutEvidence],
  safetyFlags: [],
  metadata: {
    dossierSchemaVersion: "athlete-training-dossier-v1",
    promptVersion: "coach-system-v1",
    policyVersion: "coach-safety-v1",
    provider: "fixture",
    model: "deterministic",
    inputTokens: null,
    outputTokens: null,
  },
};
const coach = new AnalyzeAthleteWithCoach(
  reloaded.dossier,
  new FixtureCoachModelProvider(coachFixture),
  new DeterministicCoachSafetyPolicy(),
  () => "integration-request",
);
assert.equal(
  (
    await coach.execute({
      userRequest: "Avalie meu histórico recente",
      analysisMode: "general_review",
    })
  ).observations.length,
  1,
);
const invalidCoach = new AnalyzeAthleteWithCoach(
  reloaded.dossier,
  new FixtureCoachModelProvider({
    ...coachFixture,
    evidenceUsed: [
      { kind: "workout_session", id: "other-athlete-session", version: null },
    ],
  }),
  new DeterministicCoachSafetyPolicy(),
);
await assert.rejects(
  () =>
    invalidCoach.execute({ userRequest: "Avalie", analysisMode: "question" }),
  InvalidCoachEvidenceError,
);
const programEvidence = dossierBeforeReload.evidence.find(
  (item) => item.kind === "training_program" && item.id === revision.id,
);
assert.ok(programEvidence);
const sourceDay = activatedRevision.blocks[0].weeks[0].days[0];
const sourcePrescription = sourceDay.prescriptions[0];
const sourceSet = sourcePrescription.sets[0];
const proposalFixture = {
  schemaVersion: "coach-proposal-v1",
  id: crypto.randomUUID(),
  analysisId: coachFixture.analysisId,
  sourceProgramId: activatedRevision.id,
  sourceProgramRevision: activatedRevision.revision,
  createdAt: new Date().toISOString(),
  summary: "Ajustar o RIR planejado",
  rationale: "Proposta determinística de integração.",
  evidenceReferences: [programEvidence],
  actions: [
    {
      kind: "adjust_prescription_rir",
      trainingDayId: sourceDay.id,
      exercisePrescriptionId: sourcePrescription.id,
      prescriptionSetId: sourceSet.id,
      rirMin: 3,
      rirMax: 3,
      rationale: "Validar materialização controlada.",
      evidence: [programEvidence],
    },
  ],
  limitations: ["Fixture local sem chamada de rede."],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: coachFixture.summary,
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-proposal-v1",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v1",
  },
};
const serviceKey = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY;
assert.equal(typeof serviceKey, "string", "Supabase local secret key ausente.");
const serviceClient = createAthleteCoachSupabaseClient({
  publishableKey: serviceKey,
  url,
});
const decisions = new SupabaseCoachDecisionRepository(
  serviceClient,
  identity.userId,
);
const generatedDecision = await new GenerateCoachProposal(
  reloaded.dossier,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new FixtureCoachProposalProvider(proposalFixture),
  decisions,
).execute(coachFixture);
assert.equal(generatedDecision?.status, "proposed");
const materialized = await decisions.materialize(generatedDecision.id);
assert.equal(materialized.status, "materialized");
const proposalDraft = await reloaded.getProgram.execute(
  materialized.materializedProgramId,
);
assert.equal(proposalDraft?.status, "draft");
assert.equal(
  (await reloaded.activeProgram.execute())?.id,
  activatedRevision.id,
);
assert.equal(
  proposalDraft?.blocks[0].weeks[0].days[0].prescriptions[0].sets[0].rirMin,
  3,
);
assert.equal(
  (await decisions.materialize(generatedDecision.id)).materializedProgramId,
  materialized.materializedProgramId,
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

// Phase 11 — intervention outcomes & individual response evidence.
const outcomeClock = () => new Date("2030-01-01T00:00:00.000Z");
function outcomeApi() {
  const outcomes = new BuildInterventionOutcomes(
    // Reads use the athlete JWT (RLS), never the service role.
    new SupabaseCoachDecisionRepository(reloadedClient, identity.userId),
    new SupabaseTrainingProgramRepository(reloadedClient),
    new SupabasePerformanceReadRepository(reloadedClient),
    new SupabaseBodyWeightRepository(reloadedClient),
    outcomeClock,
  );
  return {
    list: new ListInterventionOutcomes(outcomes),
    get: new GetCoachDecisionOutcome(outcomes),
    individual: new GetIndividualResponseEvidence(outcomes),
    history: new BuildInterventionHistory(outcomes),
  };
}
const toStructure = (program, editSet = (set) => set) => ({
  blocks: program.blocks.map((block) => ({
    sequence: block.sequence,
    name: block.name,
    description: block.description ?? undefined,
    weeks: block.weeks.map((week) => ({
      sequence: week.sequence,
      name: week.name ?? undefined,
      notes: week.notes ?? undefined,
      days: week.days.map((day) => ({
        sequence: day.sequence,
        name: day.name,
        preferredWeekday: day.preferredWeekday ?? undefined,
        notes: day.notes ?? undefined,
        prescriptions: day.prescriptions.map((prescription) => ({
          sequence: prescription.sequence,
          exerciseId: prescription.exerciseId,
          instructions: prescription.instructions ?? undefined,
          athleteCues: prescription.athleteCues ?? undefined,
          sets: prescription.sets.map((set) => {
            const edited = editSet(set);
            return {
              sequence: edited.sequence,
              targetMetric: edited.targetMetric,
              targetMin: edited.targetMin,
              targetMax: edited.targetMax,
              rirMin: edited.rirMin,
              rirMax: edited.rirMax,
              restMinSeconds: edited.restMinSeconds,
              restMaxSeconds: edited.restMaxSeconds,
              tempo: edited.tempo,
              loadKind: edited.loadKind,
              loadKg: edited.loadKg,
            };
          }),
        })),
      })),
    })),
  })),
});
const causalLabels =
  /improved|worsened|success|failure|effective|worked|did_not_work|score/i;
let api = outcomeApi();
const awaiting = await api.get.execute(materialized.id);
assert.equal(awaiting.status, "awaiting_activation");
assert.equal(
  awaiting.interventionFidelity.implementedProgramState,
  "draft_not_activated",
);
// Manual edit beyond the proposal: set 2 target also changes before activation.
await reloaded.saveProgram.execute(
  proposalDraft.id,
  toStructure(proposalDraft, (set) =>
    set.sequence === 2 ? { ...set, targetMin: 6, targetMax: 8 } : set,
  ),
);
const programB = await reloaded.activateProgram.execute(proposalDraft.id);
assert.equal(programB.status, "active");
api = outcomeApi();
const activatedOutcome = await api.get.execute(materialized.id);
assert.equal(activatedOutcome.activatedAt, programB.activatedAt);
assert.equal(activatedOutcome.status, "awaiting_post_exposure");
assert.equal(
  activatedOutcome.interventionFidelity.actions[0].proposedValueImplemented,
  true,
);
assert.deepEqual(
  activatedOutcome.interventionFidelity.actions[0]
    .additionalChangesInAffectedPrescription,
  [{ setSequence: 2, dimension: "target" }],
);
assert.equal(
  activatedOutcome.episode.actions[0].implementedPrescriptionSetId,
  programB.blocks[0].weeks[0].days[0].prescriptions[0].sets[0].id,
);
for (const code of [
  "unproposed_changes_in_affected_prescription",
  "multiple_variables_changed_concurrently",
])
  assert.ok(activatedOutcome.limitations.some((item) => item.code === code));
async function trainDay(programDay, values) {
  const session = await reloaded.startWorkout.execute(programDay.id);
  for (const [index, set] of session.exercises[0].sets.entries()) {
    const value = values[index];
    if (value) await reloaded.recordSet.execute(session.id, set.id, value);
    else await reloaded.skipSet.execute(set.id);
  }
  await reloaded.completeWorkout.execute(session.id);
  return session;
}
const dayB = programB.blocks[0].weeks[0].days[0];
const postOne = await trainDay(dayB, [
  { actualValue: 9, actualLoadKg: 32.5, actualRir: 3 },
  { actualValue: 7, actualLoadKg: 32.5, actualRir: null },
]);
const postTwo = await trainDay(dayB, [
  { actualValue: 10, actualLoadKg: 32.5, actualRir: 3 },
]);
const evaluated = await api.get.execute(materialized.id);
assert.equal(evaluated.status, "evaluable");
assert.deepEqual(
  evaluated.baseline[0].exposures.map((item) => item.workoutSessionId),
  [workout.id, second.id, third.id],
);
assert.deepEqual(
  evaluated.postIntervention[0].exposures.map((item) => item.workoutSessionId),
  [postOne.id, postTwo.id],
);
assert.equal(evaluated.postIntervention[0].closed, false);
const rirComparison = evaluated.comparisons.find(
  (item) =>
    item.metric === "mean_actual_rir" &&
    item.scope.kind === "affected_prescription_sets",
);
// Baseline affected set = the source set of Program A (third workout, RIR 2).
assert.equal(rirComparison.before, 2);
assert.equal(rirComparison.after, 3);
assert.equal(rirComparison.absoluteDelta, 1);
assert.equal(rirComparison.afterSampleCount, 2);
assert.ok(
  evaluated.comparisons.every(
    (item) =>
      item.scope.exerciseId === sourcePrescription.exerciseId &&
      Number.isInteger(item.beforeSampleCount) &&
      Number.isInteger(item.afterSampleCount),
  ),
);
assert.ok(
  evaluated.limitations.some(
    (item) => item.code === "baseline_includes_other_programs",
  ),
);
assert.doesNotMatch(JSON.stringify(evaluated), causalLabels);
// Second intervention from Program B → Program C, same exercise and dimension.
const dossierForC = await reloaded.dossier.execute();
const programBEvidence = dossierForC.evidence.find(
  (item) => item.kind === "training_program" && item.id === programB.id,
);
assert.ok(programBEvidence);
const setB = dayB.prescriptions[0].sets[0];
const decisionC = await new GenerateCoachProposal(
  reloaded.dossier,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new FixtureCoachProposalProvider({
    ...proposalFixture,
    id: crypto.randomUUID(),
    sourceProgramId: programB.id,
    sourceProgramRevision: programB.revision,
    evidenceReferences: [programBEvidence],
    actions: [
      {
        ...proposalFixture.actions[0],
        trainingDayId: dayB.id,
        exercisePrescriptionId: dayB.prescriptions[0].id,
        prescriptionSetId: setB.id,
        rirMin: 1,
        rirMax: 1,
        evidence: [programBEvidence],
      },
    ],
  }),
  decisions,
).execute(coachFixture);
const materializedC = await decisions.materialize(decisionC.id);
const programC = await reloaded.activateProgram.execute(
  materializedC.materializedProgramId,
);
await trainDay(programC.blocks[0].weeks[0].days[0], [
  { actualValue: 8, actualLoadKg: 35, actualRir: 1 },
]);
const allOutcomes = await api.list.execute();
assert.deepEqual(
  allOutcomes.map((item) => item.decisionId).sort(),
  [materialized.id, materializedC.id].sort(),
);
const episodeB = allOutcomes.find(
  (item) => item.decisionId === materialized.id,
);
const episodeC = allOutcomes.find(
  (item) => item.decisionId === materializedC.id,
);
assert.equal(
  episodeB.postIntervention[0].closeReason,
  "intervention_program_ended",
);
assert.equal(episodeB.postIntervention[0].exposures.length, 2);
assert.equal(episodeC.status, "evaluable");
assert.ok(
  episodeC.limitations.some(
    (item) => item.code === "baseline_includes_prior_intervention",
  ),
);
const individual = await api.individual.execute();
assert.equal(individual.length, 1);
assert.equal(individual[0].interventionDimension, "planned_rir");
assert.equal(individual[0].episodeCount, 2);
assert.doesNotMatch(JSON.stringify(individual), causalLabels);
const history = await api.history.execute();
assert.equal(history.totalAvailable, 2);
assert.equal(history.hasMore, false);
const outcomesBeforeReload = await api.list.execute();
const individualBeforeReload = await api.individual.execute();
await reloaded.signOut.execute();
await reloaded.signIn.execute(credentials);
api = outcomeApi();
assert.deepEqual(await api.list.execute(), outcomesBeforeReload);
assert.deepEqual(await api.individual.execute(), individualBeforeReload);

firstClient.auth.stopAutoRefresh();
reloadedClient.auth.stopAutoRefresh();
serviceClient.auth.stopAutoRefresh();
console.log(
  "Local Auth/onboarding/training/workout/performance/dossier/coach/proposal/draft/outcome flow passed.",
);
