import assert from "node:assert/strict";
import test from "node:test";
import {
  INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION,
  RESPONSE_MEMORY_EPISODE_DETAIL_LIMIT,
  RESPONSE_MEMORY_GROUP_LIMIT,
  buildAthleteTrainingDossier,
  buildIndividualResponseMemory,
  buildInterventionHistory,
  collectDossierEvidenceIds,
  deriveChangeDirection,
  deriveObservedFacts,
  median,
  responseMemoryGroupKey,
} from "../src/index.ts";

const BENCH = "exercise-bench";
const ROW = "exercise-row";
const rir = (min, max = min) => ({ dimension: "planned_rir", min, max });
const target = (min, max, metric = "reps") => ({
  dimension: "target",
  metric,
  min,
  max,
});
const facts = (rirMeasured = 3) =>
  deriveObservedFacts(
    Array.from({ length: 3 }, (_, index) => ({
      id: `s${index}`,
      sourcePrescriptionSetId: "p",
      sequence: 1,
      status: "completed",
      plannedMetric: "reps",
      plannedTargetMin: 8,
      plannedTargetMax: 10,
      plannedRirMin: 2,
      plannedRirMax: 2,
      plannedRestMinSeconds: null,
      plannedRestMaxSeconds: null,
      plannedTempo: null,
      plannedLoadKind: "athlete_selected",
      plannedLoadKg: null,
      actualValue: 8,
      actualLoadKg: 60,
      actualRir: index < rirMeasured ? 2 : null,
      performedAt: "2026-09-01T00:00:00.000Z",
      restStartedAt: null,
      restEndedAt: null,
    })),
  );

