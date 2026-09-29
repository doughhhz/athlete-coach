import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoachDraftReviewEvidence,
  buildInterventionEpisode,
  flattenPrescriptions,
  matchPrescriptions,
  matchSets,
  structureMatchingStrategy,
} from "../src/index.ts";

// Implementation Phase 18: lineage identities (L-*) survive revisions while
// row ids (r-*) change. "Revision identity is not sequence identity."
const set = (lineageId, sequence, change = {}) => ({
  id: `r-${lineageId}-${sequence}`,
  lineageId,
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
  loadKg: 60,
  ...change,
});
const prescription = (
  lineageId,
  sequence,
  exerciseId,
  sets,
  prefix = "src",
) => ({
  id: `${prefix}-${lineageId}`,
  lineageId,
  exerciseId,
  exerciseName: exerciseId,
  sequence,
  instructions: null,
  athleteCues: null,
  sets,
});
function program(id, prescriptions, change = {}) {
  return {
    id,
    athleteId: "athlete",
    athleteGoalId: null,
    name: "P",
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    activatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    lineageTracked: true,
    blocks: [
      {
        id: `${id}-b`,
        lineageId: "LB",
        sequence: 1,
        name: "B",
        description: null,
        weeks: [
          {
            id: `${id}-w`,
            lineageId: "LW",
            sequence: 1,
            name: null,
            notes: null,
            days: [
              {
                id: `${id}-d`,
                lineageId: "LD",
                sequence: 1,
                name: "A",
                preferredWeekday: null,
                notes: null,
                prescriptions,
              },
            ],
          },
        ],
      },
    ],
    ...change,
  };
}
const sourceSets = () => [set("S1", 1), set("S2", 2)];
const source = program("source", [
  prescription("PA", 1, "bench", sourceSets()),
  prescription("PB", 2, "row", [set("S3", 1)]),
  prescription("PC", 3, "squat", [set("S4", 1)]),
]);
const draftOf = (prescriptions, change = {}) =>
  program("draft", prescriptions, {
    status: "draft",
    revision: 2,
    supersedesProgramId: "source",
    activatedAt: null,
    ...change,
  });
const activated = { status: "active", activatedAt: "2026-10-03T00:00:00.000Z" };
const evidence = { kind: "training_program", id: "source", version: "1" };
const decision = (actions) => ({
  id: "decision",
  athleteId: "athlete",
  status: "materialized",
  materializedProgramId: "draft",
  materializedAt: "2026-10-02T00:00:00.000Z",
  materializationOrigin: "auto_draft",
  proposalOrigin: "proactive",
  approvedAt: null,
  proposal: {
    schemaVersion: "coach-proposal-v3",
    id: "proposal",
    analysisId: "a",
    sourceProgramId: "source",
    sourceProgramRevision: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    summary: "S",
    rationale: "R",
    evidenceReferences: [evidence],
    actions,
    limitations: [],
    requiresHumanApproval: true,
    analysisSnapshot: {
      summary: "S",
      provider: "fixture",
      model: "m",
      promptVersion: "p",
      policyVersion: "coach-safety-v1",
      dossierSchemaVersion: "athlete-training-dossier-v7",
    },
  },
});
const rir = {
  kind: "adjust_prescription_rir",
  trainingDayId: "source-d",
  exercisePrescriptionId: "src-PA",
  prescriptionSetId: "r-S1-1",
  rirMin: 3,
  rirMax: 3,
  rationale: "r",
  evidence: [evidence],
};
// Draft rows: new ids, same lineage (what clone/materialization produce).
const d = (lineageId, sequence, exerciseId, sets) =>
  prescription(lineageId, sequence, exerciseId, sets, "draft");
const withRir = (rirValue = 3) => [
  set("S1", 1, { id: "n1", rirMin: rirValue, rirMax: rirValue }),
  set("S2", 2, { id: "n2" }),
];

test("strategy: lineage only with continuity on both sides, explicit legacy otherwise", () => {
  const draft = draftOf([
    d("PA", 1, "bench", withRir()),
    d("PB", 2, "row", [set("S3", 1)]),
    d("PC", 3, "squat", [set("S4", 1)]),
  ]);
  assert.equal(structureMatchingStrategy(source, draft), "lineage");
  assert.equal(
    structureMatchingStrategy(source, { ...draft, lineageTracked: false }),
    "legacy_position",
  );
  assert.equal(
    structureMatchingStrategy(source, { ...draft, lineageTracked: undefined }),
    "legacy_position",
  );
  const legacySource = program("legacy", [
    { ...prescription("PA", 1, "bench", sourceSets()), lineageId: null },
  ]);
  assert.equal(
    structureMatchingStrategy(legacySource, draft),
    "legacy_position",
  );
  assert.equal(structureMatchingStrategy(null, draft), "legacy_position");
});

