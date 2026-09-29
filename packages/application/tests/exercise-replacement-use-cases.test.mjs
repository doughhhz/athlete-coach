import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  BuildInterventionOutcomes,
  CoachProposalValidationError,
  GenerateCoachProposal,
  GetExerciseReplacementCandidates,
  coachProposalSchema,
} from "../src/index.ts";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uuid(101);
const B = uuid(102);
const C = uuid(103);
const summary = (id, namePt) => ({
  id,
  slug: namePt,
  namePt,
  nameEn: namePt,
  shortDescriptionPt: "",
  movementPattern: "horizontal_push",
  mechanics: "compound",
  laterality: "bilateral",
  difficulty: null,
  isActive: true,
  primaryMuscles: [],
  primaryMuscleGroups: [],
  equipment: [],
});
const edges = [
  { sourceExerciseId: B, targetExerciseId: A, relationType: "variation_of" },
  { sourceExerciseId: C, targetExerciseId: B, relationType: "variation_of" },
];
function catalogRepository(calls = []) {
  return {
    list: async () => [
      summary(A, "Supino reto com barra"),
      summary(B, "Supino reto com halteres"),
      summary(C, "Supino inclinado com halteres"),
    ],
    getBySlug: async () => null,
    listRelationEdges: async (ids) => {
      calls.push(ids);
      return edges.filter(
        (edge) =>
          ids.includes(edge.sourceExerciseId) ||
          ids.includes(edge.targetExerciseId),
      );
    },
  };
}
function program(id, exerciseId, change = {}) {
  return {
    id,
    athleteId: "athlete",
    athleteGoalId: null,
    name: id,
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "",
    updatedAt: "",
    activatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    blocks: [
      {
        id: `${id}-b`,
        sequence: 1,
        name: "B",
        description: null,
        weeks: [
          {
            id: `${id}-w`,
            sequence: 1,
            name: null,
            notes: null,
            days: [
              {
                id: uuid(2),
                sequence: 1,
                name: "D",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: uuid(3),
                    exerciseId,
                    exerciseName: exerciseId,
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets: [
                      {
                        id: uuid(4),
                        sequence: 1,
                        targetMetric: "reps",
                        targetMin: 8,
                        targetMax: 10,
                        rirMin: 2,
                        rirMax: 2,
                        restMinSeconds: 120,
                        restMaxSeconds: 120,
                        tempo: null,
                        loadKind: "absolute",
                        loadKg: 80,
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
    ...change,
  };
}

test("candidates are derived from the stored graph for the requested exercises only", async () => {
  const calls = [];
  const context = await new GetExerciseReplacementCandidates(
    catalogRepository(calls),
  ).execute([A, A]);
  assert.deepEqual(calls, [[A]]);
  assert.equal(context.items.length, 1);
  assert.deepEqual(
    context.items[0].candidates.map((item) => item.exerciseId),
    [B],
  );
  assert.equal(
    (
      await new GetExerciseReplacementCandidates(catalogRepository()).execute(
        [],
      )
    ).items.length,
    0,
  );
});

const snapshot = {
  execute: async () => ({
    athlete: { id: "athlete", userId: "u", onboardingCompletedAt: null },
    profile: null,
    activeGoal: null,
    trainingContext: null,
    availableWeekdays: [],
    latestWeight: null,
  }),
};
function dossierBuilder(activeProgram) {
  return new BuildAthleteTrainingDossier(
    snapshot,
    { getActive: async () => activeProgram },
    { getInProgress: async () => null },
    { listHistoricalSessions: async () => [] },
    () => new Date("2026-09-30T00:00:00.000Z"),
    null,
    new GetExerciseReplacementCandidates(catalogRepository()),
  );
}

test("dossier v5 carries bounded candidates for the active program exercises", async () => {
  const dossier = await dossierBuilder(program(uuid(1), A)).execute();
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v5");
  assert.deepEqual(
    dossier.exerciseReplacementCandidates.items.map(
      (item) => item.sourceExerciseId,
    ),
    [A],
  );
  assert.equal(
    dossier.exerciseReplacementCandidates.items[0].candidates.length,
    1,
  );
  const without = await new BuildAthleteTrainingDossier(
    snapshot,
    { getActive: async () => null },
    { getInProgress: async () => null },
    { listHistoricalSessions: async () => [] },
  ).execute();
  assert.equal(without.exerciseReplacementCandidates, null);
});

const evidence = { kind: "exercise", id: A, version: null };
const proposal = (replacementExerciseId, relationshipContext) => ({
  schemaVersion: "coach-proposal-v3",
  id: uuid(9),
  analysisId: "analysis",
  sourceProgramId: uuid(1),
  sourceProgramRevision: 1,
  createdAt: "2026-09-28T12:00:00.000Z",
  summary: "Trocar",
  rationale: "Equipamento indisponível.",
  evidenceReferences: [evidence],
  actions: [
    {
      kind: "replace_exercise",
      trainingDayId: uuid(2),
      exercisePrescriptionId: uuid(3),
      sourceExerciseId: A,
      replacementExerciseId,
      relationshipContext,
      loadTransition: { mode: "athlete_selected" },
      rationale: "Equipamento indisponível.",
      evidence: [evidence],
    },
  ],
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "m",
    promptVersion: "coach-system-v5",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
});
async function generate(output) {
  const active = program(uuid(1), A);
  const dossier = await dossierBuilder(active).execute();
  const created = [];
  const use = new GenerateCoachProposal(
    {
      execute: async () => ({
        ...dossier,
        activeProgram: { ...dossier.activeProgram, id: uuid(1) },
        evidence: [...dossier.evidence, evidence],
      }),
    },
    { getActive: async () => active },
    { generate: async () => output },
    {
      create: async (value) => (
        created.push(value),
        { id: "d", proposal: value }
      ),
    },
  );
  return { run: () => use.execute({ safetyFlags: [] }), created };
}

test("a replacement from the system-built candidates is validated and persisted", async () => {
  const { run, created } = await generate(
    proposal(B, [
      { relationType: "variation_of", direction: "candidate_to_source" },
    ]),
  );
  await run();
  assert.equal(created.length, 1);
});

test("a model-chosen exercise outside the candidates is rejected even with a claimed relation", async () => {
  for (const output of [
    proposal(C, [
      { relationType: "variation_of", direction: "candidate_to_source" },
    ]),
    proposal(uuid(999), [
      { relationType: "similar_target", direction: "candidate_to_source" },
    ]),
    proposal(B, [
      { relationType: "variation_of", direction: "source_to_candidate" },
    ]),
  ]) {
    const { run, created } = await generate(output);
    await assert.rejects(run, CoachProposalValidationError);
    assert.equal(created.length, 0);
  }
});

test("historical snapshots parse only with their own version", () => {
  const v3 = proposal(B, [
    { relationType: "variation_of", direction: "candidate_to_source" },
  ]);
  assert.equal(
    coachProposalSchema.parse(v3).schemaVersion,
    "coach-proposal-v3",
  );
  assert.equal(
    coachProposalSchema.safeParse({ ...v3, schemaVersion: "coach-proposal-v2" })
      .success,
    false,
  );
  assert.equal(
    coachProposalSchema.safeParse({ ...v3, schemaVersion: "coach-proposal-v1" })
      .success,
    false,
  );
});

test("outcomes rebuild the activated relation context through the relation reader", async () => {
  const decision = {
    id: "decision",
    athleteId: "athlete",
    status: "materialized",
    proposal: {
      ...proposal(B, [
        { relationType: "variation_of", direction: "candidate_to_source" },
      ]),
    },
    rejectionReason: null,
    rejectionNotes: null,
    proposedAt: "2026-09-02T00:00:00.000Z",
    approvedAt: "2026-09-02T00:00:00.000Z",
    rejectedAt: null,
    staleAt: null,
    materializedAt: "2026-09-02T00:00:00.000Z",
    materializedProgramId: uuid(20),
    createdAt: "",
    updatedAt: "",
  };
  const activatedC = program(uuid(20), C, {
    revision: 2,
    activatedAt: "2026-09-10T00:00:00.000Z",
  });
  const calls = [];
  const outcomes = new BuildInterventionOutcomes(
    { list: async () => [decision] },
    { get: async (id) => (id === uuid(1) ? program(uuid(1), A) : activatedC) },
    {
      listHistoricalSessions: async () => [],
      getHistoricalSession: async () => null,
    },
    { list: async () => [] },
    () => new Date("2026-09-30T00:00:00.000Z"),
    catalogRepository(calls),
  );
  const [evaluation] = await outcomes.execute();
  assert.deepEqual(calls[0].sort(), [A, C].sort());
  const action = evaluation.episode.actions[0];
  assert.equal(action.implementedValue.exerciseId, C);
  assert.deepEqual(action.replacement.actualRelationshipContext, []);
});