/** Minimal InterventionOutcomeEvaluation shape consumed by the memory. */
function evaluation({
  id,
  activatedAt,
  exerciseId = BENCH,
  exerciseName = "Supino",
  dimension = "planned_rir",
  before = rir(2),
  proposed = rir(1),
  implemented = proposed,
  baseline = 3,
  post = 3,
  rirDelta = 1,
  e1rmDelta = 2,
  limitations = [],
  status = "evaluable",
  actions,
}) {
  const action = {
    actionIndex: 0,
    kind: "adjust_prescription_rir",
    dimension,
    exerciseId,
    exerciseName,
    sourcePath: {
      blockSequence: 1,
      weekSequence: 1,
      daySequence: 1,
      prescriptionSequence: 1,
      setSequence: 1,
    },
    sourcePrescriptionSetId: "src-set",
    sourceValue: before,
    proposedValue: proposed,
    materializedValue: proposed,
    materializedValueProvenance: "reconstructed_from_source_and_action",
    implementedPrescriptionSetId: implemented ? "impl-set" : null,
    implementedValue: implemented,
    rationale: "r",
    evidence: [],
  };
  const allActions = actions ?? [action];
  const comparison = (metric, delta, scope, unit) => ({
    metric,
    unit,
    scope: { kind: scope, exerciseId },
    relevantDimensions: [],
    before: delta === null ? null : 10,
    after: delta === null ? 12 : 10 + delta,
    absoluteDelta: delta,
    relativeDelta: delta === null ? null : delta / 10,
    beforeSampleCount: baseline,
    afterSampleCount: post,
    evidence: [],
  });
  const comparisons =
    baseline && post
      ? [
          comparison(
            "mean_actual_rir",
            rirDelta,
            "affected_prescription_sets",
            "rir",
          ),
          comparison(
            "rir_coverage_rate",
            0,
            "affected_prescription_sets",
            "ratio",
          ),
          comparison(
            "best_estimated_one_rep_max_kg",
            e1rmDelta,
            "exercise",
            "kg",
          ),
        ]
      : [];
  const window = (count) => ({
    exerciseId,
    exerciseName,
    exposureLimit: 3,
    exposures: Array.from({ length: count }, (_, index) => ({
      workoutSessionId: `${id}-w${index}`,
      sessionStatus: "completed",
      startedAt: activatedAt,
      sourceProgramId: "p",
      sourceProgramRevision: 1,
    })),
    exercise: facts(),
    affectedPrescriptionSets: facts(),
  });
  return {
    schemaVersion: "intervention-outcome-v1",
    interpretationNotice:
      "Post-intervention change is evidence, not proof of causation.",
    decisionId: id,
    sourceProgram: { id: `src-${id}`, revision: 1 },
    interventionProgram: {
      id: `prog-${id}`,
      revision: 2,
      status: "active",
      activatedAt,
      completedAt: null,
      archivedAt: null,
    },
    activatedAt,
    status,
    episode: {
      decisionId: id,
      decisionStatus: "materialized",
      proposalId: `p-${id}`,
      proposalSchemaVersion: "coach-proposal-v1",
      proposalSummary: `Resumo ${id}`,
      proposedAt: activatedAt,
      materializedAt: activatedAt,
      sourceProgram: { id: `src-${id}`, revision: 1 },
      interventionProgram: null,
      activatedAt,
      actions: allActions,
      affectedExerciseIds: [exerciseId],
      affectedDimensions: [
        ...new Set(allActions.map((item) => item.dimension)),
      ],
      concurrentActionCount: allActions.length,
      motivatingEvidence: [],
      provenance: {},
    },
    interventionFidelity: {
      implementedProgramState: "activated",
      actions: allActions.map((item) => ({
        actionIndex: item.actionIndex,
        locatedInImplementedProgram: item.implementedValue !== null,
        exerciseIdentityPreserved: true,
        proposedValueImplemented:
          JSON.stringify(item.implementedValue) ===
          JSON.stringify(item.proposedValue),
        additionalChangesInAffectedPrescription: [],
      })),
      unproposedChangedPrescriptionCount: 0,
      structureChanged: false,
    },
    baseline: [window(baseline)],
    postIntervention: [
      { ...window(post), closed: true, closeReason: "max_exposures_reached" },
    ],
    comparisons,
    crossExercisePairs: [],
    dataCoverage: { exposureLimit: 3, exercises: [] },
    bodyWeightContext: {
      atActivation: null,
      latestInPostWindow: null,
      absoluteDeltaKg: null,
    },
    limitations: limitations.map((code) => ({ code, exerciseId: null })),
    evidenceReferences: [],
    generatedAt: "2026-09-30T00:00:00.000Z",
  };
}
const build = (evaluations, options = {}) =>
  buildIndividualResponseMemory(evaluations, {
    athleteId: "athlete-1",
    generatedAt: "2026-09-30T00:00:00.000Z",
    ...options,
  });
const agg = (group, metric) =>
  group.aggregates.find((item) => item.metric === metric);

// GROUPING ------------------------------------------------------------------

test("same exercise and dimension are grouped; other exercises and dimensions separated", () => {
  const memory = build([
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
    evaluation({ id: "b", activatedAt: "2026-09-05T00:00:00.000Z" }),
    evaluation({
      id: "c",
      activatedAt: "2026-09-06T00:00:00.000Z",
      exerciseId: ROW,
      exerciseName: "Remada",
    }),
    evaluation({
      id: "d",
      activatedAt: "2026-09-07T00:00:00.000Z",
      dimension: "target",
      before: target(8, 10),
      proposed: target(6, 8),
    }),
  ]);
  assert.equal(memory.schemaVersion, INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION);
  assert.deepEqual(
    memory.groups.items.map((group) => group.key),
    [`${BENCH}.target.reps`, `${ROW}.planned_rir`, `${BENCH}.planned_rir`],
  );
  assert.equal(memory.groups.items[2].coverage.totalEpisodes, 2);
});