test("prescriptions: same lineage matches across reorder; new and removed are explicit", () => {
  const reordered = flattenPrescriptions(
    draftOf([
      d("PA", 1, "bench", []),
      d("PC", 2, "squat", []),
      d("PB", 3, "row", []),
      d("PNEW", 4, "press", []),
    ]),
  );
  const result = matchPrescriptions(
    flattenPrescriptions(source),
    reordered,
    "lineage",
  );
  assert.deepEqual(
    result.pairs.map((pair) => [
      pair.expected.prescription.lineageId,
      pair.compared.prescription.sequence,
    ]),
    [
      ["PA", 1],
      ["PB", 3],
      ["PC", 2],
    ],
  );
  assert.deepEqual(
    result.added.map((item) => item.prescription.lineageId),
    ["PNEW"],
  );
  assert.deepEqual(result.removed, []);
  const legacy = matchPrescriptions(
    flattenPrescriptions(source),
    reordered,
    "legacy_position",
  );
  assert.equal(
    legacy.pairs[1].compared.prescription.lineageId,
    "PC",
    "legacy pairs by position",
  );
});

test("sets: lineage survives scalar edits and reorder; proposal-added sets pair with new sets", () => {
  const expected = [
    set("S1", 1),
    set("S2", 2),
    { ...set("x", 3), id: "proposed:0", lineageId: null },
  ];
  const compared = [
    set("S2", 1, { rirMin: 4, rirMax: 4 }),
    set("S1", 2),
    set("NEW", 3),
  ];
  const result = matchSets(expected, compared, "lineage");
  assert.deepEqual(
    result.pairs.map((pair) => [
      pair.expected.lineageId ?? pair.expected.id,
      pair.compared.lineageId,
    ]),
    [
      ["S1", "S1"],
      ["S2", "S2"],
      ["proposed:0", "NEW"],
    ],
  );
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.added, []);
  const removed = matchSets(
    [set("S1", 1), set("S2", 2)],
    [set("S2", 1)],
    "lineage",
  );
  assert.deepEqual(
    removed.removed.map((item) => item.lineageId),
    ["S1"],
  );
});

