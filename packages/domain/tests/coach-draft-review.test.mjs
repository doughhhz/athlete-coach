import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_DRAFT_REVIEW_EVIDENCE_VERSION,
  DOSSIER_DRAFT_REVIEW_LIMIT,
  athleteTrainingDossierSchemaVersions,
  buildCoachDraftReviewEvidence,
  buildCoachDraftReviewHistory,
  collectDossierEvidenceIds,
  compactDraftReviewHistory,
  draftReviewStatuses,
} from "../src/index.ts";

const set = (id, sequence, change = {}) => ({
  id,
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
const prescription = (id, sequence, sets, exerciseId = `exercise-${id}`) => ({
  id,
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
    blocks: [
      {
        id: `${id}-block`,
        sequence: 1,
        name: "B",
        description: null,
        weeks: [
          {
            id: `${id}-week`,
            sequence: 1,
            name: null,
            notes: null,
            days: [
              {
                id: `${id}-day`,
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
const source = program("source", [
  prescription("p1", 1, [set("s1", 1), set("s2", 2)]),
  prescription("p2", 2, [set("t1", 1)]),
]);
const evidence = { kind: "training_program", id: "source", version: "1" };
const rirAction = {
  kind: "adjust_prescription_rir",
  trainingDayId: "source-day",
  exercisePrescriptionId: "p1",
  prescriptionSetId: "s1",
  rirMin: 3,
  rirMax: 3,
  rationale: "r",
  evidence: [evidence],
};
function decision(actions = [rirAction], change = {}) {
  return {
    id: "decision-1",
    athleteId: "athlete",
    status: "materialized",
    proposal: {
      schemaVersion: "coach-proposal-v3",
      id: "proposal",
      analysisId: "analysis",
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
        promptVersion: "coach-proposal-prompt-v5",
        policyVersion: "coach-safety-v1",
        dossierSchemaVersion: "athlete-training-dossier-v5",
      },
    },
    rejectionReason: null,
    rejectionNotes: null,
    proposedAt: "2026-10-01T00:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    staleAt: null,
    materializedAt: "2026-10-02T10:00:00.000Z",
    materializedProgramId: "draft",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    proposalOrigin: "proactive",
    autonomyModeAtCreation: "proactive",
    analysisRequestId: "request",
    governance: {
      policyVersion: "coach-governance-v1",
      reviewClass: "standard_review",
      reasons: ["planned_rir_increase"],
    },
    autoDraft: {
      policyVersion: "coach-auto-draft-v1",
      eligibility: "eligible",
      reasons: ["planned_rir_increase"],
    },
    materializationOrigin: "auto_draft",
    ...change,
  };
}
/** A draft as the database materializes it (new ids, applied proposal). */
function draft(prescriptions, change = {}) {
  return program("draft", prescriptions, {
    status: "draft",
    revision: 2,
    supersedesProgramId: "source",
    activatedAt: null,
    ...change,
  });
}
const materialized = (
  p1Sets = [set("d1", 1, { rirMin: 3, rirMax: 3 }), set("d2", 2)],
  p2 = [set("d3", 1)],
  extra = [],
) => [
  prescription("dp1", 1, p1Sets, "exercise-p1"),
  prescription("dp2", 2, p2, "exercise-p2"),
  ...extra,
];
const activated = { status: "active", activatedAt: "2026-10-03T10:00:00.000Z" };
const build = (
  draftProgram,
  decisionValue = decision(),
  sourceProgram = source,
) => buildCoachDraftReviewEvidence(decisionValue, sourceProgram, draftProgram);

test("no review evidence without materialization", () => {
  for (const status of ["proposed", "rejected", "stale"])
    assert.equal(
      build(
        null,
        decision([rirAction], {
          status,
          materializedProgramId: null,
          materializedAt: null,
          materializationOrigin: null,
        }),
      ),
      null,
    );
});

test("auto-draft awaiting review, unchanged: factual, no judgment", () => {
  const result = build(draft(materialized()));
  assert.equal(result.schemaVersion, COACH_DRAFT_REVIEW_EVIDENCE_VERSION);
  assert.equal(result.reviewStatus, "awaiting_review");
  assert.equal(result.reviewedDraftDiffers, false);
  assert.deepEqual(result.changeCategories, []);
  assert.equal(result.materializationOrigin, "auto_draft");
  assert.equal(result.timeUntilActivationSeconds, null);
  assert.deepEqual(result.evidence, [
    {
      kind: "coach_draft_review",
      id: "decision-1",
      version: "coach-draft-review-evidence-v1",
    },
  ]);
});

test("awaiting review with edits stays awaiting review, with facts", () => {
  const result = build(
    draft(materialized([set("d1", 1, { rirMin: 4, rirMax: 4 }), set("d2", 2)])),
  );
  assert.equal(result.reviewStatus, "awaiting_review");
  assert.equal(result.reviewedDraftDiffers, true);
  assert.deepEqual(result.changeCategories, ["rir_changed"]);
});

test("activated unchanged", () => {
  const result = build(draft(materialized(), activated));
  assert.equal(result.reviewStatus, "activated_unchanged");
  assert.equal(result.timeUntilActivationSeconds, 86400);
  assert.equal(result.changedPrescriptionCount, 0);
});

test("activated with a scalar edit keeps source → materialized → reviewed", () => {
  const result = build(
    draft(
      materialized([set("d1", 1, { rirMin: 4, rirMax: 4 }), set("d2", 2)]),
      activated,
    ),
  );
  assert.equal(result.reviewStatus, "activated_with_edits");
  const [comparison] = result.actionComparisons;
  assert.deepEqual(comparison.sourceValue, {
    dimension: "planned_rir",
    min: 2,
    max: 2,
  });
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
  assert.equal(comparison.reviewedDiffersFromMaterialized, true);
  assert.equal(result.changesOutsideProposal, false);
  assert.equal(result.changedSetCount, 1);
});

test("multiple edits produce multiple ordered categories", () => {
  const result = build(
    draft(
      materialized([
        set("d1", 1, {
          rirMin: 3,
          rirMax: 3,
          loadKg: 55,
          restMinSeconds: 150,
          restMaxSeconds: 150,
          tempo: "3-1-1-0",
        }),
        set("d2", 2, { targetMin: 6, targetMax: 8 }),
      ]),
      activated,
    ),
  );
  assert.equal(result.reviewStatus, "activated_with_edits");
  assert.deepEqual(result.changeCategories, [
    "target_changed",
    "rest_changed",
    "load_changed",
    "tempo_changed",
  ]);
  assert.equal(
    result.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
});

test("set added, set removed, exercise changed", () => {
  assert.deepEqual(
    build(
      draft(
        materialized([
          set("d1", 1, { rirMin: 3, rirMax: 3 }),
          set("d2", 2),
          set("d9", 3),
        ]),
        activated,
      ),
    ).changeCategories,
    ["set_added"],
  );
  assert.deepEqual(
    build(
      draft(materialized([set("d1", 1, { rirMin: 3, rirMax: 3 })]), activated),
    ).changeCategories,
    ["set_removed"],
  );
  const exercise = build(
    draft(
      [
        prescription(
          "dp1",
          1,
          [set("d1", 1, { rirMin: 3, rirMax: 3 }), set("d2", 2)],
          "other",
        ),
        prescription("dp2", 2, [set("d3", 1)], "exercise-p2"),
      ],
      activated,
    ),
  );
  assert.deepEqual(exercise.changeCategories, ["exercise_changed"]);
  assert.equal(exercise.changedExerciseCount, 1);
});

test("changes outside the proposal are reported separately", () => {
  const result = build(
    draft(
      materialized(undefined, [set("d3", 1, { rirMin: 0, rirMax: 0 })]),
      activated,
    ),
  );
  assert.equal(result.changesOutsideProposal, true);
  assert.equal(
    result.actionComparisons[0].reviewedDiffersFromMaterialized,
    false,
  );
  const added = build(
    draft(
      materialized(undefined, undefined, [
        prescription("dp3", 3, [set("d4", 1)]),
      ]),
      activated,
    ),
  );
  assert.deepEqual(added.changeCategories, ["prescription_added"]);
  assert.equal(added.changesOutsideProposal, true);
});

test("archived without activation; archived after activation stays activated", () => {
  const archived = build(
    draft(materialized(), {
      status: "archived",
      archivedAt: "2026-10-02T12:00:00.000Z",
    }),
  );
  assert.equal(archived.reviewStatus, "archived_without_activation");
  assert.equal(archived.timeUntilArchiveSeconds, 7200);
  const later = build(
    draft(materialized(), {
      status: "archived",
      activatedAt: "2026-10-03T10:00:00.000Z",
      archivedAt: "2026-10-09T00:00:00.000Z",
    }),
  );
  assert.equal(later.reviewStatus, "activated_unchanged");
  assert.equal(later.timeUntilArchiveSeconds, null);
});

test("human materializations use the same projection", () => {
  const human = decision([rirAction], {
    materializationOrigin: "human",
    approvedAt: "2026-10-02T10:00:00.000Z",
    proposalOrigin: "manual",
  });
  assert.equal(
    build(draft(materialized(), activated), human).reviewStatus,
    "activated_unchanged",
  );
  assert.equal(
    build(draft(materialized()), human).reviewStatus,
    "awaiting_review",
  );
});

test("expected draft follows proposal materialization semantics (remove + renumber)", () => {
  const remove = {
    kind: "remove_prescription_set",
    trainingDayId: "source-day",
    exercisePrescriptionId: "p1",
    prescriptionSetId: "s1",
    rationale: "r",
    evidence: [evidence],
  };
  const result = build(
    draft(materialized([set("d2", 1)]), activated),
    decision([remove]),
  );
  assert.equal(result.reviewStatus, "activated_unchanged");
  assert.deepEqual(result.actionComparisons[0].materializedValue, {
    dimension: "set_count",
    count: 1,
  });
  assert.deepEqual(result.actionComparisons[0].sourceValue, {
    dimension: "set_count",
    count: 2,
  });
});

test("the source program is never modified", () => {
  const before = structuredClone(source);
  build(
    draft(materialized([set("d1", 1, { rirMin: 4, rirMax: 4 })]), activated),
  );
  assert.deepEqual(source, before);
});

test("limited data is explicit", () => {
  const missingDraft = build(null);
  assert.equal(missingDraft.reviewStatus, "limited_data");
  assert.ok(
    missingDraft.limitations.includes("materialized_program_unavailable"),
  );
  const missingSource = build(
    draft(materialized(), activated),
    decision(),
    null,
  );
  assert.equal(missingSource.reviewStatus, "limited_data");
  assert.equal(missingSource.reviewedDraftDiffers, null);
  const awaitingWithoutSource = build(draft(materialized()), decision(), null);
  assert.equal(awaitingWithoutSource.reviewStatus, "awaiting_review");
  for (const result of [missingDraft, missingSource])
    assert.ok(result.limitations.includes("editor_identity_not_recorded"));
});

test("no correctness, acceptance, trust or score vocabulary", () => {
  const text = JSON.stringify([
    build(draft(materialized(), activated)),
    draftReviewStatuses,
  ]);
  assert.doesNotMatch(
    text,
    /accept|reject|success|fail|correct|trust|score|rate|reward|approved|discard/i,
  );
});

const evidenceAt = (
  id,
  materializedAt,
  reviewStatus,
  materializationOrigin,
) => ({
  ...build(draft(materialized())),
  decisionId: id,
  materializedAt,
  reviewStatus,
  materializationOrigin,
  evidence: [
    {
      kind: "coach_draft_review",
      id,
      version: "coach-draft-review-evidence-v1",
    },
  ],
});

test("history: transparent counts, bounded deterministic items, no rates", () => {
  const items = [
    evidenceAt(
      "b",
      "2026-10-02T00:00:00.000Z",
      "activated_unchanged",
      "auto_draft",
    ),
    evidenceAt("a", "2026-10-02T00:00:00.000Z", "awaiting_review", "human"),
    evidenceAt(
      "c",
      "2026-10-03T00:00:00.000Z",
      "archived_without_activation",
      "auto_draft",
    ),
    evidenceAt(
      "d",
      "2026-10-01T00:00:00.000Z",
      "activated_with_edits",
      "auto_draft",
    ),
  ];
  const history = buildCoachDraftReviewHistory(items, 2);
  assert.deepEqual(
    history.items.map((item) => item.decisionId),
    ["c", "a"],
  );
  assert.equal(history.totalAvailable, 4);
  assert.equal(history.included, 2);
  assert.equal(history.hasMore, true);
  assert.deepEqual(history.counts.byMaterializationOrigin, {
    human: 1,
    auto_draft: 3,
    not_recorded: 0,
  });
  assert.equal(history.counts.byStatus.activated_unchanged, 1);
  assert.equal(
    history.counts.byOriginAndStatus.auto_draft.archived_without_activation,
    1,
  );
  assert.deepEqual(
    buildCoachDraftReviewHistory([...items].reverse(), 2),
    history,
  );
  assert.doesNotMatch(
    JSON.stringify(history.counts),
    /rate|percent|score|trust|accept/i,
  );
});

test("dossier v6: bounded compact history whose evidence grounds citations", () => {
  assert.ok(
    athleteTrainingDossierSchemaVersions.includes(
      "athlete-training-dossier-v5",
    ),
  );
  assert.ok(
    athleteTrainingDossierSchemaVersions.includes(
      "athlete-training-dossier-v6",
    ),
  );
  const many = Array.from({ length: 12 }, (_, index) =>
    evidenceAt(
      `id-${String(index).padStart(2, "0")}`,
      `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      "awaiting_review",
      "auto_draft",
    ),
  );
  const compact = compactDraftReviewHistory(buildCoachDraftReviewHistory(many));
  assert.equal(compact.items.length, DOSSIER_DRAFT_REVIEW_LIMIT);
  assert.equal(compact.hasMore, true);
  assert.equal("sourceProgram" in compact.items[0], false);
  assert.equal("proposal" in compact.items[0], false);
  const ids = collectDossierEvidenceIds({
    evidence: [],
    last28DaysExerciseExposure: [],
    personalBests: [],
    recentSessions: { items: [] },
    interventionHistory: null,
    responseMemory: null,
    exerciseReplacementCandidates: null,
    draftReviewHistory: compact,
  });
  assert.ok(ids.has(`coach_draft_review:${compact.items[0].decisionId}`));
});