test("target reps and seconds are never grouped together", () => {
  const memory = build([
    evaluation({
      id: "r",
      activatedAt: "2026-09-01T00:00:00.000Z",
      dimension: "target",
      before: target(8, 10),
      proposed: target(6, 8),
    }),
    evaluation({
      id: "s",
      activatedAt: "2026-09-02T00:00:00.000Z",
      dimension: "target",
      before: target(30, 40, "seconds"),
      proposed: target(40, 50, "seconds"),
    }),
  ]);
  assert.deepEqual(
    memory.groups.items.map((group) => [group.key, group.targetMetric]),
    [
      [`${BENCH}.target.seconds`, "seconds"],
      [`${BENCH}.target.reps`, "reps"],
    ],
  );
});

test("group identity is a stable structured key, not a random ID", () => {
  assert.equal(
    responseMemoryGroupKey("x", "planned_rest", null),
    "x.planned_rest",
  );
  assert.equal(
    responseMemoryGroupKey("x", "target", "meters"),
    "x.target.meters",
  );
  const one = build([
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
  ]);
  const two = build([
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
  ]);
  assert.equal(one.groups.items[0].key, two.groups.items[0].key);
  assert.deepEqual(one.groups.items[0].evidence[0], {
    kind: "response_memory_group",
    id: `${BENCH}.planned_rir`,
    version: "individual-response-memory-v3",
  });
});

// SIGNATURE -----------------------------------------------------------------

test("change direction is structural and unambiguous only", () => {
  assert.equal(deriveChangeDirection(rir(2), rir(1)), "decrease");
  assert.equal(
    deriveChangeDirection(
      { dimension: "planned_rest", minSeconds: 90, maxSeconds: 90 },
      { dimension: "planned_rest", minSeconds: 120, maxSeconds: 120 },
    ),
    "increase",
  );
  assert.equal(
    deriveChangeDirection(
      { dimension: "absolute_load", loadKind: "absolute", loadKg: 80 },
      { dimension: "absolute_load", loadKind: "absolute", loadKg: 82.5 },
    ),
    "increase",
  );
  assert.equal(
    deriveChangeDirection(target(8, 10), target(10, 12)),
    "increase",
  );
  assert.equal(deriveChangeDirection(target(8, 12), target(8, 10)), "decrease");
  assert.equal(deriveChangeDirection(target(8, 10), target(6, 12)), "mixed");
  assert.equal(deriveChangeDirection(rir(2), rir(2)), "unchanged");
  assert.equal(
    deriveChangeDirection(rir(null, null), rir(2)),
    "not_comparable",
  );
  assert.equal(
    deriveChangeDirection(target(8, 10), target(30, 40, "seconds")),
    "not_comparable",
  );
  assert.equal(
    deriveChangeDirection(
      {
        dimension: "absolute_load",
        loadKind: "athlete_selected",
        loadKg: null,
      },
      { dimension: "absolute_load", loadKind: "absolute", loadKg: 80 },
    ),
    "not_comparable",
  );
});

test("signature uses the activated value, not the proposal", () => {
  const memory = build([
    evaluation({
      id: "a",
      activatedAt: "2026-09-01T00:00:00.000Z",
      proposed: rir(1),
      implemented: rir(3),
    }),
  ]);
  const episode = memory.groups.items[0].episodes.items[0];
  assert.deepEqual(episode.signature.changes[0].after, rir(3));
  assert.equal(episode.signature.direction, "increase");
});

// COMPARABILITY -------------------------------------------------------------

