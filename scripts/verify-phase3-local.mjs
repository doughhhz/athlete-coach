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
  CreateTrainingProgramWithStructure,
  ProgramCreationConflictError,
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
  BuildIndividualResponseMemory,
  BuildInterventionContext,
  GetResponseMemoryGroup,
  GetExerciseReplacementCandidates,
  AnalyzeAthleteWithCoachAndGovernance,
  ApproveCoachProposal,
  ElevatedReviewConfirmationRequiredError,
  GenerateCoachProposalForAnalysisRequest,
  CoachAnalysisNotFoundError,
  CoachProposalBlockedError,
  StaleCoachAnalysisError,
  analysisProgramFrom,
  CoachAnalysisRequestConflictError,
  PrepareConservativeAutoDraft,
  fingerprintAnalysisRequest,
  BuildCoachDraftReviews,
  GetCoachDraftReviewEvidence,
  ListCoachDraftReviewHistory,
  programToStructureInput,
  structureEdits,
  listDays,
  dayAt,
  cleanDraftEditSession,
  draftEditTransition,
  shouldGuardDraftLeave,
  StructuralInvariantError,
} from "../packages/application/src/index.ts";
import {
  assessCoachAutoDraftEligibility,
  assessCoachProposalGovernance,
  collectDossierEvidenceIds,
} from "../packages/domain/src/index.ts";
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
import {
  SupabaseCoachAnalysisRepository,
  SupabaseCoachDecisionRepository,
  SupabaseCoachPreferenceRepository,
} from "../packages/data-access/src/supabase/coach-decision-repository.ts";
import { SupabaseExerciseCatalogRepository } from "../packages/data-access/src/supabase/exercise-catalog-repositories.ts";

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
    createProgramWithStructure: new CreateTrainingProgramWithStructure(
      programs,
    ),
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
// Root creation only through the atomic boundary (ADR-0100..0103).
const draft = await first.createProgramWithStructure.execute({
  creationRequestId: crypto.randomUUID(),
  name: "Programa local",
  structure: {
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
  },
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
assert.equal(dossierBeforeReload.schemaVersion, "athlete-training-dossier-v7");
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
// Proposals start from a server-owned analysis record (ADR-0078); the
// fixture analysis is recorded as the backend would after validation.
const analysisRuns = new SupabaseCoachAnalysisRepository(
  serviceClient,
  identity.userId,
);
async function authoritative(analysis = coachFixture) {
  const active = await new SupabaseTrainingProgramRepository(
    reloadedClient,
  ).getActive();
  return analysisRuns.recordCompleted({
    analysisRequestId: crypto.randomUUID(),
    requestFingerprint: await fingerprintAnalysisRequest({
      userRequest: "Integração local",
      analysisMode: "question",
    }),
    analysis,
    sourceProgram: active ? { id: active.id, revision: active.revision } : null,
  });
}
const generatedDecision = await new GenerateCoachProposal(
  reloaded.dossier,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new FixtureCoachProposalProvider(proposalFixture),
  decisions,
).execute(await authoritative());
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
    lineageId: block.lineageId ?? undefined,
    sequence: block.sequence,
    name: block.name,
    description: block.description ?? undefined,
    weeks: block.weeks.map((week) => ({
      lineageId: week.lineageId ?? undefined,
      sequence: week.sequence,
      name: week.name ?? undefined,
      notes: week.notes ?? undefined,
      days: week.days.map((day) => ({
        lineageId: day.lineageId ?? undefined,
        sequence: day.sequence,
        name: day.name,
        preferredWeekday: day.preferredWeekday ?? undefined,
        notes: day.notes ?? undefined,
        prescriptions: day.prescriptions.map((prescription) => ({
          lineageId: prescription.lineageId ?? undefined,
          sequence: prescription.sequence,
          exerciseId: prescription.exerciseId,
          instructions: prescription.instructions ?? undefined,
          athleteCues: prescription.athleteCues ?? undefined,
          sets: prescription.sets.map((set) => {
            const edited = editSet(set);
            return {
              lineageId: edited.lineageId ?? undefined,
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
).execute(await authoritative());
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

// Phase 12 — Individual Response Memory & Coach Learning Policy.
// Intervention 3 (C → D): same exercise/dimension, no manual edits.
const dayC = programC.blocks[0].weeks[0].days[0];
const dossierForD = await reloaded.dossier.execute();
const programCEvidence = dossierForD.evidence.find(
  (item) => item.kind === "training_program" && item.id === programC.id,
);
assert.ok(programCEvidence);
const decisionD = await new GenerateCoachProposal(
  reloaded.dossier,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new FixtureCoachProposalProvider({
    ...proposalFixture,
    id: crypto.randomUUID(),
    sourceProgramId: programC.id,
    sourceProgramRevision: programC.revision,
    evidenceReferences: [programCEvidence],
    actions: [
      {
        ...proposalFixture.actions[0],
        trainingDayId: dayC.id,
        exercisePrescriptionId: dayC.prescriptions[0].id,
        prescriptionSetId: dayC.prescriptions[0].sets[0].id,
        rirMin: 2,
        rirMax: 2,
        evidence: [programCEvidence],
      },
    ],
  }),
  decisions,
).execute(await authoritative());
const materializedD = await decisions.materialize(decisionD.id);
const programD = await reloaded.activateProgram.execute(
  materializedD.materializedProgramId,
);
const dayD = programD.blocks[0].weeks[0].days[0];
await trainDay(dayD, [{ actualValue: 9, actualLoadKg: 35, actualRir: 2 }]);
await trainDay(dayD, [{ actualValue: 10, actualLoadKg: 35, actualRir: 2 }]);
const memoryApi = () => {
  const outcomes = new BuildInterventionOutcomes(
    new SupabaseCoachDecisionRepository(reloadedClient, identity.userId),
    new SupabaseTrainingProgramRepository(reloadedClient),
    new SupabasePerformanceReadRepository(reloadedClient),
    new SupabaseBodyWeightRepository(reloadedClient),
    outcomeClock,
  );
  return {
    memory: new BuildIndividualResponseMemory(outcomes),
    group: new GetResponseMemoryGroup(outcomes),
    context: new BuildInterventionContext(outcomes),
  };
};
let memoryUseCases = memoryApi();
const memory = await memoryUseCases.memory.execute();
assert.equal(memory.schemaVersion, "individual-response-memory-v3");
assert.equal(memory.athleteId, identity.id);
assert.equal(memory.groups.totalAvailable, 1);
const rirGroup = memory.groups.items[0];
assert.equal(rirGroup.key, `${sourcePrescription.exerciseId}.planned_rir`);
assert.equal(rirGroup.coverage.totalEpisodes, 3);
assert.equal(rirGroup.coverage.strictComparableEpisodes, 2);
assert.equal(rirGroup.coverage.contextOnlyEpisodes, 1);
const episodeByDecision = Object.fromEntries(
  rirGroup.episodes.items.map((episode) => [episode.decisionId, episode]),
);
// Intervention 1 (A → B) had a manual edit before activation.
assert.equal(
  episodeByDecision[materialized.id].comparability.classification,
  "context_only",
);
assert.ok(
  episodeByDecision[materialized.id].comparability.reasons.includes(
    "unproposed_changes_in_affected_prescription",
  ),
);
assert.equal(
  episodeByDecision[materializedC.id].comparability.classification,
  "strict_comparable",
);
assert.equal(
  episodeByDecision[materializedD.id].comparability.classification,
  "strict_comparable",
);
assert.equal(
  episodeByDecision[materializedC.id].signature.direction,
  "decrease",
);
assert.equal(
  episodeByDecision[materializedD.id].signature.direction,
  "increase",
);
assert.deepEqual(episodeByDecision[materializedD.id].interventionProgram, {
  id: programD.id,
  revision: programD.revision,
});
const rirAggregate = rirGroup.aggregates.find(
  (item) =>
    item.metric === "mean_actual_rir" &&
    item.scope === "affected_prescription_sets",
);
// C: RIR 3 → 1 (−2); D: RIR 1 → 2 (+1). Kept as contradictory observations.
assert.equal(rirAggregate.strictComparableEpisodeCount, 2);
assert.equal(rirAggregate.negativeDeltaCount, 1);
assert.equal(rirAggregate.positiveDeltaCount, 1);
assert.equal(rirAggregate.contradictory, true);
assert.equal(rirAggregate.signPattern, "opposite_signs");
assert.ok(rirAggregate.beforeSampleCountTotal > 0);
assert.ok(rirAggregate.afterSampleCountTotal > 0);
assert.equal(memory.summary.groupsWithContradictoryObservations, 1);
assert.doesNotMatch(
  JSON.stringify(memory),
  /optimal|effectiveness|successScore|responseScore|preferredRir|preferredRest|recommendedLoad|causalEffect|responder/i,
);
const drillDown = await memoryUseCases.group.execute(rirGroup.key);
assert.equal(drillDown.episodes.included, 3);
// Dossier v3 through the single-pass context loader.
const dossierV3 = await new BuildAthleteTrainingDossier(
  reloaded.load,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new SupabaseWorkoutSessionRepository(reloadedClient),
  new SupabasePerformanceReadRepository(reloadedClient),
  outcomeClock,
  memoryUseCases.context,
).execute();
assert.equal(dossierV3.schemaVersion, "athlete-training-dossier-v7");
assert.equal(dossierV3.interventionHistory.totalAvailable, 3);
assert.equal(dossierV3.responseMemory.groups.included, 1);
assert.equal(dossierV3.responseMemory.truncation.groupLimit, 10);
assert.equal(dossierV3.responseMemory.truncation.episodeDetailLimit, 5);
// Coach fake provider receives v3 and cites the memory group; nothing is proposed.
const decisionsBeforeCoach = (
  await new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  ).list()
).length;
const groupEvidence = rirGroup.evidence[0];
let capturedRequest = null;
const learningAnalysis = await new AnalyzeAthleteWithCoach(
  { execute: async () => dossierV3 },
  {
    async analyze(request, requestId) {
      capturedRequest = request;
      return {
        analysis: {
          ...coachFixture,
          requestId,
          summary: "Os episódios observados apontaram em direções diferentes.",
          observations: [
            {
              ...coachFixture.observations[0],
              statement: "Há duas intervenções comparáveis com sinais opostos.",
              evidence: [groupEvidence],
            },
          ],
          evidenceUsed: [groupEvidence],
        },
        provider: "fixture",
        model: "deterministic",
        inputTokens: null,
        outputTokens: null,
      };
    },
  },
  new DeterministicCoachSafetyPolicy(),
  () => "phase12-request",
).execute({
  userRequest: "Já tentamos algo parecido no RIR?",
  analysisMode: "question",
});
assert.equal(
  capturedRequest.dossier.schemaVersion,
  "athlete-training-dossier-v7",
);
assert.equal(
  capturedRequest.dossier.responseMemory.groups.items[0].key,
  rirGroup.key,
);
assert.equal(
  learningAnalysis.metadata.dossierSchemaVersion,
  "athlete-training-dossier-v7",
);
assert.equal(
  (
    await new SupabaseCoachDecisionRepository(
      reloadedClient,
      identity.userId,
    ).list()
  ).length,
  decisionsBeforeCoach,
);
assert.equal((await reloaded.activeProgram.execute())?.id, programD.id);
const memoryBeforeReload = await memoryUseCases.memory.execute();
await reloaded.signOut.execute();
await reloaded.signIn.execute(credentials);
memoryUseCases = memoryApi();
assert.deepEqual(await memoryUseCases.memory.execute(), memoryBeforeReload);

// Phase 13 — set-count interventions.
const exerciseX = sourcePrescription.exerciseId;
const threeSetStructure = () => ({
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
              name: "Treino séries",
              prescriptions: [
                {
                  sequence: 1,
                  exerciseId: exerciseX,
                  sets: [1, 2, 3].map((sequence) => ({
                    sequence,
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
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
// Root creation only through the atomic boundary (ADR-0100..0103).
const draftE = await reloaded.createProgramWithStructure.execute({
  creationRequestId: crypto.randomUUID(),
  name: "Programa séries",
  structure: threeSetStructure(),
});
const programE = await reloaded.activateProgram.execute(draftE.id);
const dayE = programE.blocks[0].weeks[0].days[0];
const allSets = (value) => [1, 2, 3, 4, 5, 6].map(() => value);
await trainDay(
  dayE,
  allSets({ actualValue: 9, actualLoadKg: 30, actualRir: 2 }),
);
await trainDay(
  dayE,
  allSets({ actualValue: 8, actualLoadKg: 30, actualRir: 2 }),
);
async function proposeOn(programX, actions) {
  const dossierNow = await reloaded.dossier.execute();
  const programEvidence = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === programX.id,
  );
  assert.ok(programEvidence);
  const generated = await new GenerateCoachProposal(
    reloaded.dossier,
    new SupabaseTrainingProgramRepository(reloadedClient),
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v2",
      id: crypto.randomUUID(),
      sourceProgramId: programX.id,
      sourceProgramRevision: programX.revision,
      evidenceReferences: [programEvidence],
      actions: actions.map((action) => ({
        rationale: "Considerar mudança de quantidade de séries.",
        evidence: [programEvidence],
        ...action,
      })),
    }),
    decisions,
  ).execute(await authoritative());
  assert.equal(generated.proposal.schemaVersion, "coach-proposal-v2");
  return generated;
}
const plannedCopy = (set) => ({
  targetMetric: set.targetMetric,
  targetMin: set.targetMin,
  targetMax: set.targetMax,
  rirMin: set.rirMin,
  rirMax: set.rirMax,
  restMinSeconds: set.restMinSeconds,
  restMaxSeconds: set.restMaxSeconds,
  tempo: set.tempo,
  loadKind: set.loadKind,
  loadKg: set.loadKg,
});
const prescriptionE = dayE.prescriptions[0];
// Intervention S1: proposal adds one set (3 → 4).
const decisionS1 = await proposeOn(programE, [
  {
    kind: "add_prescription_set",
    trainingDayId: dayE.id,
    exercisePrescriptionId: prescriptionE.id,
    position: "end",
    copyFromPrescriptionSetId: prescriptionE.sets[2].id,
    plannedSet: plannedCopy(prescriptionE.sets[2]),
  },
]);
const materializedS1 = await decisions.materialize(decisionS1.id);
const draftF = await reloaded.getProgram.execute(
  materializedS1.materializedProgramId,
);
assert.equal(draftF.status, "draft");
assert.equal(draftF.blocks[0].weeks[0].days[0].prescriptions[0].sets.length, 4);
assert.deepEqual(
  draftF.blocks[0].weeks[0].days[0].prescriptions[0].sets.map(
    (set) => set.sequence,
  ),
  [1, 2, 3, 4],
);
assert.equal(
  (await reloaded.getProgram.execute(programE.id)).blocks[0].weeks[0].days[0]
    .prescriptions[0].sets.length,
  3,
);
assert.equal((await reloaded.activeProgram.execute())?.id, programE.id);
assert.equal(
  (await decisions.materialize(decisionS1.id)).materializedProgramId,
  draftF.id,
);
// The athlete edits the draft to 5 sets before activating.
const fiveSetStructure = toStructure(draftF);
fiveSetStructure.blocks[0].weeks[0].days[0].prescriptions[0].sets.push({
  ...fiveSetStructure.blocks[0].weeks[0].days[0].prescriptions[0].sets[3],
  // A copied set is a new structural element: it never reuses a lineage.
  lineageId: undefined,
  sequence: 5,
});
await reloaded.saveProgram.execute(draftF.id, fiveSetStructure);
const programF = await reloaded.activateProgram.execute(draftF.id);
const dayF = programF.blocks[0].weeks[0].days[0];
assert.equal(dayF.prescriptions[0].sets.length, 5);
await trainDay(dayF, [
  { actualValue: 9, actualLoadKg: 30, actualRir: 2 },
  { actualValue: 9, actualLoadKg: 30, actualRir: 2 },
  { actualValue: 8, actualLoadKg: 30, actualRir: 2 },
  { actualValue: 8, actualLoadKg: 30, actualRir: 2 },
]);
await trainDay(
  dayF,
  allSets({ actualValue: 8, actualLoadKg: 30, actualRir: 2 }),
);
api = outcomeApi();
const outcomeS1 = await api.get.execute(materializedS1.id);
const setCountS1 = outcomeS1.episode.actions.find(
  (action) => action.dimension === "set_count",
);
assert.equal(outcomeS1.schemaVersion, "intervention-outcome-v3");
assert.deepEqual(
  [
    setCountS1.sourceValue.count,
    setCountS1.proposedValue.count,
    setCountS1.implementedValue.count,
  ],
  [3, 4, 5],
);
assert.equal(
  outcomeS1.interventionFidelity.actions[0].proposedValueImplemented,
  false,
);
const plannedS1 = outcomeS1.comparisons.find(
  (item) =>
    item.metric === "planned_sets_per_exposure" &&
    item.scope.kind === "affected_prescription_sets",
);
const completedS1 = outcomeS1.comparisons.find(
  (item) =>
    item.metric === "completed_sets_per_exposure" &&
    item.scope.kind === "affected_prescription_sets",
);
assert.deepEqual([plannedS1.before, plannedS1.after], [3, 5]);
assert.deepEqual([completedS1.before, completedS1.after], [3, 4.5]);
assert.equal(
  outcomeS1.postIntervention[0].affectedPrescriptionSets.skippedSetCount,
  1,
);
// Intervention S2 (clean): remove one set (5 → 4).
const decisionS2 = await proposeOn(programF, [
  {
    kind: "remove_prescription_set",
    trainingDayId: dayF.id,
    exercisePrescriptionId: dayF.prescriptions[0].id,
    prescriptionSetId: dayF.prescriptions[0].sets[4].id,
  },
]);
const materializedS2 = await decisions.materialize(decisionS2.id);
const programG = await reloaded.activateProgram.execute(
  materializedS2.materializedProgramId,
);
const dayG = programG.blocks[0].weeks[0].days[0];
assert.equal(dayG.prescriptions[0].sets.length, 4);
await trainDay(
  dayG,
  allSets({ actualValue: 10, actualLoadKg: 32.5, actualRir: 2 }),
);
// Intervention S3 (confounded): add one set and change RIR together.
const decisionS3 = await proposeOn(programG, [
  {
    kind: "add_prescription_set",
    trainingDayId: dayG.id,
    exercisePrescriptionId: dayG.prescriptions[0].id,
    position: "end",
    copyFromPrescriptionSetId: null,
    plannedSet: plannedCopy(dayG.prescriptions[0].sets[0]),
  },
  {
    kind: "adjust_prescription_rir",
    trainingDayId: dayG.id,
    exercisePrescriptionId: dayG.prescriptions[0].id,
    prescriptionSetId: dayG.prescriptions[0].sets[0].id,
    rirMin: 1,
    rirMax: 1,
  },
]);
const materializedS3 = await decisions.materialize(decisionS3.id);
const programH = await reloaded.activateProgram.execute(
  materializedS3.materializedProgramId,
);
await trainDay(
  programH.blocks[0].weeks[0].days[0],
  allSets({ actualValue: 9, actualLoadKg: 32.5, actualRir: 1 }),
);
memoryUseCases = memoryApi();
const setMemory = await memoryUseCases.memory.execute();
assert.equal(setMemory.schemaVersion, "individual-response-memory-v3");
const setGroup = setMemory.groups.items.find(
  (group) => group.key === `${exerciseX}.set_count`,
);
assert.ok(setGroup);
assert.equal(setGroup.coverage.totalEpisodes, 3);
assert.equal(setGroup.coverage.strictComparableEpisodes, 1);
assert.equal(setGroup.coverage.contextOnlyEpisodes, 2);
const setEpisodes = Object.fromEntries(
  setGroup.episodes.items.map((episode) => [episode.decisionId, episode]),
);
assert.deepEqual(setEpisodes[materializedS1.id].signature.changes[0].after, {
  dimension: "set_count",
  count: 5,
});
assert.equal(setEpisodes[materializedS1.id].signature.direction, "increase");
assert.equal(
  setEpisodes[materializedS1.id].comparability.classification,
  "context_only",
);
assert.equal(setEpisodes[materializedS2.id].signature.direction, "decrease");
assert.equal(
  setEpisodes[materializedS2.id].comparability.classification,
  "strict_comparable",
);
assert.ok(
  setEpisodes[materializedS3.id].comparability.reasons.includes(
    "multiple_variables_changed_concurrently",
  ),
);
const plannedAggregate = setGroup.aggregates.find(
  (item) =>
    item.metric === "planned_sets_per_exposure" &&
    item.scope === "affected_prescription_sets",
);
assert.equal(plannedAggregate.strictComparableEpisodeCount, 1);
assert.equal(plannedAggregate.negativeDeltaCount, 1);
assert.doesNotMatch(
  JSON.stringify(setMemory),
  /optimal|preferred|bestVolume|muscle|effectiveSet|hardSet|tonnage/i,
);
// Dossier v4 + fake Coach receives it; nothing is proposed or activated.
const dossierV4 = await new BuildAthleteTrainingDossier(
  reloaded.load,
  new SupabaseTrainingProgramRepository(reloadedClient),
  new SupabaseWorkoutSessionRepository(reloadedClient),
  new SupabasePerformanceReadRepository(reloadedClient),
  outcomeClock,
  memoryUseCases.context,
).execute();
assert.equal(dossierV4.schemaVersion, "athlete-training-dossier-v7");
assert.ok(
  dossierV4.responseMemory.groups.items.some(
    (group) => group.key === setGroup.key,
  ),
);
const decisionsBeforeV4 = (
  await new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  ).list()
).length;
let capturedV4 = null;
await new AnalyzeAthleteWithCoach(
  { execute: async () => dossierV4 },
  {
    async analyze(request, requestId) {
      capturedV4 = request;
      return {
        analysis: {
          ...coachFixture,
          requestId,
          observations: [
            {
              ...coachFixture.observations[0],
              statement:
                "Há uma intervenção comparável de quantidade de séries.",
              evidence: [setGroup.evidence[0]],
            },
          ],
          evidenceUsed: [setGroup.evidence[0]],
        },
        provider: "fixture",
        model: "deterministic",
        inputTokens: null,
        outputTokens: null,
      };
    },
  },
  new DeterministicCoachSafetyPolicy(),
  () => "phase13-request",
).execute({ userRequest: "E as séries?", analysisMode: "question" });
assert.equal(capturedV4.dossier.schemaVersion, "athlete-training-dossier-v7");
assert.equal(
  (
    await new SupabaseCoachDecisionRepository(
      reloadedClient,
      identity.userId,
    ).list()
  ).length,
  decisionsBeforeV4,
);
assert.equal((await reloaded.activeProgram.execute())?.id, programH.id);
const setMemoryBeforeReload = await memoryUseCases.memory.execute();
await reloaded.signOut.execute();
await reloaded.signIn.execute(credentials);
memoryUseCases = memoryApi();
assert.deepEqual(await memoryUseCases.memory.execute(), setMemoryBeforeReload);

// Phase 14 — reviewed exercise replacement (real seeded catalog relations).
const EX_X = "50000000-0000-4000-8000-000000000001"; // barbell bench
const EX_Y = "50000000-0000-4000-8000-000000000002"; // dumbbell bench ("Y variation_of X")
const EX_Z = "50000000-0000-4000-8000-000000000003"; // incline dumbbell (no stored relation to X)
assert.equal(exerciseX, EX_X);
const catalogRepository = new SupabaseExerciseCatalogRepository(reloadedClient);
const replacementCandidates = new GetExerciseReplacementCandidates(
  catalogRepository,
);
const replacementApi = () => {
  const outcomes = new BuildInterventionOutcomes(
    new SupabaseCoachDecisionRepository(reloadedClient, identity.userId),
    new SupabaseTrainingProgramRepository(reloadedClient),
    new SupabasePerformanceReadRepository(reloadedClient),
    new SupabaseBodyWeightRepository(reloadedClient),
    outcomeClock,
    catalogRepository,
  );
  return {
    outcomes,
    get: new GetCoachDecisionOutcome(outcomes),
    memory: new BuildIndividualResponseMemory(outcomes),
    dossier: new BuildAthleteTrainingDossier(
      reloaded.load,
      new SupabaseTrainingProgramRepository(reloadedClient),
      new SupabaseWorkoutSessionRepository(reloadedClient),
      new SupabasePerformanceReadRepository(reloadedClient),
      outcomeClock,
      new BuildInterventionContext(outcomes),
      replacementCandidates,
    ),
  };
};
// Program R: X with absolute load, then baseline workouts on X.
const absoluteStructure = threeSetStructure();
absoluteStructure.blocks[0].weeks[0].days[0].prescriptions[0].sets = [1, 2].map(
  (sequence) => ({
    sequence,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 2,
    rirMax: 2,
    restMinSeconds: 120,
    restMaxSeconds: 120,
    tempo: null,
    loadKind: "absolute",
    loadKg: 40,
  }),
);
// Root creation only through the atomic boundary (ADR-0100..0103).
const draftR = await reloaded.createProgramWithStructure.execute({
  creationRequestId: crypto.randomUUID(),
  name: "Programa troca",
  structure: absoluteStructure,
});
const programR = await reloaded.activateProgram.execute(draftR.id);
const dayR = programR.blocks[0].weeks[0].days[0];
await trainDay(
  dayR,
  allSets({ actualValue: 9, actualLoadKg: 40, actualRir: 2 }),
);
await trainDay(
  dayR,
  allSets({ actualValue: 8, actualLoadKg: 42.5, actualRir: 2 }),
);
let rApi = replacementApi();
const dossierR = await rApi.dossier.execute();
assert.equal(dossierR.schemaVersion, "athlete-training-dossier-v7");
const candidateSet = dossierR.exerciseReplacementCandidates.items.find(
  (item) => item.sourceExerciseId === EX_X,
);
assert.ok(candidateSet, "candidates only for the active program exercises");
assert.equal(dossierR.exerciseReplacementCandidates.items.length, 1);
const candidateY = candidateSet.candidates.find(
  (item) => item.exerciseId === EX_Y,
);
assert.deepEqual(candidateY.relations, [
  { relationType: "variation_of", direction: "candidate_to_source" },
]);
assert.ok(!candidateSet.candidates.some((item) => item.exerciseId === EX_Z));
const programREvidence = dossierR.evidence.find(
  (item) => item.kind === "training_program" && item.id === programR.id,
);
const prescriptionR = dayR.prescriptions[0];
async function proposeReplacement(
  programX,
  dayX,
  sourceExercise,
  target,
  transition,
) {
  const dossierNow = await replacementApi().dossier.execute();
  const programEvidence = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === programX.id,
  );
  const candidate = dossierNow.exerciseReplacementCandidates.items
    .find((item) => item.sourceExerciseId === sourceExercise)
    .candidates.find((item) => item.exerciseId === target);
  return new GenerateCoachProposal(
    replacementApi().dossier,
    new SupabaseTrainingProgramRepository(reloadedClient),
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v3",
      id: crypto.randomUUID(),
      sourceProgramId: programX.id,
      sourceProgramRevision: programX.revision,
      evidenceReferences: [programEvidence],
      actions: [
        {
          kind: "replace_exercise",
          trainingDayId: dayX.id,
          exercisePrescriptionId: dayX.prescriptions[0].id,
          sourceExerciseId: sourceExercise,
          replacementExerciseId: target,
          relationshipContext: candidate.relations,
          loadTransition: transition,
          rationale: "Disponibilidade de equipamento.",
          evidence: [programEvidence],
        },
      ],
    }),
    decisions,
  ).execute(await authoritative());
}
// An invented / unrelated target is rejected before persistence.
await assert.rejects(async () =>
  new GenerateCoachProposal(
    rApi.dossier,
    new SupabaseTrainingProgramRepository(reloadedClient),
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v3",
      id: crypto.randomUUID(),
      sourceProgramId: programR.id,
      sourceProgramRevision: programR.revision,
      evidenceReferences: [programREvidence],
      actions: [
        {
          kind: "replace_exercise",
          trainingDayId: dayR.id,
          exercisePrescriptionId: prescriptionR.id,
          sourceExerciseId: EX_X,
          replacementExerciseId: EX_Z,
          relationshipContext: [
            { relationType: "variation_of", direction: "candidate_to_source" },
          ],
          loadTransition: { mode: "athlete_selected" },
          rationale: "r",
          evidence: [programREvidence],
        },
      ],
    }),
    decisions,
  ).execute(await authoritative()),
);
const decisionX = await proposeReplacement(programR, dayR, EX_X, EX_Y, {
  mode: "athlete_selected",
});
assert.equal(decisionX.proposal.schemaVersion, "coach-proposal-v3");
const materializedX = await decisions.materialize(decisionX.id);
const draftXY = await reloaded.getProgram.execute(
  materializedX.materializedProgramId,
);
const draftPrescription = draftXY.blocks[0].weeks[0].days[0].prescriptions[0];
assert.equal(draftXY.status, "draft");
assert.equal(draftPrescription.exerciseId, EX_Y);
assert.deepEqual(
  draftPrescription.sets.map((item) => [
    item.sequence,
    item.targetMin,
    item.loadKind,
    item.loadKg,
  ]),
  [
    [1, 8, "athlete_selected", null],
    [2, 8, "athlete_selected", null],
  ],
);
const programRAfter = await reloaded.getProgram.execute(programR.id);
assert.equal(
  programRAfter.blocks[0].weeks[0].days[0].prescriptions[0].exerciseId,
  EX_X,
);
assert.deepEqual(
  programRAfter.blocks[0].weeks[0].days[0].prescriptions[0].sets.map(
    (item) => item.loadKg,
  ),
  [40, 40],
);
assert.equal((await reloaded.activeProgram.execute())?.id, programR.id);
assert.equal(
  (await decisions.materialize(decisionX.id)).materializedProgramId,
  draftXY.id,
);
// The athlete swaps the draft to Z before activating.
const editedStructure = toStructure(draftXY);
editedStructure.blocks[0].weeks[0].days[0].prescriptions[0].exerciseId = EX_Z;
await reloaded.saveProgram.execute(draftXY.id, editedStructure);
const programS = await reloaded.activateProgram.execute(draftXY.id);
const dayS = programS.blocks[0].weeks[0].days[0];
assert.equal(dayS.prescriptions[0].exerciseId, EX_Z);
await trainDay(
  dayS,
  allSets({ actualValue: 10, actualLoadKg: 14, actualRir: 2 }),
);
await trainDay(
  dayS,
  allSets({ actualValue: 9, actualLoadKg: 16, actualRir: 2 }),
);
rApi = replacementApi();
const outcomeX = await rApi.get.execute(materializedX.id);
assert.equal(outcomeX.schemaVersion, "intervention-outcome-v3");
const replaceSnapshot = outcomeX.episode.actions[0];
assert.equal(replaceSnapshot.proposedValue.exerciseId, EX_Y);
assert.equal(replaceSnapshot.implementedValue.exerciseId, EX_Z);
assert.equal(
  outcomeX.interventionFidelity.actions[0].proposedValueImplemented,
  false,
);
assert.deepEqual(replaceSnapshot.replacement.actualRelationshipContext, []);
assert.ok(
  outcomeX.limitations.some(
    (item) => item.code === "replacement_relation_missing",
  ),
);
const [pairX] = outcomeX.crossExercisePairs;
assert.deepEqual([pairX.beforeExerciseId, pairX.afterExerciseId], [EX_X, EX_Z]);
assert.equal(pairX.baseline.exposures.length, 3);
assert.equal(pairX.postIntervention.exposures.length, 2);
assert.equal(pairX.baseline.exercise.bestLoggedLoadKg, 42.5);
assert.equal(pairX.postIntervention.exercise.bestLoggedLoadKg, 16);
assert.deepEqual(pairX.nonComparableMetrics, [
  "best_logged_load_kg",
  "best_estimated_one_rep_max_kg",
]);
assert.ok(pairX.sideBySide.every((fact) => !("absoluteDelta" in fact)));
assert.ok(
  !outcomeX.comparisons.some(
    (item) => item.scope.exerciseId === EX_Z || item.metric.includes("load"),
  ),
  "no cross-exercise load/e1RM delta",
);
const bests = await reloaded.personalBests.execute();
assert.equal(
  bests.find((item) => item.exerciseId === EX_X).maxLoggedLoadKg,
  42.5,
);
assert.equal(
  bests.find((item) => item.exerciseId === EX_Z).maxLoggedLoadKg,
  16,
);
assert.equal(pairX.replacementPriorHistory.available, false);
// Second, clean replacement: Z → Y (stored relation), non-absolute load kept.
const decisionZ = await proposeReplacement(programS, dayS, EX_Z, EX_Y, {
  mode: "preserve_non_absolute",
});
const materializedZ = await decisions.materialize(decisionZ.id);
const programT = await reloaded.activateProgram.execute(
  materializedZ.materializedProgramId,
);
await trainDay(
  programT.blocks[0].weeks[0].days[0],
  allSets({ actualValue: 10, actualLoadKg: 18, actualRir: 2 }),
);
rApi = replacementApi();
const replacementMemory = await rApi.memory.execute();
const groupXZ = replacementMemory.groups.items.find(
  (group) => group.key === `${EX_X}.exercise_replacement.${EX_Z}`,
);
const groupZY = replacementMemory.groups.items.find(
  (group) => group.key === `${EX_Z}.exercise_replacement.${EX_Y}`,
);
assert.ok(groupXZ && groupZY, "directed replacement groups");
assert.ok(
  !replacementMemory.groups.items.some(
    (group) => group.key === `${EX_X}.exercise_replacement.${EX_Y}`,
  ),
  "proposed-but-not-activated pair is not a group",
);
assert.equal(
  groupXZ.episodes.items[0].comparability.classification,
  "context_only",
);
assert.equal(
  groupZY.episodes.items[0].comparability.classification,
  "strict_comparable",
);
assert.deepEqual(groupZY.aggregates, []);
assert.deepEqual(groupZY.replacementSummary.relationTypesObserved, [
  "variation_of:source_to_candidate",
]);
assert.equal(
  groupZY.episodes.items[0].crossExercisePair.replacementPriorHistoryAvailable,
  false,
);
assert.equal(groupXZ.replacementSummary.episodesWithoutStoredRelation, 1);
assert.doesNotMatch(
  JSON.stringify(replacementMemory),
  /bestExercise|best exercise|effectiveness|superior|ranking|score/i,
);
// Dossier v5 reaches the (fake) Coach; nothing is proposed or activated.
const dossierV5 = await rApi.dossier.execute();
assert.equal(dossierV5.schemaVersion, "athlete-training-dossier-v7");
assert.deepEqual(
  dossierV5.exerciseReplacementCandidates.items.map(
    (item) => item.sourceExerciseId,
  ),
  [EX_Y],
);
const decisionsBeforeV5 = (
  await new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  ).list()
).length;
let capturedV5 = null;
await new AnalyzeAthleteWithCoach(
  { execute: async () => dossierV5 },
  {
    async analyze(request, requestId) {
      capturedV5 = request;
      return {
        analysis: { ...coachFixture, requestId },
        provider: "fixture",
        model: "deterministic",
        inputTokens: null,
        outputTokens: null,
      };
    },
  },
  new DeterministicCoachSafetyPolicy(),
  () => "phase14-request",
).execute({ userRequest: "Posso trocar o supino?", analysisMode: "question" });
assert.equal(capturedV5.dossier.schemaVersion, "athlete-training-dossier-v7");
assert.ok(capturedV5.dossier.exerciseReplacementCandidates);
assert.equal(
  (
    await new SupabaseCoachDecisionRepository(
      reloadedClient,
      identity.userId,
    ).list()
  ).length,
  decisionsBeforeV5,
);
assert.equal((await reloaded.activeProgram.execute())?.id, programT.id);
const replacementMemoryBeforeReload = await rApi.memory.execute();
const outcomeXBeforeReload = await rApi.get.execute(materializedX.id);
await reloaded.signOut.execute();
await reloaded.signIn.execute(credentials);
rApi = replacementApi();
assert.deepEqual(await rApi.memory.execute(), replacementMemoryBeforeReload);
assert.deepEqual(
  await rApi.get.execute(materializedX.id),
  outcomeXBeforeReload,
);

// Phase 15 — governed proactive mode (ADR-0074..0077). ----------------------
{
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  assert.equal((await reloaded.activeProgram.execute()).id, programT.id);
  const dayT = programT.blocks[0].weeks[0].days[0];
  const setT = dayT.prescriptions[0].sets[0];
  const dossierNow = await rApi.dossier.execute();
  const programEvidence = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === programT.id,
  );
  assert.ok(programEvidence);
  const at = {
    trainingDayId: dayT.id,
    exercisePrescriptionId: dayT.prescriptions[0].id,
    prescriptionSetId: setT.id,
    rationale: "Ajuste proposto para revisão.",
    evidence: [programEvidence],
  };
  const standardAction = {
    kind: "adjust_prescription_rir",
    ...at,
    rirMin: setT.rirMin + 1,
    rirMax: setT.rirMax + 1,
  };
  const elevatedAction = {
    kind: "adjust_prescription_target",
    ...at,
    targetMetric: setT.targetMetric,
    targetMin: setT.targetMin,
    targetMax: setT.targetMax + 1,
  };
  const calls = { provider: 0 };
  const providerFor = (actions) => ({
    async generate(input, requestId) {
      calls.provider += 1;
      if (actions === null) return null;
      return new FixtureCoachProposalProvider({
        ...proposalFixture,
        schemaVersion: "coach-proposal-v3",
        id: crypto.randomUUID(),
        sourceProgramId: programT.id,
        sourceProgramRevision: programT.revision,
        evidenceReferences: [programEvidence],
        actions,
      }).generate(input, requestId);
    },
  });
  const analyzeWith = (analysisValue) =>
    new AnalyzeAthleteWithCoach(
      { execute: async () => dossierNow },
      {
        async analyze(_request, requestId) {
          return {
            analysis: { ...analysisValue, requestId },
            provider: "fixture",
            model: "deterministic",
            inputTokens: null,
            outputTokens: null,
          };
        },
      },
      new DeterministicCoachSafetyPolicy(),
    );
  const generator = (actions) =>
    new GenerateCoachProposal(
      { execute: async () => dossierNow },
      new SupabaseTrainingProgramRepository(reloadedClient),
      providerFor(actions),
      decisions,
    );
  const ask = (
    actions,
    analysisRequestId = crypto.randomUUID(),
    analysisValue = coachFixture,
  ) =>
    new AnalyzeAthleteWithCoachAndGovernance(
      analyzeWith(analysisValue),
      analysisRuns,
      analysisProgramFrom({ execute: async () => dossierNow }),
      generator(actions),
      preferences,
    ).execute({
      userRequest: "Como está meu treino?",
      analysisMode: "question",
      analysisRequestId,
    });
  const ledgerSize = async () => (await readDecisions.list()).length;

  // 1-3. Default is manual; a manual analysis never makes the second call.
  assert.equal(await preferences.getAutonomyMode(), "manual");
  const sizeStart = await ledgerSize();
  const manualRun = await ask([standardAction]);
  assert.equal(manualRun.proactiveProposal.status, "not_enabled");
  assert.equal(manualRun.analysis.analysisId, coachFixture.analysisId);
  assert.equal(calls.provider, 0);
  assert.equal(await ledgerSize(), sizeStart);
  // 4-5. Explicit opt-in persists; an unknown mode is rejected.
  assert.equal(await preferences.setAutonomyMode("proactive"), "proactive");
  assert.equal(await preferences.getAutonomyMode(), "proactive");
  const invalidMode = await reloadedClient
    .from("athlete_coach_preferences")
    .update({ autonomy_mode: "autonomous" })
    .eq("autonomy_mode", "proactive");
  assert.ok(invalidMode.error, "invalid autonomy mode rejected");
  // 6-10. Proactive prepares a standard proposal for review only.
  const requestA = crypto.randomUUID();
  const proactiveRun = await ask([standardAction], requestA);
  assert.equal(proactiveRun.proactiveProposal.status, "prepared");
  const prepared = proactiveRun.proactiveProposal.decision;
  assert.equal(prepared.status, "proposed");
  assert.equal(prepared.proposalOrigin, "proactive");
  assert.equal(prepared.autonomyModeAtCreation, "proactive");
  assert.equal(prepared.analysisRequestId, requestA);
  assert.deepEqual(prepared.governance, {
    policyVersion: "coach-governance-v1",
    reviewClass: "standard_review",
    reasons: ["planned_rir_increase"],
  });
  assert.equal(calls.provider, 1);
  assert.equal((await reloaded.activeProgram.execute()).id, programT.id);
  // 11-13. Retries of the same analysis request are idempotent.
  const retry = await ask([standardAction], requestA);
  assert.equal(retry.proactiveProposal.decision.id, prepared.id);
  const manualSame = await new GenerateCoachProposalForAnalysisRequest(
    analysisRuns,
    generator([standardAction]),
  ).execute({ analysisRequestId: requestA });
  assert.equal(manualSame.id, prepared.id);
  assert.equal(calls.provider, 1);
  // 14-16. Clients cannot forge origin/review class; history is immutable.
  const forgedInsert = await reloadedClient
    .from("coach_decisions")
    .insert({ athlete_id: prepared.athleteId, proposal_origin: "proactive" });
  assert.ok(forgedInsert.error, "client cannot insert decisions");
  const forgedRpc = await reloadedClient.rpc("create_coach_decision", {
    p_user_id: identity.userId,
    p_proposal: prepared.proposal,
    p_envelope: { proposalOrigin: "proactive", reviewClass: "standard_review" },
  });
  assert.ok(forgedRpc.error, "client cannot call governed creation");
  const downgrade = await serviceClient
    .from("coach_decisions")
    .update({ review_class: "standard_review", proposal_origin: "manual" })
    .eq("id", prepared.id);
  assert.ok(downgrade.error, "governance envelope is immutable history");
  // 17-19. No change, invalid and safety-blocked runs keep the analysis.
  const sizeBeforeFailures = await ledgerSize();
  const noChangeRun = await ask(null);
  assert.equal(noChangeRun.proactiveProposal.status, "no_change");
  const invalid = await ask([
    { ...standardAction, prescriptionSetId: crypto.randomUUID() },
  ]);
  assert.equal(invalid.proactiveProposal.status, "invalid");
  assert.equal(invalid.analysis.analysisId, coachFixture.analysisId);
  const providerCallsBeforeSafety = calls.provider;
  const blocked = await ask([standardAction], crypto.randomUUID(), {
    ...coachFixture,
    safetyFlags: [
      {
        kind: "acute_pain",
        message: "Procure avaliação profissional.",
        blocksTrainingAdvice: true,
      },
    ],
  });
  assert.equal(blocked.proactiveProposal.status, "blocked");
  assert.equal(calls.provider, providerCallsBeforeSafety);
  // Authoritative handoff: the server-owned safety state wins; a forged
  // client payload is rejected and never reaches the provider.
  const handoff = new GenerateCoachProposalForAnalysisRequest(
    analysisRuns,
    generator([standardAction]),
  );
  const storedBlocked = await analysisRuns.findByRequestId(
    blocked.analysisRequestId,
  );
  assert.equal(storedBlocked.trainingAdviceBlocked, true);
  for (const forged of [
    {
      analysisRequestId: blocked.analysisRequestId,
      safetyFlags: [],
      blocksTrainingAdvice: false,
    },
    { analysisRequestId: blocked.analysisRequestId, analysis: coachFixture },
    { analysis: coachFixture },
  ])
    await assert.rejects(() => handoff.execute(forged));
  await assert.rejects(
    () => handoff.execute({ analysisRequestId: blocked.analysisRequestId }),
    CoachProposalBlockedError,
  );
  // Another athlete's (or an unknown) id is indistinguishable: not found.
  await assert.rejects(
    () =>
      new GenerateCoachProposalForAnalysisRequest(
        new SupabaseCoachAnalysisRepository(serviceClient, crypto.randomUUID()),
        generator([standardAction]),
      ).execute({ analysisRequestId: requestA }),
    CoachAnalysisNotFoundError,
  );
  await assert.rejects(
    () => handoff.execute({ analysisRequestId: crypto.randomUUID() }),
    CoachAnalysisNotFoundError,
  );
  assert.equal(calls.provider, providerCallsBeforeSafety);
  const blockedRecordWrite = await serviceClient
    .from("coach_analysis_runs")
    .update({ training_advice_blocked: false })
    .eq("analysis_request_id", blocked.analysisRequestId);
  assert.ok(blockedRecordWrite.error, "authoritative analysis is immutable");
  const clientRead = await reloadedClient
    .from("coach_analysis_runs")
    .select("id");
  assert.ok(clientRead.error, "mobile client cannot read analysis runs");
  assert.equal(await ledgerSize(), sizeBeforeFailures);
  // 20-22. The backend (not the model) classifies an elevated proposal.
  const elevated = (await ask([elevatedAction])).proactiveProposal.decision;
  assert.equal(elevated.governance.reviewClass, "elevated_review");
  assert.deepEqual(elevated.governance.reasons, ["target_change"]);
  const approve = new ApproveCoachProposal(
    readDecisions,
    new SupabaseTrainingProgramRepository(reloadedClient),
    decisions,
  );
  // 23-25. Elevated review requires explicit confirmation.
  await assert.rejects(
    () => approve.execute(elevated.id, { reviewClass: "standard_review" }),
    ElevatedReviewConfirmationRequiredError,
  );
  assert.equal((await readDecisions.get(elevated.id)).status, "proposed");
  const confirmed = await approve.execute(elevated.id, {
    confirmElevatedReview: true,
  });
  assert.equal(confirmed.status, "materialized");
  // 26. Materialization creates only a draft; nothing is activated.
  const confirmedDraft = await reloaded.getProgram.execute(
    confirmed.materializedProgramId,
  );
  assert.equal(confirmedDraft.status, "draft");
  assert.equal((await reloaded.activeProgram.execute()).id, programT.id);
  // 27. Legacy (pre-governance) rows stay readable with a null envelope.
  const legacy = await serviceClient.rpc("create_coach_decision", {
    p_user_id: identity.userId,
    p_proposal: {
      ...prepared.proposal,
      id: crypto.randomUUID(),
      analysisId: crypto.randomUUID(),
    },
  });
  assert.equal(legacy.error, null);
  const legacyRead = await readDecisions.get(legacy.data.id);
  assert.equal(legacyRead.governance, null);
  assert.equal(legacyRead.proposalOrigin, "manual");
  // 28-29. Only an explicit human activation changes the active program;
  // a standard review then needs no confirmation but the ledger marks the
  // outdated proposal stale instead of creating a second draft.
  await reloaded.activateProgram.execute(confirmedDraft.id);
  const standardAfterActivation = await approve.execute(prepared.id);
  assert.equal(standardAfterActivation.status, "stale");
  assert.equal((await reloaded.activeProgram.execute()).id, confirmedDraft.id);
  // An analysis of the previous program is stale: no provider call, no decision.
  const providerCallsBeforeStale = calls.provider;
  const ledgerBeforeStale = await ledgerSize();
  await assert.rejects(
    () =>
      new GenerateCoachProposalForAnalysisRequest(
        analysisRuns,
        generator([standardAction]),
      ).execute({ analysisRequestId: noChangeRun.analysisRequestId }),
    StaleCoachAnalysisError,
  );
  assert.equal(calls.provider, providerCallsBeforeStale);
  assert.equal(await ledgerSize(), ledgerBeforeStale);
  // 30. History exposes origin and review class, never a risk score.
  const history = await readDecisions.list();
  const byId = Object.fromEntries(history.map((item) => [item.id, item]));
  assert.equal(byId[prepared.id].proposalOrigin, "proactive");
  assert.equal(byId[elevated.id].governance.reviewClass, "elevated_review");
  assert.doesNotMatch(
    JSON.stringify(history.map((item) => item.governance)),
    /risk|score|baixo|alto/i,
  );
  // 31. Opt-out returns to manual and survives sign-out/sign-in.
  await preferences.setAutonomyMode("manual");
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.equal(await preferences.getAutonomyMode(), "manual");
  // 32. Outcomes/memory still build over governed decisions.
  const memoryAfter = await replacementApi().memory.execute();
  assert.ok(memoryAfter.groups.items.length >= 2);
}

// Implementation Phase 16 — Conservative Auto-Draft (ADR-0082..0086). ---------
{
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  const programsRepo = new SupabaseTrainingProgramRepository(reloadedClient);
  // 1-4. Defaults: manual proposals and manual drafts; one active program.
  assert.equal(await preferences.getAutonomyMode(), "manual");
  assert.equal(await preferences.getDraftAuthorityMode(), "manual_draft");
  const programA = await reloaded.activeProgram.execute();
  assert.equal(programA.status, "active");
  const dayA = programA.blocks[0].weeks[0].days[0];
  const prescriptionA =
    dayA.prescriptions.find((item) => item.sets.length > 1) ??
    dayA.prescriptions[0];
  assert.ok(
    prescriptionA.sets.length > 1,
    "fixture needs a multi-set prescription",
  );
  const [setA1, setA2] = prescriptionA.sets;
  const phaseApi = replacementApi();
  const dossierA = await phaseApi.dossier.execute();
  const evidenceA = dossierA.evidence.find(
    (item) => item.kind === "training_program" && item.id === programA.id,
  );
  assert.ok(evidenceA, "training evidence for Program A");
  const at = (set) => ({
    trainingDayId: dayA.id,
    exercisePrescriptionId: prescriptionA.id,
    prescriptionSetId: set.id,
    rationale: "Ajuste conservador para revisão.",
    evidence: [evidenceA],
  });
  const rirUp = (set) => ({
    kind: "adjust_prescription_rir",
    ...at(set),
    rirMin: (set.rirMin ?? 1) + 1,
    rirMax: (set.rirMax ?? 1) + 1,
  });
  const restUp = (set) => ({
    kind: "adjust_prescription_rest",
    ...at(set),
    restMinSeconds: (set.restMinSeconds ?? 60) + 30,
    restMaxSeconds: (set.restMaxSeconds ?? 60) + 30,
  });
  const removeSet = {
    kind: "remove_prescription_set",
    ...at(setA2),
  };
  const calls = { provider: 0 };
  const providerFor = (actions) => ({
    async generate(input, requestId) {
      calls.provider += 1;
      return new FixtureCoachProposalProvider({
        ...proposalFixture,
        schemaVersion: "coach-proposal-v3",
        id: crypto.randomUUID(),
        sourceProgramId: programA.id,
        sourceProgramRevision: programA.revision,
        evidenceReferences: [evidenceA],
        actions,
      }).generate(input, requestId);
    },
  });
  const autoDraft = new PrepareConservativeAutoDraft(
    preferences,
    programsRepo,
    decisions,
  );
  const ask = (actions, analysisRequestId = crypto.randomUUID(), question) =>
    new AnalyzeAthleteWithCoachAndGovernance(
      new AnalyzeAthleteWithCoach(
        { execute: async () => dossierA },
        {
          async analyze(_request, requestId) {
            return {
              analysis: { ...coachFixture, requestId },
              provider: "fixture",
              model: "deterministic",
              inputTokens: null,
              outputTokens: null,
            };
          },
        },
        new DeterministicCoachSafetyPolicy(),
      ),
      analysisRuns,
      analysisProgramFrom({ execute: async () => dossierA }),
      new GenerateCoachProposal(
        { execute: async () => dossierA },
        programsRepo,
        providerFor(actions),
        decisions,
      ),
      preferences,
      undefined,
      autoDraft,
    ).execute({
      userRequest: question ?? "Posso ajustar meu treino?",
      analysisMode: "question",
      analysisRequestId,
    });
  const draftsOfA = async () =>
    (await programsRepo.list()).filter(
      (item) => item.supersedesProgramId === programA.id,
    );
  // 5-9. Proactive only: the proposal is prepared, no draft is created.
  await preferences.setAutonomyMode("proactive");
  const offRun = await ask([rirUp(setA1)]);
  assert.equal(offRun.proactiveProposal.status, "prepared");
  assert.equal(offRun.autoDraft.status, "not_enabled");
  assert.equal(offRun.proactiveProposal.decision.status, "proposed");
  assert.equal(
    offRun.proactiveProposal.decision.autoDraft.eligibility,
    "eligible",
  );
  assert.equal((await draftsOfA()).length, 0);
  // 10-18. Explicit conservative opt-in: an eligible proposal becomes a draft.
  assert.equal(
    await preferences.setDraftAuthorityMode("standard_auto_draft"),
    "standard_auto_draft",
  );
  const requestB = crypto.randomUUID();
  const onRun = await ask([rirUp(setA2)], requestB);
  const autoDecision = onRun.autoDraft.decision;
  assert.equal(onRun.proactiveProposal.status, "prepared");
  assert.equal(
    onRun.proactiveProposal.decision.governance.reviewClass,
    "standard_review",
  );
  assert.deepEqual(onRun.autoDraft.reasons, ["planned_rir_increase"]);
  assert.equal(onRun.autoDraft.policyVersion, "coach-auto-draft-v1");
  assert.equal(onRun.autoDraft.status, "materialized");
  assert.equal(autoDecision.materializationOrigin, "auto_draft");
  assert.equal(autoDecision.approvedAt, null);
  const programB = await reloaded.getProgram.execute(
    onRun.autoDraft.draftProgramId,
  );
  assert.equal(programB.status, "draft");
  assert.equal(programB.supersedesProgramId, programA.id);
  assert.equal((await reloaded.activeProgram.execute()).id, programA.id);
  // 19. Retry of the same request: same analysis, decision and draft.
  const providerBeforeRetry = calls.provider;
  const retryRun = await ask([rirUp(setA2)], requestB);
  assert.equal(retryRun.analysisReused, true);
  assert.equal(retryRun.proactiveProposal.decision.id, autoDecision.id);
  assert.equal(retryRun.autoDraft.status, "materialized");
  assert.equal(retryRun.autoDraft.draftProgramId, programB.id);
  assert.equal((await draftsOfA()).length, 1);
  assert.equal(calls.provider, providerBeforeRetry);
  // Concurrent-ish retries still leave a single draft (ledger row lock + lineage).
  await Promise.all([
    autoDraft.execute(
      autoDecision,
      await analysisRuns.findByRequestId(requestB),
    ),
    autoDraft.execute(
      autoDecision,
      await analysisRuns.findByRequestId(requestB),
    ),
  ]);
  assert.equal((await draftsOfA()).length, 1);
  // 20. Same id with a changed question: conflict, no provider, record intact.
  await assert.rejects(
    () => ask([rirUp(setA2)], requestB, "Outra pergunta"),
    CoachAnalysisRequestConflictError,
  );
  assert.equal(calls.provider, providerBeforeRetry);
  assert.equal(
    (await analysisRuns.findByRequestId(requestB)).analysis.analysisId,
    onRun.analysis.analysisId,
  );
  // 21-22. Elevated exercise replacement: never auto-drafted.
  const candidateGroup = dossierA.exerciseReplacementCandidates.items.find(
    (item) =>
      item.sourceExerciseId === prescriptionA.exerciseId &&
      item.candidates.length,
  );
  assert.ok(candidateGroup, "replacement candidate for Program A");
  const [candidate] = candidateGroup.candidates;
  const replaceRun = await ask([
    {
      kind: "replace_exercise",
      trainingDayId: dayA.id,
      exercisePrescriptionId: prescriptionA.id,
      sourceExerciseId: prescriptionA.exerciseId,
      replacementExerciseId: candidate.exerciseId,
      relationshipContext: candidate.relations,
      loadTransition: { mode: "athlete_selected" },
      rationale: "Disponibilidade de equipamento.",
      evidence: [evidenceA],
    },
  ]);
  assert.equal(
    replaceRun.proactiveProposal.decision.governance.reviewClass,
    "elevated_review",
  );
  assert.equal(replaceRun.autoDraft.status, "ineligible");
  assert.ok(replaceRun.autoDraft.reasons.includes("exercise_replacement"));
  // 23-25. Remove-set: standard governance, but auto-draft v1 says ineligible.
  const removeRun = await ask([removeSet]);
  assert.equal(
    removeRun.proactiveProposal.decision.governance.reviewClass,
    "standard_review",
  );
  assert.equal(
    removeRun.proactiveProposal.decision.autoDraft.eligibility,
    "ineligible",
  );
  assert.equal(removeRun.autoDraft.status, "ineligible");
  assert.deepEqual(removeRun.autoDraft.reasons, ["structural_set_change"]);
  assert.equal((await draftsOfA()).length, 1);
  // 26-27. Another eligible proposal: the existing draft is never overwritten.
  const conflictRun = await ask([restUp(setA1)]);
  assert.equal(conflictRun.autoDraft.status, "existing_draft");
  assert.equal(conflictRun.proactiveProposal.decision.status, "proposed");
  const draftAfter = await reloaded.getProgram.execute(programB.id);
  assert.deepEqual(draftAfter.blocks, programB.blocks);
  assert.equal((await draftsOfA()).length, 1);
  // 28-29. No outcome or memory from an inactive draft; only after activation.
  const beforeActivation = await phaseApi.get.execute(autoDecision.id);
  assert.equal(beforeActivation.status, "awaiting_activation");
  const memoryBefore = await phaseApi.memory.execute();
  assert.ok(
    !JSON.stringify(memoryBefore).includes(autoDecision.id),
    "unactivated auto-draft is not an executed intervention",
  );
  await reloaded.activateProgram.execute(programB.id);
  assert.equal((await reloaded.activeProgram.execute()).id, programB.id);
  const afterActivation = await phaseApi.get.execute(autoDecision.id);
  assert.notEqual(afterActivation.status, "awaiting_activation");
  // 30-31. Preferences, provenance and the draft lineage persist across sessions.
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.equal(await preferences.getAutonomyMode(), "proactive");
  assert.equal(
    await preferences.getDraftAuthorityMode(),
    "standard_auto_draft",
  );
  const history = await readDecisions.list();
  const persisted = history.find((item) => item.id === autoDecision.id);
  assert.equal(persisted.materializationOrigin, "auto_draft");
  assert.equal(persisted.approvedAt, null);
  assert.equal(persisted.materializedProgramId, programB.id);
  assert.ok(
    history
      .filter(
        (item) => item.status === "materialized" && item.id !== autoDecision.id,
      )
      .every(
        (item) => item.materializationOrigin === "human" && item.approvedAt,
      ),
    "human materializations keep human approval",
  );
  await preferences.setDraftAuthorityMode("manual_draft");
  await preferences.setAutonomyMode("manual");
}

// Implementation Phase 17 — Human Review Evidence (ADR-0087..0090). ----------
{
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  const programsRepo = new SupabaseTrainingProgramRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  const reviews = new BuildCoachDraftReviews(readDecisions, programsRepo);
  const reviewOf = (decisionId) =>
    new GetCoachDraftReviewEvidence(reviews).execute(decisionId);
  const outcomeApi17 = replacementApi();
  // Analysis fixture grounded on evidence always present in the current
  // dossier (the active program); older fixture citations age out of the
  // bounded dossier windows.
  const groundedAnalysis = (reference) => ({
    ...coachFixture,
    observations: coachFixture.observations.map((item) => ({
      ...item,
      evidence: [reference],
    })),
    recommendations: coachFixture.recommendations.map((item) => ({
      ...item,
      evidence: [reference],
    })),
    evidenceUsed: [reference],
  });
  const autoDraft = new PrepareConservativeAutoDraft(
    preferences,
    programsRepo,
    decisions,
  );
  // Prepares one eligible proactive proposal (RIR +1 on the first set) on the
  // current active program and lets Conservative Auto-Draft materialize it.
  async function autoDraftOnActive() {
    const active = await reloaded.activeProgram.execute();
    const day = active.blocks[0].weeks[0].days[0];
    const target = day.prescriptions[0];
    const first = target.sets[0];
    const dossierNow = await outcomeApi17.dossier.execute();
    const programEvidence = dossierNow.evidence.find(
      (item) => item.kind === "training_program" && item.id === active.id,
    );
    const run = await new AnalyzeAthleteWithCoachAndGovernance(
      new AnalyzeAthleteWithCoach(
        { execute: async () => dossierNow },
        {
          async analyze(_request, requestId) {
            return {
              analysis: { ...groundedAnalysis(programEvidence), requestId },
              provider: "fixture",
              model: "deterministic",
              inputTokens: null,
              outputTokens: null,
            };
          },
        },
        new DeterministicCoachSafetyPolicy(),
      ),
      analysisRuns,
      analysisProgramFrom({ execute: async () => dossierNow }),
      new GenerateCoachProposal(
        { execute: async () => dossierNow },
        programsRepo,
        new FixtureCoachProposalProvider({
          ...proposalFixture,
          schemaVersion: "coach-proposal-v3",
          id: crypto.randomUUID(),
          sourceProgramId: active.id,
          sourceProgramRevision: active.revision,
          evidenceReferences: [programEvidence],
          actions: [
            {
              kind: "adjust_prescription_rir",
              trainingDayId: day.id,
              exercisePrescriptionId: target.id,
              prescriptionSetId: first.id,
              rirMin: (first.rirMin ?? 1) + 1,
              rirMax: (first.rirMax ?? 1) + 1,
              rationale: "Ajuste conservador para revisão.",
              evidence: [programEvidence],
            },
          ],
        }),
        decisions,
      ),
      preferences,
      undefined,
      autoDraft,
    ).execute({
      userRequest: `Revisão ${crypto.randomUUID()}`,
      analysisMode: "question",
      analysisRequestId: crypto.randomUUID(),
    });
    assert.equal(run.autoDraft.status, "materialized");
    return { run, active, first };
  }
  // 1-2. Proactive + Conservative Auto-Draft enabled explicitly.
  await preferences.setAutonomyMode("proactive");
  await preferences.setDraftAuthorityMode("standard_auto_draft");
  // 3-5. Auto-draft B: awaiting review, identical to the materialized expectation.
  const b = await autoDraftOnActive();
  const decisionB = b.run.autoDraft.decision;
  const programB = await reloaded.getProgram.execute(
    b.run.autoDraft.draftProgramId,
  );
  let reviewB = await reviewOf(decisionB.id);
  assert.equal(reviewB.schemaVersion, "coach-draft-review-evidence-v2");
  assert.equal(reviewB.reviewStatus, "awaiting_review");
  assert.equal(reviewB.materializationOrigin, "auto_draft");
  assert.equal(reviewB.reviewedDraftDiffers, false);
  assert.equal(
    (await outcomeApi17.get.execute(decisionB.id)).status,
    "awaiting_activation",
  );
  // 6-7. Draft edited before activation (RIR prepared +1, reviewed +2).
  const editedStructure = toStructure(programB, (set) =>
    set.sequence === 1
      ? {
          ...set,
          rirMin: (b.first.rirMin ?? 1) + 2,
          rirMax: (b.first.rirMax ?? 1) + 2,
        }
      : set,
  );
  await reloaded.saveProgram.execute(programB.id, editedStructure);
  reviewB = await reviewOf(decisionB.id);
  assert.equal(reviewB.reviewStatus, "awaiting_review");
  assert.equal(reviewB.reviewedDraftDiffers, true);
  assert.ok(reviewB.changeCategories.includes("rir_changed"));
  // 8-10. Manual activation: activated with edits; outcomes begin only now.
  await reloaded.activateProgram.execute(programB.id);
  reviewB = await reviewOf(decisionB.id);
  assert.equal(reviewB.reviewStatus, "activated_with_edits");
  const [comparisonB] = reviewB.actionComparisons;
  assert.deepEqual(
    comparisonB.materializedValue.min,
    (b.first.rirMin ?? 1) + 1,
  );
  assert.deepEqual(comparisonB.reviewedValue.min, (b.first.rirMin ?? 1) + 2);
  assert.equal(comparisonB.reviewedDiffersFromMaterialized, true);
  assert.ok(reviewB.timeUntilActivationSeconds >= 0);
  assert.notEqual(
    (await outcomeApi17.get.execute(decisionB.id)).status,
    "awaiting_activation",
  );
  // 11-13. Auto-draft C activated exactly as materialized.
  const c = await autoDraftOnActive();
  const decisionC = c.run.autoDraft.decision;
  await reloaded.activateProgram.execute(c.run.autoDraft.draftProgramId);
  const reviewC = await reviewOf(decisionC.id);
  assert.equal(reviewC.reviewStatus, "activated_unchanged");
  assert.deepEqual(reviewC.changeCategories, []);
  // 14-16. Auto-draft D archived without activation (valid draft lifecycle).
  const d = await autoDraftOnActive();
  const decisionD = d.run.autoDraft.decision;
  await programsRepo.archive(d.run.autoDraft.draftProgramId);
  const reviewD = await reviewOf(decisionD.id);
  assert.equal(reviewD.reviewStatus, "archived_without_activation");
  assert.equal(reviewD.activatedAt, null);
  assert.ok(reviewD.timeUntilArchiveSeconds >= 0);
  assert.equal(
    (await outcomeApi17.get.execute(decisionD.id)).status !==
      "awaiting_activation" &&
      (await outcomeApi17.get.execute(decisionD.id)).interventionProgram !==
        null &&
      (await outcomeApi17.get.execute(decisionD.id)).observed?.length > 0,
    false,
    "an unactivated draft has no observed intervention",
  );
  // 17-18. Review history: transparent counts, no rates or scores.
  const history = await new ListCoachDraftReviewHistory(reviews).execute(50);
  const ours = history.items.filter((item) =>
    [decisionB.id, decisionC.id, decisionD.id].includes(item.decisionId),
  );
  assert.deepEqual(
    Object.fromEntries(
      ours.map((item) => [item.decisionId, item.reviewStatus]),
    ),
    {
      [decisionB.id]: "activated_with_edits",
      [decisionC.id]: "activated_unchanged",
      [decisionD.id]: "archived_without_activation",
    },
  );
  assert.ok(history.counts.byMaterializationOrigin.auto_draft >= 4);
  assert.ok(history.counts.byMaterializationOrigin.human >= 1);
  assert.equal(
    Object.values(history.counts.byStatus).reduce((a, b2) => a + b2, 0),
    history.counts.materializedDrafts,
  );
  assert.doesNotMatch(
    JSON.stringify(history),
    /(rates?|scorew*|trustw*|acceptw*|rewardw*)/i,
  );
  // 19-20. Dossier v6 carries bounded review history to the (fake) Coach.
  const dossierV6 = await new BuildAthleteTrainingDossier(
    reloaded.load,
    programsRepo,
    new SupabaseWorkoutSessionRepository(reloadedClient),
    new SupabasePerformanceReadRepository(reloadedClient),
    outcomeClock,
    null,
    null,
    new ListCoachDraftReviewHistory(reviews),
  ).execute();
  assert.equal(dossierV6.schemaVersion, "athlete-training-dossier-v7");
  assert.ok(dossierV6.draftReviewHistory.items.length <= 8);
  let capturedV6 = null;
  await new AnalyzeAthleteWithCoach(
    { execute: async () => dossierV6 },
    {
      async analyze(request, requestId) {
        capturedV6 = request;
        return {
          analysis: { ...groundedAnalysis(dossierV6.evidence[0]), requestId },
          provider: "fixture",
          model: "deterministic",
          inputTokens: null,
          outputTokens: null,
        };
      },
    },
    new DeterministicCoachSafetyPolicy(),
  ).execute({
    userRequest: "Como foram minhas revisões?",
    analysisMode: "question",
  });
  assert.equal(capturedV6.dossier.schemaVersion, "athlete-training-dossier-v7");
  assert.ok(
    capturedV6.dossier.draftReviewHistory.items.some(
      (item) => item.decisionId === decisionD.id,
    ),
  );
  assert.ok(
    collectDossierEvidenceIds(dossierV6).has(
      `coach_draft_review:${decisionD.id}`,
    ),
  );
  // 21. Auto-draft eligibility is independent of review history.
  const removeSetProposal = {
    ...decisionC.proposal,
    actions: [
      {
        kind: "remove_prescription_set",
        trainingDayId: decisionC.proposal.actions[0].trainingDayId,
        exercisePrescriptionId:
          decisionC.proposal.actions[0].exercisePrescriptionId,
        prescriptionSetId: decisionC.proposal.actions[0].prescriptionSetId,
        rationale: "r",
        evidence: decisionC.proposal.actions[0].evidence,
      },
    ],
  };
  for (const proposal of [decisionC.proposal, removeSetProposal]) {
    const governance = assessCoachProposalGovernance({
      proposal,
      sourceProgram: c.active,
      origin: "proactive",
      safetyBlocksTrainingAdvice: false,
      proposalValid: true,
    });
    const eligibility = assessCoachAutoDraftEligibility({
      proposal,
      origin: "proactive",
      governance,
      trainingAdviceBlocked: false,
      proposalValid: true,
    }).eligibility;
    assert.equal(
      eligibility,
      proposal === removeSetProposal ? "ineligible" : "eligible",
      "history never widens or narrows coach-auto-draft-v1",
    );
  }
  // 22-23. Deterministic rebuild after logout/login.
  const before = await new ListCoachDraftReviewHistory(reviews).execute(50);
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.deepEqual(
    await new ListCoachDraftReviewHistory(reviews).execute(50),
    before,
  );
  await preferences.setDraftAuthorityMode("manual_draft");
  await preferences.setAutonomyMode("manual");
}

// Implementation Phase 18 — Stable training structure lineage (ADR-0091..0094).
{
  const programsRepo = new SupabaseTrainingProgramRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  const reviews = new BuildCoachDraftReviews(readDecisions, programsRepo);
  const reviewOf = (decisionId) =>
    new GetCoachDraftReviewEvidence(reviews).execute(decisionId);
  const lineageOf = (program) =>
    program.blocks[0].weeks[0].days[0].prescriptions.map((prescription) => ({
      id: prescription.id,
      lineageId: prescription.lineageId,
      exerciseId: prescription.exerciseId,
      sets: prescription.sets.map((set) => ({
        id: set.id,
        lineageId: set.lineageId,
      })),
    }));
  const plannedSet = (change = {}) => ({
    sequence: 1,
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
    ...change,
  });
  // 1-2. Program A0 with two exercises; every node receives a lineage.
  // Root creation only through the atomic boundary (ADR-0100..0103).
  const a0Draft = await reloaded.createProgramWithStructure.execute({
    creationRequestId: crypto.randomUUID(),
    name: "Programa linhagem",
    structure: {
      blocks: [
        {
          sequence: 1,
          name: "Bloco",
          weeks: [
            {
              sequence: 1,
              days: [
                {
                  sequence: 1,
                  name: "Dia",
                  prescriptions: [
                    {
                      sequence: 1,
                      exerciseId: EX_X,
                      sets: [plannedSet(), plannedSet({ sequence: 2 })],
                    },
                    { sequence: 2, exerciseId: EX_Z, sets: [plannedSet()] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const a0 = await reloaded.activateProgram.execute(a0Draft.id);
  assert.equal(a0.lineageTracked, true);
  const a0Lineage = lineageOf(a0);
  assert.ok(
    a0Lineage.every(
      (item) => item.lineageId && item.sets.every((set) => set.lineageId),
    ),
  );
  // 3-5. Manual revision: new row ids, same lineage.
  const clone = await reloaded.cloneProgram.execute(a0.id);
  const cloneLineage = lineageOf(clone);
  assert.deepEqual(
    cloneLineage.map((item) => item.lineageId),
    a0Lineage.map((item) => item.lineageId),
  );
  assert.deepEqual(
    cloneLineage.map((item) => item.sets.map((set) => set.lineageId)),
    a0Lineage.map((item) => item.sets.map((set) => set.lineageId)),
  );
  assert.ok(
    cloneLineage.every((item, index) => item.id !== a0Lineage[index].id),
  );
  const programA = await reloaded.activateProgram.execute(clone.id);
  // A Coach proposal (RIR +1 on the first set) materialized by the athlete.
  const dossierA = await replacementApi().dossier.execute();
  const evidenceA = dossierA.evidence.find(
    (item) => item.kind === "training_program" && item.id === programA.id,
  );
  const [pX, pZ] = programA.blocks[0].weeks[0].days[0].prescriptions;
  const decisionB = await new GenerateCoachProposal(
    { execute: async () => dossierA },
    programsRepo,
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v3",
      id: crypto.randomUUID(),
      sourceProgramId: programA.id,
      sourceProgramRevision: programA.revision,
      evidenceReferences: [evidenceA],
      actions: [
        {
          kind: "adjust_prescription_rir",
          trainingDayId: programA.blocks[0].weeks[0].days[0].id,
          exercisePrescriptionId: pX.id,
          prescriptionSetId: pX.sets[0].id,
          rirMin: 3,
          rirMax: 3,
          rationale: "Ajuste proposto.",
          evidence: [evidenceA],
        },
      ],
    }),
    decisions,
  ).execute(await authoritative());
  const materializedB = await decisions.materialize(decisionB.id);
  let programB = await reloaded.getProgram.execute(
    materializedB.materializedProgramId,
  );
  assert.deepEqual(
    lineageOf(programB).map((item) => item.lineageId),
    lineageOf(programA).map((item) => item.lineageId),
    "Coach materialization preserves lineage",
  );
  assert.equal((await reviewOf(decisionB.id)).matchingStrategy, "lineage");
  // 6-7. Reorder exercises in B: a sequence change only.
  const reorder = toStructure(programB);
  const [first, second] = reorder.blocks[0].weeks[0].days[0].prescriptions;
  reorder.blocks[0].weeks[0].days[0].prescriptions = [
    { ...second, sequence: 1 },
    { ...first, sequence: 2 },
  ];
  await reloaded.saveProgram.execute(programB.id, reorder);
  let review = await reviewOf(decisionB.id);
  assert.deepEqual(review.changeCategories, ["sequence_changed"]);
  assert.equal(review.changedExerciseCount, 0);
  assert.equal(
    review.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
  // 8-9. Edit RIR of the proposed set (moved to position 2): same lineage.
  programB = await reloaded.getProgram.execute(programB.id);
  const movedX = programB.blocks[0].weeks[0].days[0].prescriptions.find(
    (item) => item.lineageId === pX.lineageId,
  );
  assert.equal(movedX.sequence, 2);
  await reloaded.saveProgram.execute(
    programB.id,
    toStructure(programB, (set) =>
      set.lineageId === pX.sets[0].lineageId
        ? { ...set, rirMin: 4, rirMax: 4 }
        : set,
    ),
  );
  review = await reviewOf(decisionB.id);
  assert.deepEqual(review.actionComparisons[0].reviewedValue, {
    dimension: "planned_rir",
    min: 4,
    max: 4,
  });
  assert.ok(review.changeCategories.includes("rir_changed"));
  // 10-13. Add a set to Z (new lineage) and remove X's second set (lineage absent).
  programB = await reloaded.getProgram.execute(programB.id);
  const structure = toStructure(programB);
  const day = structure.blocks[0].weeks[0].days[0];
  const zIndex = day.prescriptions.findIndex(
    (item) => item.lineageId === pZ.lineageId,
  );
  const xIndex = day.prescriptions.findIndex(
    (item) => item.lineageId === pX.lineageId,
  );
  day.prescriptions[zIndex] = {
    ...day.prescriptions[zIndex],
    sets: [...day.prescriptions[zIndex].sets, plannedSet({ sequence: 2 })],
  };
  day.prescriptions[xIndex] = {
    ...day.prescriptions[xIndex],
    sets: day.prescriptions[xIndex].sets.filter(
      (set) => set.lineageId !== pX.sets[1].lineageId,
    ),
  };
  await reloaded.saveProgram.execute(programB.id, structure);
  programB = await reloaded.getProgram.execute(programB.id);
  const zNow = programB.blocks[0].weeks[0].days[0].prescriptions.find(
    (item) => item.lineageId === pZ.lineageId,
  );
  const xNow = programB.blocks[0].weeks[0].days[0].prescriptions.find(
    (item) => item.lineageId === pX.lineageId,
  );
  const knownSetLineages = new Set(
    lineageOf(programA).flatMap((item) =>
      item.sets.map((set) => set.lineageId),
    ),
  );
  assert.equal(zNow.sets.length, 2);
  assert.ok(
    !knownSetLineages.has(zNow.sets[1].lineageId),
    "added set gets a new lineage",
  );
  assert.ok(
    !xNow.sets.some((set) => set.lineageId === pX.sets[1].lineageId),
    "removed lineage absent",
  );
  review = await reviewOf(decisionB.id);
  assert.ok(review.changeCategories.includes("set_added"));
  assert.ok(review.changeCategories.includes("set_removed"));
  // 14-15. Replace exercise X → Y in the draft: prescription lineage preserved.
  await reloaded.saveProgram.execute(
    programB.id,
    (() => {
      const replaced = toStructure(programB);
      const target = replaced.blocks[0].weeks[0].days[0].prescriptions.find(
        (item) => item.lineageId === pX.lineageId,
      );
      target.exerciseId = EX_Y;
      return replaced;
    })(),
  );
  programB = await reloaded.getProgram.execute(programB.id);
  const xReplaced = programB.blocks[0].weeks[0].days[0].prescriptions.find(
    (item) => item.lineageId === pX.lineageId,
  );
  assert.equal(xReplaced.exerciseId, EX_Y);
  review = await reviewOf(decisionB.id);
  assert.ok(review.changeCategories.includes("exercise_changed"));
  assert.equal(review.changedExerciseCount, 1);
  // 16-18. Manual activation: fidelity resolves by lineage; outcomes start now.
  const outcomeApiLineage = replacementApi();
  assert.equal(
    (await outcomeApiLineage.get.execute(decisionB.id)).status,
    "awaiting_activation",
  );
  await reloaded.activateProgram.execute(programB.id);
  review = await reviewOf(decisionB.id);
  assert.equal(review.reviewStatus, "activated_with_edits");
  const outcomeB = await outcomeApiLineage.get.execute(decisionB.id);
  assert.notEqual(outcomeB.status, "awaiting_activation");
  const fidelity = outcomeB.interventionFidelity.actions[0];
  assert.equal(
    fidelity.locatedInImplementedProgram,
    false,
    "prescription now carries another exercise",
  );
  assert.equal(
    fidelity.exerciseIdentityPreserved,
    false,
    "same lineage, changed exercise (no false match)",
  );
  // 19-20. Auto-draft on the lineage-tracked active program preserves lineage.
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  await preferences.setAutonomyMode("proactive");
  await preferences.setDraftAuthorityMode("standard_auto_draft");
  const active = await reloaded.activeProgram.execute();
  const activeDay = active.blocks[0].weeks[0].days[0];
  const dossierNow = await replacementApi().dossier.execute();
  const activeEvidence = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === active.id,
  );
  const autoRun = await new AnalyzeAthleteWithCoachAndGovernance(
    new AnalyzeAthleteWithCoach(
      { execute: async () => dossierNow },
      {
        async analyze(_request, requestId) {
          return {
            analysis: {
              ...coachFixture,
              requestId,
              observations: coachFixture.observations.map((item) => ({
                ...item,
                evidence: [activeEvidence],
              })),
              recommendations: coachFixture.recommendations.map((item) => ({
                ...item,
                evidence: [activeEvidence],
              })),
              evidenceUsed: [activeEvidence],
            },
            provider: "fixture",
            model: "deterministic",
            inputTokens: null,
            outputTokens: null,
          };
        },
      },
      new DeterministicCoachSafetyPolicy(),
    ),
    analysisRuns,
    analysisProgramFrom({ execute: async () => dossierNow }),
    new GenerateCoachProposal(
      { execute: async () => dossierNow },
      programsRepo,
      new FixtureCoachProposalProvider({
        ...proposalFixture,
        schemaVersion: "coach-proposal-v3",
        id: crypto.randomUUID(),
        sourceProgramId: active.id,
        sourceProgramRevision: active.revision,
        evidenceReferences: [activeEvidence],
        actions: [
          {
            kind: "adjust_prescription_rest",
            trainingDayId: activeDay.id,
            exercisePrescriptionId: activeDay.prescriptions[0].id,
            prescriptionSetId: activeDay.prescriptions[0].sets[0].id,
            restMinSeconds: 150,
            restMaxSeconds: 150,
            rationale: "Ajuste conservador.",
            evidence: [activeEvidence],
          },
        ],
      }),
      decisions,
    ),
    preferences,
    undefined,
    new PrepareConservativeAutoDraft(preferences, programsRepo, decisions),
  ).execute({
    userRequest: "Linhagem",
    analysisMode: "question",
    analysisRequestId: crypto.randomUUID(),
  });
  assert.equal(autoRun.autoDraft.status, "materialized");
  const autoDraftProgram = await reloaded.getProgram.execute(
    autoRun.autoDraft.draftProgramId,
  );
  assert.deepEqual(
    lineageOf(autoDraftProgram).map((item) => [
      item.lineageId,
      item.sets.map((set) => set.lineageId),
    ]),
    lineageOf(active).map((item) => [
      item.lineageId,
      item.sets.map((set) => set.lineageId),
    ]),
    "auto-draft preserves lineage",
  );
  assert.equal(
    (await reviewOf(autoRun.autoDraft.decision.id)).matchingStrategy,
    "lineage",
  );
  // 21-22. Deterministic rebuild after logout/login.
  const before = await new ListCoachDraftReviewHistory(reviews).execute(50);
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.deepEqual(
    await new ListCoachDraftReviewHistory(reviews).execute(50),
    before,
  );
  await preferences.setDraftAuthorityMode("manual_draft");
  await preferences.setAutonomyMode("manual");
}

// Corrective pass — full draft structure preservation (ADR-0095/0096). ------
{
  const programsRepo = new SupabaseTrainingProgramRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  const reviews = new BuildCoachDraftReviews(readDecisions, programsRepo);
  const reviewOf = (decisionId) =>
    new GetCoachDraftReviewEvidence(reviews).execute(decisionId);
  // Every node: path, lineage and content (row ids excluded on purpose).
  const snapshot = (program) =>
    program.blocks.flatMap((block) => [
      {
        path: `B:${block.name}`,
        lineage: block.lineageId,
        content: block.name,
      },
      ...block.weeks.flatMap((week) => [
        {
          path: `B:${block.name}/W${week.sequence}`,
          lineage: week.lineageId,
          content: `${week.name}|${week.notes}`,
        },
        ...week.days.flatMap((day) => [
          {
            path: `D:${day.name}`,
            lineage: day.lineageId,
            content: `${day.notes}|${day.preferredWeekday}`,
          },
          ...day.prescriptions.flatMap((prescription) => [
            {
              path: `P:${day.name}/${prescription.sequence}`,
              lineage: prescription.lineageId,
              content: `${prescription.exerciseId}|${prescription.instructions}`,
            },
            ...prescription.sets.map((set) => ({
              path: `S:${day.name}/${prescription.sequence}/${set.sequence}`,
              lineage: set.lineageId,
              content: JSON.stringify([
                set.targetMin,
                set.targetMax,
                set.rirMin,
                set.rirMax,
                set.restMinSeconds,
                set.restMaxSeconds,
                set.tempo,
                set.loadKind,
                set.loadKg,
              ]),
            })),
          ]),
        ]),
      ]),
    ]);
  const byPath = (items) =>
    Object.fromEntries(items.map((item) => [item.path, item]));
  const unchangedExcept = (before, after, prefixes) => {
    const a = byPath(before);
    const b = byPath(after);
    assert.deepEqual(
      Object.keys(b).sort(),
      Object.keys(a).sort(),
      "no node lost or added",
    );
    for (const path of Object.keys(a))
      if (!prefixes.some((prefix) => path.startsWith(prefix)))
        assert.deepEqual(b[path], a[path], `${path} untouched`);
  };
  const pathOf = (structure, dayName) => {
    const found = listDays(structure).find(
      (item) => dayAt(structure, item.path).name === dayName,
    );
    assert.ok(found, dayName);
    return found.path;
  };
  const plannedSet = (change = {}) => ({
    sequence: 1,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 1,
    rirMax: 3,
    restMinSeconds: 90,
    restMaxSeconds: 150,
    tempo: "3-1-1-0",
    loadKind: "athlete_selected",
    loadKg: null,
    ...change,
  });
  const dayInput = (sequence, name, exerciseId) => ({
    sequence,
    name,
    notes: `notas ${name}`,
    preferredWeekday: sequence,
    prescriptions: [
      {
        sequence: 1,
        exerciseId,
        instructions: `instr ${name}`,
        sets: [plannedSet(), plannedSet({ sequence: 2 })],
      },
    ],
  });
  // 1-3. Multi-block / multi-week / multi-day draft; record the full hierarchy.
  // Root creation only through the atomic boundary (ADR-0100..0103).
  const draft = await reloaded.createProgramWithStructure.execute({
    creationRequestId: crypto.randomUUID(),
    name: "Programa completo",
    structure: {
      blocks: [
        {
          sequence: 1,
          name: "Bloco A",
          weeks: [
            {
              sequence: 1,
              name: "Semana 1",
              days: [dayInput(1, "Dia 1", EX_X), dayInput(2, "Dia 2", EX_Z)],
            },
            {
              sequence: 2,
              name: "Semana 2",
              notes: "deload",
              days: [dayInput(1, "Dia 3", EX_Y)],
            },
          ],
        },
        {
          sequence: 2,
          name: "Bloco B",
          weeks: [
            {
              sequence: 1,
              name: "Semana 1",
              days: [dayInput(1, "Dia 4", EX_X)],
            },
          ],
        },
      ],
    },
  });
  let program = await reloaded.getProgram.execute(draft.id);
  const initial = snapshot(program);
  assert.equal(initial.filter((item) => item.path.startsWith("D:")).length, 4);
  // 4-6. The builder model edits Day 1 only and saves the whole tree.
  let structure = programToStructureInput(program);
  structure = structureEdits.updateSet(
    structure,
    pathOf(structure, "Dia 1"),
    0,
    0,
    { rirMin: 2, rirMax: 2 },
  );
  await reloaded.saveProgram.execute(draft.id, structure);
  program = await reloaded.getProgram.execute(draft.id);
  unchangedExcept(initial, snapshot(program), ["S:Dia 1/1/1"]);
  assert.equal(
    byPath(snapshot(program))["S:Dia 1/1/1"].lineage,
    byPath(initial)["S:Dia 1/1/1"].lineage,
  );
  // 7-9. Edit Day 3 in a later session: the Day 1 edit stays.
  structure = structureEdits.updateSet(
    programToStructureInput(program),
    pathOf(structure, "Dia 3"),
    0,
    1,
    { loadKind: "absolute", loadKg: 40 },
  );
  await reloaded.saveProgram.execute(draft.id, structure);
  program = await reloaded.getProgram.execute(draft.id);
  const afterTwo = byPath(snapshot(program));
  assert.equal(
    JSON.parse(afterTwo["S:Dia 1/1/1"].content)[2],
    2,
    "Day 1 edit remains",
  );
  assert.equal(
    JSON.parse(afterTwo["S:Dia 3/1/2"].content)[8],
    40,
    "Day 3 edit saved",
  );
  unchangedExcept(initial, snapshot(program), ["S:Dia 1/1/1", "S:Dia 3/1/2"]);
  // 10-12. Coach-materialized multi-day draft: an unrelated day edit keeps the Coach change.
  const active = await reloaded.activateProgram.execute(draft.id);
  const dossierNow = await replacementApi().dossier.execute();
  const evidenceActive = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === active.id,
  );
  const day4 = active.blocks[1].weeks[0].days[0];
  const coachDecision = await new GenerateCoachProposal(
    { execute: async () => dossierNow },
    programsRepo,
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v3",
      id: crypto.randomUUID(),
      sourceProgramId: active.id,
      sourceProgramRevision: active.revision,
      evidenceReferences: [evidenceActive],
      actions: [
        {
          kind: "adjust_prescription_rir",
          trainingDayId: day4.id,
          exercisePrescriptionId: day4.prescriptions[0].id,
          prescriptionSetId: day4.prescriptions[0].sets[0].id,
          rirMin: 3,
          rirMax: 4,
          rationale: "Ajuste proposto.",
          evidence: [evidenceActive],
        },
      ],
    }),
    decisions,
  ).execute(await authoritative());
  const coachDraftId = (await decisions.materialize(coachDecision.id))
    .materializedProgramId;
  let coachDraft = await reloaded.getProgram.execute(coachDraftId);
  const coachBefore = snapshot(coachDraft);
  structure = structureEdits.updateSet(
    programToStructureInput(coachDraft),
    pathOf(programToStructureInput(coachDraft), "Dia 2"),
    0,
    0,
    { targetMin: 6, targetMax: 8 },
  );
  await reloaded.saveProgram.execute(coachDraftId, structure);
  coachDraft = await reloaded.getProgram.execute(coachDraftId);
  unchangedExcept(coachBefore, snapshot(coachDraft), ["S:Dia 2/1/1"]);
  assert.deepEqual(
    JSON.parse(byPath(snapshot(coachDraft))["S:Dia 4/1/1"].content).slice(2, 4),
    [3, 4],
    "Coach change on Day 4 remains",
  );
  let review = await reviewOf(coachDecision.id);
  assert.equal(review.matchingStrategy, "lineage");
  assert.equal(
    review.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
  assert.deepEqual(review.changeCategories, ["target_changed"]);
  assert.equal(review.changesOutsideProposal, true);
  // 13-17. Auto-draft on Day 3, then a manual Day 1 edit: the automatic change survives.
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  await preferences.setAutonomyMode("proactive");
  await preferences.setDraftAuthorityMode("standard_auto_draft");
  const activeQ = await reloaded.activateProgram.execute(coachDraftId);
  const dossierQ = await replacementApi().dossier.execute();
  const evidenceQ = dossierQ.evidence.find(
    (item) => item.kind === "training_program" && item.id === activeQ.id,
  );
  const day3 = activeQ.blocks[0].weeks[1].days[0];
  const autoRun = await new AnalyzeAthleteWithCoachAndGovernance(
    new AnalyzeAthleteWithCoach(
      { execute: async () => dossierQ },
      {
        async analyze(_request, requestId) {
          return {
            analysis: {
              ...coachFixture,
              requestId,
              observations: coachFixture.observations.map((item) => ({
                ...item,
                evidence: [evidenceQ],
              })),
              recommendations: coachFixture.recommendations.map((item) => ({
                ...item,
                evidence: [evidenceQ],
              })),
              evidenceUsed: [evidenceQ],
            },
            provider: "fixture",
            model: "deterministic",
            inputTokens: null,
            outputTokens: null,
          };
        },
      },
      new DeterministicCoachSafetyPolicy(),
    ),
    analysisRuns,
    analysisProgramFrom({ execute: async () => dossierQ }),
    new GenerateCoachProposal(
      { execute: async () => dossierQ },
      programsRepo,
      new FixtureCoachProposalProvider({
        ...proposalFixture,
        schemaVersion: "coach-proposal-v3",
        id: crypto.randomUUID(),
        sourceProgramId: activeQ.id,
        sourceProgramRevision: activeQ.revision,
        evidenceReferences: [evidenceQ],
        actions: [
          {
            kind: "adjust_prescription_rest",
            trainingDayId: day3.id,
            exercisePrescriptionId: day3.prescriptions[0].id,
            prescriptionSetId: day3.prescriptions[0].sets[0].id,
            restMinSeconds: 120,
            restMaxSeconds: 180,
            rationale: "Ajuste conservador.",
            evidence: [evidenceQ],
          },
        ],
      }),
      decisions,
    ),
    preferences,
    undefined,
    new PrepareConservativeAutoDraft(preferences, programsRepo, decisions),
  ).execute({
    userRequest: "Estrutura completa",
    analysisMode: "question",
    analysisRequestId: crypto.randomUUID(),
  });
  assert.equal(autoRun.autoDraft.status, "materialized");
  const autoDraftId = autoRun.autoDraft.draftProgramId;
  let autoDraft = await reloaded.getProgram.execute(autoDraftId);
  const autoBefore = snapshot(autoDraft);
  assert.deepEqual(
    JSON.parse(byPath(autoBefore)["S:Dia 3/1/1"].content).slice(4, 6),
    [120, 180],
  );
  structure = programToStructureInput(autoDraft);
  structure = structureEdits.updateSet(
    structure,
    pathOf(structure, "Dia 1"),
    0,
    1,
    { tempo: "2-0-2-0" },
  );
  await reloaded.saveProgram.execute(autoDraftId, structure);
  autoDraft = await reloaded.getProgram.execute(autoDraftId);
  unchangedExcept(autoBefore, snapshot(autoDraft), ["S:Dia 1/1/2"]);
  assert.deepEqual(
    JSON.parse(byPath(snapshot(autoDraft))["S:Dia 3/1/1"].content).slice(4, 6),
    [120, 180],
    "auto-draft change on Day 3 preserved",
  );
  review = await reviewOf(autoRun.autoDraft.decision.id);
  assert.equal(review.reviewStatus, "awaiting_review");
  assert.equal(
    review.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
    "auto-draft expected change intact",
  );
  assert.deepEqual(
    review.changeCategories,
    ["tempo_changed"],
    "only the real manual change",
  );
  assert.equal(review.changesOutsideProposal, true);
  // 18-19. Human activation; outcomes and history remain valid.
  await reloaded.activateProgram.execute(autoDraftId);
  review = await reviewOf(autoRun.autoDraft.decision.id);
  assert.equal(review.reviewStatus, "activated_with_edits");
  const outcomeApi = replacementApi();
  assert.notEqual(
    (await outcomeApi.get.execute(autoRun.autoDraft.decision.id)).status,
    "awaiting_activation",
  );
  assert.ok(
    (await readDecisions.list()).some((item) => item.id === coachDecision.id),
  );
  // 20-21. Logout/login: the complete structure rebuilds identically.
  const finalBefore = snapshot(await reloaded.getProgram.execute(autoDraftId));
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.deepEqual(
    snapshot(await reloaded.getProgram.execute(autoDraftId)),
    finalBefore,
  );
  await preferences.setDraftAuthorityMode("manual_draft");
  await preferences.setAutonomyMode("manual");
}

// Implementation Phase 19 — explicit structure editing (ADR-0097..0099). ---
{
  const programsRepo = new SupabaseTrainingProgramRepository(reloadedClient);
  const readDecisions = new SupabaseCoachDecisionRepository(
    reloadedClient,
    identity.userId,
  );
  const reviewOf = (decisionId) =>
    new GetCoachDraftReviewEvidence(
      new BuildCoachDraftReviews(readDecisions, programsRepo),
    ).execute(decisionId);
  const nodes = (program) =>
    program.blocks.flatMap((block) => [
      { level: "block", lineage: block.lineageId, name: block.name },
      ...block.weeks.flatMap((week) => [
        { level: "week", lineage: week.lineageId, name: week.name },
        ...week.days.flatMap((day) => [
          { level: "day", lineage: day.lineageId, name: day.name },
          ...day.prescriptions.flatMap((prescription) => [
            {
              level: "prescription",
              lineage: prescription.lineageId,
              name: `${day.name}/${prescription.exerciseId}`,
            },
            ...prescription.sets.map((set) => ({
              level: "set",
              lineage: set.lineageId,
              name: `${day.name}/${set.sequence}`,
              content: JSON.stringify([
                set.targetMin,
                set.targetMax,
                set.rirMin,
                set.rirMax,
                set.restMinSeconds,
                set.restMaxSeconds,
                set.tempo,
                set.loadKind,
                set.loadKg,
              ]),
            })),
          ]),
        ]),
      ]),
    ]);
  const lineageSet = (program) =>
    new Set(nodes(program).map((node) => node.lineage));
  const setContent = (program, dayName, sequence = 1) =>
    JSON.parse(
      nodes(program).find(
        (node) =>
          node.level === "set" && node.name === `${dayName}/${sequence}`,
      ).content,
    );
  const pathOf = (structure, dayName) => {
    const found = listDays(structure).find(
      (item) => dayAt(structure, item.path).name === dayName,
    );
    assert.ok(found, dayName);
    return found.path;
  };
  const sequencesNormalized = (program) => {
    const ok = (items) =>
      items.every((item, index) => item.sequence === index + 1);
    assert.ok(ok(program.blocks), "block sequences 1..n");
    for (const block of program.blocks) {
      assert.ok(ok(block.weeks), "week sequences 1..n");
      for (const week of block.weeks)
        assert.ok(ok(week.days), "day sequences 1..n");
    }
  };
  const plannedSet = (sequence = 1) => ({
    sequence,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 1,
    rirMax: 3,
    restMinSeconds: 90,
    restMaxSeconds: 150,
    tempo: null,
    loadKind: "athlete_selected",
    loadKg: null,
  });
  const dayInput = (sequence, name, exerciseId) => ({
    sequence,
    name,
    prescriptions: [
      { sequence: 1, exerciseId, sets: [plannedSet(1), plannedSet(2)] },
    ],
  });
  // 1. Draft: Bloco A (Semana 1: Dia 1, Dia 2; Semana 2: Dia 3), Bloco B (Dia 4).
  // Root creation only through the atomic boundary (ADR-0100..0103).
  const draft = await reloaded.createProgramWithStructure.execute({
    creationRequestId: crypto.randomUUID(),
    name: "Estrutura explícita",
    structure: {
      blocks: [
        {
          sequence: 1,
          name: "Bloco A",
          weeks: [
            {
              sequence: 1,
              name: "Semana 1",
              days: [dayInput(1, "Dia 1", EX_X), dayInput(2, "Dia 2", EX_Z)],
            },
            {
              sequence: 2,
              name: "Semana 2",
              days: [dayInput(1, "Dia 3", EX_Y)],
            },
          ],
        },
        {
          sequence: 2,
          name: "Bloco B",
          weeks: [
            {
              sequence: 1,
              name: "Semana 1",
              days: [dayInput(1, "Dia 4", EX_X)],
            },
          ],
        },
      ],
    },
  });
  let program = await reloaded.getProgram.execute(draft.id);
  const original = nodes(program);
  // 2-4. Add a block, a week and a day through the pure editor; fill the new days.
  let structure = programToStructureInput(program);
  structure = structureEdits.addBlock(structure, "Bloco C");
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Treino A"),
    EX_Y,
  );
  structure = structureEdits.renameDay(
    structure,
    pathOf(structure, "Treino A"),
    "Dia 5",
  );
  structure = structureEdits.addWeek(structure, pathOf(structure, "Dia 4"));
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Treino A"),
    EX_Z,
  );
  structure = structureEdits.renameDay(
    structure,
    pathOf(structure, "Treino A"),
    "Dia 6",
  );
  structure = structureEdits.addDay(
    structure,
    pathOf(structure, "Dia 1"),
    "Dia 7",
  );
  // 5. An empty new day cannot be saved (canonical invariant, nothing invented).
  let session = draftEditTransition(cleanDraftEditSession, "edited");
  session = draftEditTransition(session, "save_started");
  await assert.rejects(async () =>
    reloaded.saveProgram.execute(draft.id, structure),
  );
  session = draftEditTransition(session, "save_failed");
  // 6. The failed save keeps the edits dirty (guard still active).
  assert.equal(shouldGuardDraftLeave(session), true);
  assert.equal(
    nodes(await reloaded.getProgram.execute(draft.id)).length,
    original.length,
    "failed save changed nothing",
  );
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Dia 7"),
    EX_Y,
  );
  // 7. Full-tree save succeeds; only then is the session clean.
  session = draftEditTransition(session, "save_started");
  await reloaded.saveProgram.execute(draft.id, structure);
  session = draftEditTransition(session, "save_succeeded");
  assert.equal(shouldGuardDraftLeave(session), false);
  program = await reloaded.getProgram.execute(draft.id);
  // 8. Every original node keeps lineage and content.
  const afterAdd = nodes(program);
  for (const node of original)
    assert.deepEqual(
      afterAdd.find((item) => item.lineage === node.lineage),
      node,
      `${node.level} ${node.name} preserved`,
    );
  // 9. New nodes received fresh server lineage.
  const added = afterAdd.filter(
    (node) => !original.some((item) => item.lineage === node.lineage),
  );
  assert.deepEqual(
    added
      .filter(
        (node) =>
          node.level === "block" ||
          node.level === "week" ||
          node.level === "day",
      )
      .map((node) => `${node.level}:${node.name}`)
      .sort(),
    [
      "block:Bloco C",
      "day:Dia 5",
      "day:Dia 6",
      "day:Dia 7",
      "week:Semana 1",
      "week:Semana 2",
    ].sort(),
  );
  assert.ok(
    added.every(
      (node) => typeof node.lineage === "string" && node.lineage.length === 36,
    ),
  );
  // 10. Sequences normalized at every level.
  sequencesNormalized(program);
  assert.deepEqual(
    program.blocks.map((block) => block.name),
    ["Bloco A", "Bloco B", "Bloco C"],
  );
  // 11-12. Explicit removal of a day, then a week: only those subtrees disappear.
  const dia2 = program.blocks[0].weeks[0].days.find(
    (day) => day.name === "Dia 2",
  );
  const removedLineages = new Set(
    nodes({ blocks: [{ weeks: [{ days: [dia2] }] }] })
      .map((node) => node.lineage)
      .filter(Boolean),
  );
  structure = programToStructureInput(program);
  structure = structureEdits.removeDay(structure, pathOf(structure, "Dia 2"));
  const semana2 = program.blocks[0].weeks[1];
  structure = structureEdits.removeWeek(structure, pathOf(structure, "Dia 3"));
  await reloaded.saveProgram.execute(draft.id, structure);
  program = await reloaded.getProgram.execute(draft.id);
  const afterRemove = lineageSet(program);
  for (const lineage of removedLineages)
    assert.equal(afterRemove.has(lineage), false);
  assert.equal(afterRemove.has(semana2.lineageId), false);
  assert.deepEqual(
    program.blocks[0].weeks[0].days.map((day) => day.name),
    ["Dia 1", "Dia 7"],
  );
  for (const node of afterAdd)
    if (
      !removedLineages.has(node.lineage) &&
      !nodes({ blocks: [{ weeks: [semana2] }] }).some(
        (item) => item.lineage === node.lineage,
      )
    )
      assert.ok(
        afterRemove.has(node.lineage),
        `${node.level} ${node.name} kept`,
      );
  sequencesNormalized(program);
  // 13. Removed lineage is never recycled: re-attaching it is rejected.
  structure = programToStructureInput(program);
  structure = structureEdits.addDay(
    structure,
    pathOf(structure, "Dia 1"),
    "Dia 8",
  );
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Dia 8"),
    EX_Z,
  );
  const reattach = structuredClone(structure);
  reattach.blocks[0].weeks[0].days[2].lineageId = dia2.lineageId;
  await assert.rejects(
    async () => reloaded.saveProgram.execute(draft.id, reattach),
    (error) => error.cause?.message === "Unknown structure lineage",
  );
  // 14. A fresh day gets a new lineage, never the removed one.
  await reloaded.saveProgram.execute(draft.id, structure);
  program = await reloaded.getProgram.execute(draft.id);
  const dia8 = program.blocks[0].weeks[0].days.find(
    (day) => day.name === "Dia 8",
  );
  assert.ok(dia8.lineageId && !removedLineages.has(dia8.lineageId));
  // 15. Reorder blocks and days: same lineage, new sequence.
  const before15 = nodes(program);
  structure = programToStructureInput(program);
  structure = structureEdits.moveBlock(
    structure,
    pathOf(structure, "Dia 5"),
    -1,
  );
  structure = structureEdits.moveDay(structure, pathOf(structure, "Dia 8"), -1);
  await reloaded.saveProgram.execute(draft.id, structure);
  program = await reloaded.getProgram.execute(draft.id);
  assert.deepEqual(
    program.blocks.map((block) => block.name),
    ["Bloco A", "Bloco C", "Bloco B"],
  );
  assert.deepEqual(
    program.blocks[0].weeks[0].days.map((day) => day.name),
    ["Dia 1", "Dia 8", "Dia 7"],
  );
  assert.deepEqual(
    [...lineageSet(program)].sort(),
    before15.map((node) => node.lineage).sort(),
    "reorder keeps every lineage",
  );
  sequencesNormalized(program);
  // 16. Last-node protection: the editor refuses, the save contract rejects.
  const single = programToStructureInput(program);
  const bWeekPath = pathOf(single, "Dia 4");
  assert.throws(
    () => structureEdits.removeDay(single, bWeekPath),
    StructuralInvariantError,
  );
  await assert.rejects(async () =>
    reloaded.saveProgram.execute(draft.id, { blocks: [] }),
  );
  // 17-18. Coach draft: structural edits elsewhere keep the Coach change.
  const active = await reloaded.activateProgram.execute(draft.id);
  const dossierNow = await replacementApi().dossier.execute();
  const evidenceActive = dossierNow.evidence.find(
    (item) => item.kind === "training_program" && item.id === active.id,
  );
  const day4 = active.blocks[2].weeks[0].days[0];
  assert.equal(day4.name, "Dia 4");
  const coachDecision = await new GenerateCoachProposal(
    { execute: async () => dossierNow },
    programsRepo,
    new FixtureCoachProposalProvider({
      ...proposalFixture,
      schemaVersion: "coach-proposal-v3",
      id: crypto.randomUUID(),
      sourceProgramId: active.id,
      sourceProgramRevision: active.revision,
      evidenceReferences: [evidenceActive],
      actions: [
        {
          kind: "adjust_prescription_rir",
          trainingDayId: day4.id,
          exercisePrescriptionId: day4.prescriptions[0].id,
          prescriptionSetId: day4.prescriptions[0].sets[0].id,
          rirMin: 3,
          rirMax: 4,
          rationale: "Ajuste proposto.",
          evidence: [evidenceActive],
        },
      ],
    }),
    decisions,
  ).execute(await authoritative());
  const coachDraftId = (await decisions.materialize(coachDecision.id))
    .materializedProgramId;
  let coachDraft = await reloaded.getProgram.execute(coachDraftId);
  structure = programToStructureInput(coachDraft);
  structure = structureEdits.addBlock(structure, "Bloco D");
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Treino A"),
    EX_X,
  );
  structure = structureEdits.removeDay(structure, pathOf(structure, "Dia 7"));
  await reloaded.saveProgram.execute(coachDraftId, structure);
  coachDraft = await reloaded.getProgram.execute(coachDraftId);
  assert.deepEqual(
    setContent(coachDraft, "Dia 4").slice(2, 4),
    [3, 4],
    "Coach RIR change kept",
  );
  assert.equal(coachDraft.blocks.length, 4);
  // 19. Review Evidence reports only the real structural differences.
  let review = await reviewOf(coachDecision.id);
  assert.equal(review.matchingStrategy, "lineage");
  assert.equal(
    review.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
  assert.deepEqual(review.changeCategories, [
    "prescription_added",
    "prescription_removed",
    "program_structure_changed",
  ]);
  assert.equal(review.changesOutsideProposal, true);
  // 20-22. Auto-draft: a structural edit keeps the automatic change and its review.
  const preferences = new SupabaseCoachPreferenceRepository(reloadedClient);
  await preferences.setAutonomyMode("proactive");
  await preferences.setDraftAuthorityMode("standard_auto_draft");
  const activeQ = await reloaded.activateProgram.execute(coachDraftId);
  const dossierQ = await replacementApi().dossier.execute();
  const evidenceQ = dossierQ.evidence.find(
    (item) => item.kind === "training_program" && item.id === activeQ.id,
  );
  const day1 = activeQ.blocks[0].weeks[0].days[0];
  assert.equal(day1.name, "Dia 1");
  const autoRun = await new AnalyzeAthleteWithCoachAndGovernance(
    new AnalyzeAthleteWithCoach(
      { execute: async () => dossierQ },
      {
        async analyze(_request, requestId) {
          return {
            analysis: {
              ...coachFixture,
              requestId,
              observations: coachFixture.observations.map((item) => ({
                ...item,
                evidence: [evidenceQ],
              })),
              recommendations: coachFixture.recommendations.map((item) => ({
                ...item,
                evidence: [evidenceQ],
              })),
              evidenceUsed: [evidenceQ],
            },
            provider: "fixture",
            model: "deterministic",
            inputTokens: null,
            outputTokens: null,
          };
        },
      },
      new DeterministicCoachSafetyPolicy(),
    ),
    analysisRuns,
    analysisProgramFrom({ execute: async () => dossierQ }),
    new GenerateCoachProposal(
      { execute: async () => dossierQ },
      programsRepo,
      new FixtureCoachProposalProvider({
        ...proposalFixture,
        schemaVersion: "coach-proposal-v3",
        id: crypto.randomUUID(),
        sourceProgramId: activeQ.id,
        sourceProgramRevision: activeQ.revision,
        evidenceReferences: [evidenceQ],
        actions: [
          {
            kind: "adjust_prescription_rest",
            trainingDayId: day1.id,
            exercisePrescriptionId: day1.prescriptions[0].id,
            prescriptionSetId: day1.prescriptions[0].sets[0].id,
            restMinSeconds: 120,
            restMaxSeconds: 180,
            rationale: "Ajuste conservador.",
            evidence: [evidenceQ],
          },
        ],
      }),
      decisions,
    ),
    preferences,
    undefined,
    new PrepareConservativeAutoDraft(preferences, programsRepo, decisions),
  ).execute({
    userRequest: "Edição explícita de estrutura",
    analysisMode: "question",
    analysisRequestId: crypto.randomUUID(),
  });
  assert.equal(autoRun.autoDraft.status, "materialized");
  const autoDraftId = autoRun.autoDraft.draftProgramId;
  let autoDraft = await reloaded.getProgram.execute(autoDraftId);
  structure = programToStructureInput(autoDraft);
  structure = structureEdits.moveBlock(
    structure,
    pathOf(structure, "Dia 4"),
    1,
  );
  structure = structureEdits.addWeek(structure, pathOf(structure, "Dia 1"));
  structure = structureEdits.addPrescription(
    structure,
    pathOf(structure, "Treino A"),
    EX_Y,
  );
  await reloaded.saveProgram.execute(autoDraftId, structure);
  autoDraft = await reloaded.getProgram.execute(autoDraftId);
  assert.deepEqual(
    setContent(autoDraft, "Dia 1").slice(4, 6),
    [120, 180],
    "auto-draft rest change kept",
  );
  review = await reviewOf(autoRun.autoDraft.decision.id);
  assert.equal(review.reviewStatus, "awaiting_review");
  assert.equal(
    review.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
  assert.deepEqual(review.changeCategories, [
    "sequence_changed",
    "prescription_added",
    "program_structure_changed",
  ]);
  // 23. Nothing is activated automatically: the source stays active.
  assert.equal(
    (await reloaded.getProgram.execute(activeQ.id)).status,
    "active",
  );
  assert.equal(autoDraft.status, "draft");
  // 24. Human activation records the edits.
  await reloaded.activateProgram.execute(autoDraftId);
  review = await reviewOf(autoRun.autoDraft.decision.id);
  assert.equal(review.reviewStatus, "activated_with_edits");
  // 25-26. Logout/login: the edited structure rebuilds identically.
  const finalBefore = nodes(await reloaded.getProgram.execute(autoDraftId));
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.deepEqual(
    nodes(await reloaded.getProgram.execute(autoDraftId)),
    finalBefore,
  );
  await preferences.setDraftAuthorityMode("manual_draft");
  await preferences.setAutonomyMode("manual");
}

// Corrective pass — atomic & idempotent new program creation (ADR-0100..0102).
{
  // 1. Signed-up, onboarded athlete (the session above).
  const countFor = async (requestId) => {
    const { data, error } = await reloadedClient
      .from("training_programs")
      .select("id")
      .eq("creation_request_id", requestId);
    assert.equal(error, null);
    return data.length;
  };
  const tree = (program) =>
    program.blocks.map((block) => ({
      lineage: block.lineageId,
      name: block.name,
      weeks: block.weeks.map((week) => ({
        lineage: week.lineageId,
        days: week.days.map((day) => ({
          lineage: day.lineageId,
          name: day.name,
          prescriptions: day.prescriptions.map((prescription) => ({
            lineage: prescription.lineageId,
            exerciseId: prescription.exerciseId,
            sets: prescription.sets.map((set) => [
              set.lineageId,
              set.targetMin,
              set.targetMax,
              set.rirMin,
              set.rirMax,
              set.restMinSeconds,
              set.restMaxSeconds,
              set.loadKind,
              set.loadKg,
            ]),
          })),
        })),
      })),
    }));
  const plannedSet = (sequence) => ({
    sequence,
    targetMetric: "reps",
    targetMin: 6,
    targetMax: 8,
    rirMin: 1,
    rirMax: 2,
    restMinSeconds: 120,
    restMaxSeconds: 180,
    tempo: null,
    loadKind: "athlete_selected",
    loadKg: null,
  });
  const dayInput = (sequence, name, exerciseId) => ({
    sequence,
    name,
    prescriptions: [
      { sequence: 1, exerciseId, sets: [plannedSet(1), plannedSet(2)] },
    ],
  });
  // 2. Local multi-block/week/day tree (as the builder holds it).
  const localTree = {
    blocks: [
      {
        sequence: 1,
        name: "Base",
        weeks: [
          {
            sequence: 1,
            name: "Semana 1",
            days: [
              dayInput(1, "Treino A", EX_X),
              dayInput(2, "Treino B", EX_Y),
            ],
          },
          {
            sequence: 2,
            name: "Semana 2",
            days: [dayInput(1, "Treino C", EX_Z)],
          },
        ],
      },
      {
        sequence: 2,
        name: "Intensificação",
        weeks: [
          {
            sequence: 1,
            name: "Semana 1",
            days: [dayInput(1, "Treino D", EX_X)],
          },
        ],
      },
    ],
  };
  // 3. One creation intent = one stable request id.
  const creationRequestId = crypto.randomUUID();
  const create = (name, structure) =>
    reloaded.createProgramWithStructure.execute({
      creationRequestId,
      name,
      structure,
    });
  // 4-6. A tree the server rejects (unknown exercise) fails atomically: zero drafts.
  const invalid = structuredClone(localTree);
  invalid.blocks[1].weeks[0].days[0].prescriptions[0].exerciseId =
    crypto.randomUUID();
  const programsBefore = (
    await reloadedClient.from("training_programs").select("id")
  ).data.length;
  await assert.rejects(async () => create("Programa atômico", invalid));
  assert.equal(
    await countFor(creationRequestId),
    0,
    "no draft after failed creation",
  );
  assert.equal(
    (await reloadedClient.from("training_programs").select("id")).data.length,
    programsBefore,
    "no orphan program row",
  );
  // 7-10. Corrected tree, same intent: success, exactly one draft.
  const created = await create("Programa atômico", localTree);
  assert.equal(created.status, "draft");
  assert.equal(created.supersedesProgramId, null);
  assert.equal(created.revision, 1);
  assert.equal(created.lineageTracked, true);
  assert.equal(await countFor(creationRequestId), 1);
  // 11. Full tree persisted.
  assert.deepEqual(
    created.blocks.map((block) =>
      block.weeks.map((week) => week.days.map((day) => day.name)),
    ),
    [[["Treino A", "Treino B"], ["Treino C"]], [["Treino D"]]],
  );
  assert.equal(
    created.blocks[0].weeks[0].days[1].prescriptions[0].sets[1].restMaxSeconds,
    180,
  );
  // 12. Fresh, distinct lineage on every node.
  const lineages = created.blocks.flatMap((block) => [
    block.lineageId,
    ...block.weeks.flatMap((week) => [
      week.lineageId,
      ...week.days.flatMap((day) => [
        day.lineageId,
        ...day.prescriptions.flatMap((prescription) => [
          prescription.lineageId,
          ...prescription.sets.map((set) => set.lineageId),
        ]),
      ]),
    ]),
  ]);
  assert.ok(lineages.every((lineage) => /^[0-9a-f-]{36}$/.test(lineage)));
  assert.equal(new Set(lineages).size, lineages.length);
  assert.equal(
    lineages.length,
    2 + 3 + 4 + 4 + 8,
    "blocks+weeks+days+prescriptions+sets",
  );
  // 13-15. Lost response: the same id and payload return the same draft.
  const retried = await create("Programa atômico", structuredClone(localTree));
  assert.equal(retried.id, created.id);
  assert.equal(await countFor(creationRequestId), 1);
  // 16-18. Same id, changed name or tree: conflict; the draft is unchanged.
  for (const [name, structure] of [
    ["Outro nome", localTree],
    ["Programa atômico", { blocks: localTree.blocks.slice(0, 1) }],
  ])
    await assert.rejects(
      async () => create(name, structure),
      (error) =>
        error instanceof ProgramCreationConflictError &&
        error.existingProgramId === created.id,
    );
  const unchanged = await reloaded.getProgram.execute(created.id);
  assert.equal(unchanged.name, "Programa atômico");
  assert.deepEqual(tree(unchanged), tree(created));
  // 19-20. Concurrent equivalent requests: one draft, same id for both.
  const concurrentId = crypto.randomUUID();
  const concurrent = await Promise.all(
    [0, 1, 2].map(() =>
      reloaded.createProgramWithStructure.execute({
        creationRequestId: concurrentId,
        name: "Programa concorrente",
        structure: localTree,
      }),
    ),
  );
  assert.equal(new Set(concurrent.map((program) => program.id)).size, 1);
  assert.equal(await countFor(concurrentId), 1);
  // 21-22. Existing draft editing is unchanged (full-tree save, lineage kept).
  let structure = programToStructureInput(created);
  structure = structureEdits.updateSet(
    structure,
    { block: 1, week: 0, day: 0 },
    0,
    0,
    { rirMin: 2, rirMax: 3 },
  );
  const edited = await reloaded.saveProgram.execute(created.id, structure);
  assert.deepEqual(
    [
      edited.blocks[1].weeks[0].days[0].prescriptions[0].sets[0].rirMin,
      edited.blocks[1].weeks[0].days[0].prescriptions[0].sets[0].lineageId,
    ],
    [2, created.blocks[1].weeks[0].days[0].prescriptions[0].sets[0].lineageId],
  );
  assert.deepEqual(tree(edited).slice(0, 1), tree(created).slice(0, 1));
  assert.equal(await countFor(creationRequestId), 1, "editing creates nothing");
  // 23. Activation only by explicit human action.
  assert.equal((await reloaded.getProgram.execute(created.id)).status, "draft");
  const activated = await reloaded.activateProgram.execute(created.id);
  assert.equal(activated.status, "active");
  // 24-25. Logout/login: the program rebuilds identically.
  const before = tree(await reloaded.getProgram.execute(created.id));
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.deepEqual(tree(await reloaded.getProgram.execute(created.id)), before);
}

// Corrective pass — program creation boundary enforcement (ADR-0103). -----
{
  // 1. Signed-up, onboarded athlete (the session above).
  const athleteId = (await reloaded.ensure.execute()).id;
  const programCount = async () =>
    (await reloadedClient.from("training_programs").select("id")).data.length;
  const before = await programCount();
  // 2-4. Direct authenticated root insert: denied, no row.
  const direct = await reloadedClient
    .from("training_programs")
    .insert({ athlete_id: athleteId, name: "Raiz direta" })
    .select("id");
  assert.equal(direct.error?.code, "42501", "direct insert denied");
  assert.equal(direct.data, null);
  assert.equal(await programCount(), before, "no row created");
  // 5-7. Atomic creation works; retrying the same intent returns the same draft.
  const creationRequestId = crypto.randomUUID();
  const structure = {
    blocks: [
      {
        sequence: 1,
        name: "Base",
        weeks: [
          {
            sequence: 1,
            days: [
              {
                sequence: 1,
                name: "Treino A",
                prescriptions: [
                  {
                    sequence: 1,
                    exerciseId: EX_X,
                    sets: [
                      {
                        sequence: 1,
                        targetMetric: "reps",
                        targetMin: 8,
                        targetMax: 10,
                        rirMin: 2,
                        rirMax: 3,
                        restMinSeconds: 90,
                        restMaxSeconds: 150,
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
  };
  const root = await reloaded.createProgramWithStructure.execute({
    creationRequestId,
    name: "Raiz controlada",
    structure,
  });
  assert.equal(root.status, "draft");
  assert.equal(root.athleteId, athleteId, "athlete derived by the server");
  assert.equal(
    (
      await reloaded.createProgramWithStructure.execute({
        creationRequestId,
        name: "Raiz controlada",
        structure,
      })
    ).id,
    root.id,
  );
  assert.equal(await programCount(), before + 1);
  // 8. Existing draft editing still works.
  const edited = await reloaded.saveProgram.execute(
    root.id,
    structureEdits.renameDay(
      programToStructureInput(root),
      { block: 0, week: 0, day: 0 },
      "Treino A1",
    ),
  );
  assert.equal(edited.blocks[0].weeks[0].days[0].name, "Treino A1");
  // 13. Activation only by explicit human action.
  assert.equal((await reloaded.getProgram.execute(root.id)).status, "draft");
  const active = await reloaded.activateProgram.execute(root.id);
  // 9-10. Revision through the controlled (definer) clone keeps working.
  const revision = await reloaded.cloneProgram.execute(active.id);
  assert.equal(revision.status, "draft");
  assert.equal(revision.supersedesProgramId, active.id);
  assert.equal(revision.revision, 2);
  assert.equal(
    revision.blocks[0].weeks[0].days[0].lineageId,
    active.blocks[0].weeks[0].days[0].lineageId,
  );
  // 11-12. Coach materialization and auto-draft ran earlier in this same run,
  // after the boundary migration: both origins produced drafts.
  const { data: materialized, error: materializedError } = await reloadedClient
    .from("coach_decisions")
    .select("materialization_origin,materialized_program_id")
    .not("materialized_program_id", "is", null);
  assert.equal(materializedError, null);
  assert.deepEqual(
    [
      ...new Set(materialized.map((item) => item.materialization_origin)),
    ].sort(),
    ["auto_draft", "human"],
  );
  // 14-15. Logout/login: data rebuilds unchanged.
  const snapshotBefore = JSON.stringify([
    await reloaded.getProgram.execute(active.id),
    await reloaded.getProgram.execute(revision.id),
  ]);
  await reloaded.signOut.execute();
  await reloaded.signIn.execute(credentials);
  assert.equal(
    JSON.stringify([
      await reloaded.getProgram.execute(active.id),
      await reloaded.getProgram.execute(revision.id),
    ]),
    snapshotBefore,
  );
}

firstClient.auth.stopAutoRefresh();
reloadedClient.auth.stopAutoRefresh();
serviceClient.auth.stopAutoRefresh();
console.log(
  "Local Auth/onboarding/training/workout/performance/dossier/coach/proposal/draft/outcome/response-memory/set-count/exercise-replacement/governance/analysis-authority/auto-draft/draft-review/lineage/full-structure/structure-editing/atomic-creation/creation-boundary flow passed.",
);