test("review v2: reordered exercises are a sequence change, not exercise changes", () => {
  const reviewed = draftOf(
    [
      d("PA", 1, "bench", withRir()),
      d("PC", 2, "squat", [set("S4", 1)]),
      d("PB", 3, "row", [set("S3", 1)]),
    ],
    activated,
  );
  const result = buildCoachDraftReviewEvidence(
    decision([rir]),
    source,
    reviewed,
  );
  assert.equal(result.schemaVersion, "coach-draft-review-evidence-v2");
  assert.equal(result.matchingStrategy, "lineage");
  assert.deepEqual(result.changeCategories, ["sequence_changed"]);
  assert.equal(result.changedExerciseCount, 0);
  assert.equal(result.reviewStatus, "activated_with_edits");
  assert.equal(
    result.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
});

test("review v2: same prescription lineage with a different exercise is exercise_changed", () => {
  const reviewed = draftOf(
    [
      d("PA", 1, "dumbbell_bench", withRir()),
      d("PB", 2, "row", [set("S3", 1)]),
      d("PC", 3, "squat", [set("S4", 1)]),
    ],
    activated,
  );
  const result = buildCoachDraftReviewEvidence(
    decision([rir]),
    source,
    reviewed,
  );
  assert.deepEqual(result.changeCategories, ["exercise_changed"]);
  assert.equal(result.changedPrescriptionCount, 1);
});

test("review v2: scalar edit found through set lineage after a set reorder", () => {
  const reviewed = draftOf(
    [
      d("PA", 1, "bench", [
        set("S2", 1, { id: "n2" }),
        set("S1", 2, { id: "n1", rirMin: 4, rirMax: 4 }),
      ]),
      d("PB", 2, "row", [set("S3", 1)]),
      d("PC", 3, "squat", [set("S4", 1)]),
    ],
    activated,
  );
  const result = buildCoachDraftReviewEvidence(
    decision([rir]),
    source,
    reviewed,
  );
  const [comparison] = result.actionComparisons;
  assert.deepEqual(comparison.materializedValue, {
    dimension: "planned_rir",
    min: 3,
    max: 3,
  });
  assert.deepEqual(comparison.reviewedValue, {
    dimension: "planned_rir",
    min: 4,
    max: 4,
  });
  assert.deepEqual(result.changeCategories, [
    "rir_changed",
    "sequence_changed",
  ]);
});

test("review v2: added and removed sets through lineage", () => {
  const reviewed = draftOf(
    [
      d("PA", 1, "bench", [
        set("S1", 1, { rirMin: 3, rirMax: 3 }),
        set("NEW", 2),
      ]),
      d("PB", 2, "row", [set("S3", 1)]),
      d("PC", 3, "squat", [set("S4", 1)]),
    ],
    activated,
  );
  const result = buildCoachDraftReviewEvidence(
    decision([rir]),
    source,
    reviewed,
  );
  assert.deepEqual(result.changeCategories, ["set_added", "set_removed"]);
});

test("review v2: legacy drafts fall back explicitly to positions", () => {
  const reviewed = draftOf(
    [
      d("PA", 1, "bench", withRir()),
      d("PC", 2, "squat", [set("S4", 1)]),
      d("PB", 3, "row", [set("S3", 1)]),
    ],
    { ...activated, lineageTracked: false },
  );
  const result = buildCoachDraftReviewEvidence(
    decision([rir]),
    source,
    reviewed,
  );
  assert.equal(result.matchingStrategy, "legacy_position");
  assert.ok(
    result.changeCategories.includes("exercise_changed"),
    "legacy positional limitation stays explicit",
  );
});

test("fidelity: replacement A→B activated as C after a move resolves A→C by lineage", () => {
  const replace = {
    kind: "replace_exercise",
    trainingDayId: "source-d",
    exercisePrescriptionId: "src-PA",
    sourceExerciseId: "bench",
    replacementExerciseId: "dumbbell_bench",
    relationshipContext: [],
    loadTransition: { mode: "athlete_selected" },
    rationale: "r",
    evidence: [evidence],
  };
  const implemented = draftOf(
    [
      d("PB", 1, "row", [set("S3", 1)]),
      d("PA", 2, "cable_fly", sourceSets()),
      d("PC", 3, "squat", [set("S4", 1)]),
    ],
    activated,
  );
  const episode = buildInterventionEpisode(
    decision([replace]),
    source,
    implemented,
  );
  const snapshot = episode.actions.find(
    (item) => item.kind === "replace_exercise",
  );
  assert.equal(snapshot.implementedValue.exerciseId, "cable_fly");
  const legacyEpisode = buildInterventionEpisode(decision([replace]), source, {
    ...implemented,
    lineageTracked: false,
  });
  assert.equal(
    legacyEpisode.actions.find((item) => item.kind === "replace_exercise")
      .implementedValue.exerciseId,
    "row",
    "legacy positional fallback keeps its documented limitation",
  );
});

test("fidelity: set-count and scalar actions survive reorder through lineage", () => {
  const remove = {
    kind: "remove_prescription_set",
    trainingDayId: "source-d",
    exercisePrescriptionId: "src-PA",
    prescriptionSetId: "r-S2-2",
    rationale: "r",
    evidence: [evidence],
  };
  const implemented = draftOf(
    [
      d("PC", 1, "squat", [set("S4", 1)]),
      d("PA", 2, "bench", [set("S1", 1, { rirMin: 3, rirMax: 3 })]),
      d("PB", 3, "row", [set("S3", 1)]),
    ],
    activated,
  );
  const episode = buildInterventionEpisode(
    decision([rir, remove]),
    source,
    implemented,
  );
  const scalar = episode.actions.find(
    (item) => item.kind === "adjust_prescription_rir",
  );
  assert.deepEqual(scalar.implementedValue, {
    dimension: "planned_rir",
    min: 3,
    max: 3,
  });
  const count = episode.actions.find(
    (item) => item.kind === "set_count_change",
  );
  assert.deepEqual(count.implementedValue, {
    dimension: "set_count",
    count: 1,
  });
});