test("strict comparable versus context-only with explicit reasons", () => {
  const all = build(
    [
      evaluation({ id: "strict", activatedAt: "2026-09-01T00:00:00.000Z" }),
      evaluation({
        id: "manual",
        activatedAt: "2026-09-02T00:00:00.000Z",
        limitations: [
          "unproposed_changes_in_affected_prescription",
          "multiple_variables_changed_concurrently",
        ],
      }),
      evaluation({
        id: "nobase",
        activatedAt: "2026-09-03T00:00:00.000Z",
        baseline: 0,
        status: "limited_data",
      }),
      evaluation({
        id: "nopost",
        activatedAt: "2026-09-04T00:00:00.000Z",
        post: 0,
        status: "awaiting_post_exposure",
      }),
      evaluation({
        id: "gone",
        activatedAt: "2026-09-05T00:00:00.000Z",
        implemented: null,
      }),
      evaluation({
        id: "norir",
        activatedAt: "2026-09-06T00:00:00.000Z",
        limitations: ["rir_observations_missing"],
      }),
      evaluation({
        id: "datalimited",
        activatedAt: "2026-09-07T00:00:00.000Z",
        limitations: [
          "fewer_post_exposures_than_window",
          "baseline_includes_prior_intervention",
        ],
      }),
    ],
    { episodeDetailLimit: null },
  ).groups.items[0];
  const reasons = Object.fromEntries(
    all.episodes.items.map((episode) => [
      episode.decisionId,
      [episode.comparability.classification, episode.comparability.reasons],
    ]),
  );
  assert.deepEqual(reasons.strict, ["strict_comparable", []]);
  assert.deepEqual(reasons.datalimited, ["strict_comparable", []]);
  assert.equal(reasons.manual[0], "context_only");
  assert.ok(
    reasons.manual[1].includes("unproposed_changes_in_affected_prescription"),
  );
  assert.ok(
    reasons.manual[1].includes("multiple_variables_changed_concurrently"),
  );
  assert.ok(reasons.nobase[1].includes("no_baseline_exposures"));
  assert.ok(reasons.nopost[1].includes("no_post_exposures"));
  assert.ok(reasons.gone[1].includes("activated_change_not_identifiable"));
  assert.ok(reasons.norir[1].includes("rir_observations_missing"));
  assert.equal(all.coverage.totalEpisodes, 7);
  assert.equal(all.coverage.strictComparableEpisodes, 2);
  assert.equal(all.coverage.contextOnlyEpisodes, 5);
  // Context-only evidence is retained, never dropped.
  assert.equal(all.episodes.totalAvailable, 7);
  assert.ok(
    all.limitationCounts.some(
      (item) =>
        item.code === "unproposed_changes_in_affected_prescription" &&
        item.episodeCount === 1,
    ),
  );
});

// AGGREGATES / CONTRADICTION ------------------------------------------------

test("aggregates count signs, missing deltas and median without success semantics", () => {
  const memory = build([
    evaluation({
      id: "a",
      activatedAt: "2026-09-01T00:00:00.000Z",
      e1rmDelta: 2,
    }),
    evaluation({
      id: "b",
      activatedAt: "2026-09-02T00:00:00.000Z",
      e1rmDelta: 0,
    }),
    evaluation({
      id: "c",
      activatedAt: "2026-09-03T00:00:00.000Z",
      e1rmDelta: -1,
    }),
    evaluation({
      id: "d",
      activatedAt: "2026-09-04T00:00:00.000Z",
      e1rmDelta: null,
    }),
  ]);
  const e1rm = agg(memory.groups.items[0], "best_estimated_one_rep_max_kg");
  assert.equal(e1rm.strictComparableEpisodeCount, 4);
  assert.equal(e1rm.positiveDeltaCount, 1);
  assert.equal(e1rm.zeroDeltaCount, 1);
  assert.equal(e1rm.negativeDeltaCount, 1);
  assert.equal(e1rm.missingDeltaCount, 1);
  assert.equal(e1rm.minAbsoluteDelta, -1);
  assert.equal(e1rm.maxAbsoluteDelta, 2);
  assert.equal(e1rm.medianAbsoluteDelta, 0);
  assert.equal(e1rm.signPattern, "opposite_signs");
  assert.equal(e1rm.contradictory, true);
  assert.equal(e1rm.beforeSampleCountTotal, 12);
  assert.equal(memory.summary.groupsWithContradictoryObservations, 1);
  assert.equal("mean" in e1rm, false);
  assert.equal(median([3, 1, 2, 10]), 2.5);
  assert.equal(median([]), null);
});

test("sign patterns: all positive, zero plus one sign, single observation", () => {
  const pattern = (deltas) =>
    agg(
      build(
        deltas.map((delta, index) =>
          evaluation({
            id: `e${index}`,
            activatedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
            e1rmDelta: delta,
          }),
        ),
      ).groups.items[0],
      "best_estimated_one_rep_max_kg",
    );
  assert.equal(pattern([1, 2]).signPattern, "all_positive");
  assert.equal(pattern([1, 2]).contradictory, false);
  assert.equal(pattern([0, 2]).signPattern, "zero_and_one_sign");
  assert.equal(pattern([0, 2]).contradictory, false);
  assert.equal(pattern([-1]).signPattern, "single_observation");
  assert.equal(pattern([0, 0]).signPattern, "all_zero");
});

test("context-only episodes never enter aggregates but stay visible", () => {
  const group = build([
    evaluation({
      id: "a",
      activatedAt: "2026-09-01T00:00:00.000Z",
      e1rmDelta: 3,
    }),
    evaluation({
      id: "b",
      activatedAt: "2026-09-02T00:00:00.000Z",
      e1rmDelta: -2,
      limitations: ["program_revision_changed_other_prescriptions"],
    }),
    evaluation({
      id: "c",
      activatedAt: "2026-09-03T00:00:00.000Z",
      e1rmDelta: 1,
    }),
  ]).groups.items[0];
  const e1rm = agg(group, "best_estimated_one_rep_max_kg");
  assert.equal(e1rm.observedDeltaCount, 2);
  assert.equal(e1rm.negativeDeltaCount, 0);
  assert.equal(group.hasMultipleComparableEpisodes, true);
  assert.deepEqual(
    group.episodes.items.map((episode) => episode.decisionId),
    ["c", "b", "a"],
  );
});

test("single comparable episode is not 'multiple' and yields no strength label", () => {
  const group = build([
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
  ]).groups.items[0];
  assert.equal(group.hasMultipleComparableEpisodes, false);
  assert.doesNotMatch(JSON.stringify(group), /strong|established/i);
});

// BOUNDING / DETERMINISM ----------------------------------------------------

test("bounded groups and episode details expose truncation; aggregates use all episodes", () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    evaluation({
      id: `g${String(index).padStart(2, "0")}`,
      activatedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      exerciseId: `exercise-${index}`,
    }),
  );
  const repeated = Array.from({ length: 7 }, (_, index) =>
    evaluation({
      id: `r${index}`,
      activatedAt: `2026-10-0${index + 1}T00:00:00.000Z`,
      exerciseId: "exercise-repeat",
      e1rmDelta: index,
    }),
  );
  const memory = build([...many, ...repeated]);
  assert.equal(RESPONSE_MEMORY_GROUP_LIMIT, 10);
  assert.equal(RESPONSE_MEMORY_EPISODE_DETAIL_LIMIT, 5);
  assert.deepEqual(
    [
      memory.groups.totalAvailable,
      memory.groups.included,
      memory.groups.hasMore,
    ],
    [13, 10, true],
  );
  const repeatedGroup = memory.groups.items[0];
  assert.equal(repeatedGroup.exerciseId, "exercise-repeat");
  assert.deepEqual(
    [
      repeatedGroup.episodes.totalAvailable,
      repeatedGroup.episodes.included,
      repeatedGroup.episodes.hasMore,
    ],
    [7, 5, true],
  );
  assert.equal(
    agg(repeatedGroup, "best_estimated_one_rep_max_kg")
      .strictComparableEpisodeCount,
    7,
  );
  assert.equal(memory.totalEpisodes, 19);
  assert.equal(memory.includedEpisodeDetails, 5 + 9);
  assert.equal(memory.omittedEpisodeDetails, 19 - 14);
  assert.deepEqual(memory.truncation, {
    groupLimit: 10,
    episodeDetailLimit: 5,
  });
  const unbounded = build([...many, ...repeated], {
    groupLimit: null,
    episodeDetailLimit: null,
  });
  assert.equal(unbounded.groups.hasMore, false);
  assert.equal(unbounded.omittedEpisodeDetails, 0);
});

test("repeated builds are identical regardless of input order", () => {
  const items = [
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
    evaluation({
      id: "b",
      activatedAt: "2026-09-01T00:00:00.000Z",
      e1rmDelta: -3,
    }),
    evaluation({
      id: "c",
      activatedAt: "2026-09-02T00:00:00.000Z",
      exerciseId: ROW,
    }),
  ];
  assert.deepEqual(build(items), build([...items].reverse()));
  assert.deepEqual(
    build(items).groups.items[1].episodes.items.map(
      (episode) => episode.decisionId,
    ),
    ["a", "b"],
  );
});

test("empty memory for a new athlete", () => {
  const memory = build([]);
  assert.equal(memory.summary.totalGroups, 0);
  assert.deepEqual(memory.groups, {
    totalAvailable: 0,
    included: 0,
    hasMore: false,
    items: [],
  });
});

test("non-activated evaluations never form memory", () => {
  const memory = build([
    {
      ...evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
      activatedAt: null,
      status: "awaiting_activation",
    },
  ]);
  assert.equal(memory.totalEpisodes, 0);
});

test("contract carries no causal, optimal, preference or score fields", () => {
  const serialized = JSON.stringify(
    build([
      evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
      evaluation({
        id: "b",
        activatedAt: "2026-09-02T00:00:00.000Z",
        e1rmDelta: -1,
      }),
    ]),
  );
  assert.doesNotMatch(
    serialized,
    /optimal|effectiveness|successScore|responseScore|preferredRir|preferredRest|recommendedLoad|causalEffect|responder|success|failure|weight"?:\s*\d|decay/i,
  );
  assert.match(
    serialized,
    /Response Memory remembers observations, not truths\./,
  );
  assert.match(serialized, /must not become an automatic training rule/);
});

// DOSSIER V3 ---------------------------------------------------------------

test("dossier v3 carries bounded memory by reference without duplicating history", () => {
  const items = [
    evaluation({ id: "a", activatedAt: "2026-09-01T00:00:00.000Z" }),
    evaluation({ id: "b", activatedAt: "2026-09-02T00:00:00.000Z" }),
  ];
  const dossier = buildAthleteTrainingDossier({
    snapshot: {
      athlete: { id: "athlete-1", userId: "u", onboardingCompletedAt: null },
      profile: null,
      activeGoal: null,
      trainingContext: null,
      availableWeekdays: [],
      latestWeight: null,
    },
    activeProgram: null,
    sessions: [],
    generatedAt: "2026-09-30T00:00:00.000Z",
    interventionHistory: buildInterventionHistory(items),
    responseMemory: build(items),
  });
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v8");
  assert.equal(dossier.interventionHistory.included, 2);
  assert.equal(dossier.responseMemory.groups.included, 1);
  const episode = dossier.responseMemory.groups.items[0].episodes.items[0];
  assert.equal("baselineFacts" in episode, false);
  assert.equal("comparisons" in episode, false);
  assert.ok(episode.observations.every((item) => !("evidence" in item)));
  const ids = collectDossierEvidenceIds(dossier);
  assert.ok(ids.has(`response_memory_group:${BENCH}.planned_rir`));
  assert.ok(ids.has("coach_decision:a"));
  assert.deepEqual(JSON.parse(JSON.stringify(dossier)), dossier);
});

// SET COUNT (Phase 13) ------------------------------------------------------

const count = (value) => ({ dimension: "set_count", count: value });
const setCountEvaluation = (change) =>
  evaluation({
    dimension: "set_count",
    before: count(3),
    proposed: count(4),
    ...change,
  });
const withSetCountComparisons = (item, completedDelta, e1rmDelta) => ({
  ...item,
  comparisons: [
    ...item.comparisons,
    {
      metric: "completed_sets_per_exposure",
      unit: "sets",
      scope: {
        kind: "affected_prescription_sets",
        exerciseId: item.episode.affectedExerciseIds[0],
      },
      relevantDimensions: ["set_count"],
      before: 3,
      after: 3 + completedDelta,
      absoluteDelta: completedDelta,
      relativeDelta: completedDelta / 3,
      beforeSampleCount: 3,
      afterSampleCount: 3,
      evidence: [],
    },
  ].map((comparison) =>
    comparison.metric === "best_estimated_one_rep_max_kg"
      ? { ...comparison, absoluteDelta: e1rmDelta, after: 10 + e1rmDelta }
      : comparison,
  ),
});

test("set_count forms one group per exercise keyed without the set numbers", () => {
  const memory = build(
    [
      withSetCountComparisons(
        setCountEvaluation({
          id: "a",
          activatedAt: "2026-09-01T00:00:00.000Z",
        }),
        1,
        2,
      ),
      withSetCountComparisons(
        setCountEvaluation({
          id: "b",
          activatedAt: "2026-09-05T00:00:00.000Z",
          before: count(5),
          proposed: count(4),
        }),
        -1,
        -1,
      ),
      withSetCountComparisons(
        setCountEvaluation({
          id: "c",
          activatedAt: "2026-09-06T00:00:00.000Z",
          exerciseId: ROW,
        }),
        0,
        0,
      ),
    ],
    { episodeDetailLimit: null },
  );
  const bench = memory.groups.items.find(
    (group) => group.key === `${BENCH}.set_count`,
  );
  assert.ok(bench);
  assert.ok(
    memory.groups.items.some((group) => group.key === `${ROW}.set_count`),
  );
  assert.equal(bench.targetMetric, null);
  assert.equal(bench.coverage.totalEpisodes, 2);
  // 3→4 and 5→4 share the group but keep distinct signatures.
  assert.deepEqual(
    bench.episodes.items.map((episode) => [
      episode.signature.changes[0].before.count,
      episode.signature.changes[0].after.count,
      episode.signature.direction,
    ]),
    [
      [5, 4, "decrease"],
      [3, 4, "increase"],
    ],
  );
  assert.deepEqual(bench.directionsObserved, ["decrease", "increase"]);
  const completed = bench.aggregates.find(
    (item) =>
      item.metric === "completed_sets_per_exposure" &&
      item.scope === "affected_prescription_sets",
  );
  assert.equal(completed.positiveDeltaCount, 1);
  assert.equal(completed.negativeDeltaCount, 1);
  assert.equal(completed.contradictory, true);
  assert.ok(
    bench.aggregates.some(
      (item) =>
        item.metric === "planned_sets_per_exposure" &&
        item.scope === "exercise",
    ),
  );
  assert.equal(bench.hasMultipleComparableEpisodes, true);
});

test("set_count with a concurrent change is context-only; structural-only edit stays context", () => {
  const group = build([
    withSetCountComparisons(
      setCountEvaluation({
        id: "clean",
        activatedAt: "2026-09-01T00:00:00.000Z",
      }),
      1,
      1,
    ),
    withSetCountComparisons(
      setCountEvaluation({
        id: "mixed",
        activatedAt: "2026-09-02T00:00:00.000Z",
        limitations: ["multiple_variables_changed_concurrently"],
      }),
      1,
      1,
    ),
  ]).groups.items[0];
  const byId = Object.fromEntries(
    group.episodes.items.map((episode) => [
      episode.decisionId,
      episode.comparability,
    ]),
  );
  assert.equal(byId.clean.classification, "strict_comparable");
  assert.equal(byId.mixed.classification, "context_only");
  assert.ok(
    byId.mixed.reasons.includes("multiple_variables_changed_concurrently"),
  );
  assert.deepEqual(deriveChangeDirection(count(4), count(4)), "unchanged");
});

test("set_count memory has no optimal, preferred or volume fields", () => {
  const serialized = JSON.stringify(
    build([
      withSetCountComparisons(
        setCountEvaluation({
          id: "a",
          activatedAt: "2026-09-01T00:00:00.000Z",
        }),
        1,
        2,
      ),
    ]),
  );
  assert.doesNotMatch(
    serialized,
    /optimal|preferred|bestVolume|setCountEffect|muscle|effectiveSets|hardSets/i,
  );
});
