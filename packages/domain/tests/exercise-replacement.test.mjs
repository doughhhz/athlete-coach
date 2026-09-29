import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_PROPOSAL_SCHEMA_VERSION,
  buildAthleteTrainingDossier,
  buildExerciseReplacementContext,
  buildIndividualResponseEvidence,
  buildIndividualResponseMemory,
  buildInterventionHistory,
  buildInterventionOutcome,
  collectDossierEvidenceIds,
  deriveChangeDirection,
  deriveReplacementCandidates,
  materializeProposalPrescription,
  relationsBetween,
  summarizeReplacementChanges,
  validateCoachProposal,
} from "../src/index.ts";

const A = "exercise-a"; // barbell bench
const B = "exercise-b"; // dumbbell bench: "B variation_of A" (one-way)
const C = "exercise-c"; // incline dumbbell: only related to B
const D = "exercise-d"; // push-up: equipment_alternative both ways with A
const ATHLETE = "athlete-1";
const summary = (id, namePt) => ({
  id,
  slug: id,
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
  equipment: ["bench"],
});
const catalog = [
  summary(A, "Supino reto com barra"),
  summary(B, "Supino reto com halteres"),
  summary(C, "Supino inclinado com halteres"),
  summary(D, "Flexão de braços"),
];
const edges = [
  { sourceExerciseId: B, targetExerciseId: A, relationType: "variation_of" },
  { sourceExerciseId: C, targetExerciseId: B, relationType: "variation_of" },
  {
    sourceExerciseId: D,
    targetExerciseId: A,
    relationType: "equipment_alternative",
  },
  {
    sourceExerciseId: A,
    targetExerciseId: D,
    relationType: "equipment_alternative",
  },
  {
    sourceExerciseId: A,
    targetExerciseId: "exercise-missing",
    relationType: "similar_target",
  },
];

// CANDIDATES ------------------------------------------------------------------

test("candidates come only from stored relations, preserving direction", () => {
  const set = deriveReplacementCandidates(A, edges, catalog);
  assert.deepEqual(
    set.candidates.map((item) => [item.exerciseId, item.relations]),
    [
      [
        D,
        [
          {
            relationType: "equipment_alternative",
            direction: "candidate_to_source",
          },
          {
            relationType: "equipment_alternative",
            direction: "source_to_candidate",
          },
        ],
      ],
      [B, [{ relationType: "variation_of", direction: "candidate_to_source" }]],
    ],
  );
  assert.ok(
    !set.candidates.some((item) => item.exerciseId === C),
    "no relation → no candidate",
  );
  assert.ok(
    !set.candidates.some((item) => item.exerciseId === "exercise-missing"),
    "missing catalog entry dropped",
  );
  // One-way relation is not synthesized in reverse: from B's view A is related
  // only because "B variation_of A" (source_to_candidate), never "A variation_of B".
  assert.deepEqual(relationsBetween(B, A, edges), [
    { relationType: "variation_of", direction: "source_to_candidate" },
  ]);
  assert.deepEqual(relationsBetween(A, C, edges), []);
});

test("duplicate relation rows collapse; ordering and bounding are deterministic", () => {
  const duplicated = [...edges, edges[0]];
  assert.deepEqual(
    deriveReplacementCandidates(A, duplicated, catalog),
    deriveReplacementCandidates(
      A,
      [...duplicated].reverse(),
      [...catalog].reverse(),
    ),
  );
  const limited = deriveReplacementCandidates(A, edges, catalog, 1);
  assert.deepEqual(
    [limited.totalAvailable, limited.included, limited.hasMore],
    [2, 1, true],
  );
  const context = buildExerciseReplacementContext([A, A, B], edges, catalog, 1);
  assert.deepEqual(
    [context.totalAvailable, context.included, context.hasMore],
    [2, 1, true],
  );
});

// PROPOSAL ------------------------------------------------------------------

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
  loadKg: 80,
  ...change,
});
function program(id, exerciseId, change = {}) {
  const { sets = [set(`${id}-s1`, 1), set(`${id}-s2`, 2)], ...rest } = change;
  return {
    id,
    athleteId: ATHLETE,
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
                name: "D",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: `${id}-p`,
                    exerciseId,
                    exerciseName:
                      catalog.find((item) => item.id === exerciseId)?.namePt ??
                      exerciseId,
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...rest,
  };
}
const source = program("prog-a", A);
const evidence = { kind: "exercise", id: A, version: null };
const replace = (change = {}) => ({
  kind: "replace_exercise",
  trainingDayId: "prog-a-day",
  exercisePrescriptionId: "prog-a-p",
  sourceExerciseId: A,
  replacementExerciseId: B,
  relationshipContext: [
    { relationType: "variation_of", direction: "candidate_to_source" },
  ],
  loadTransition: { mode: "athlete_selected" },
  rationale: "Disponibilidade de equipamento.",
  evidence: [evidence],
  ...change,
});
const proposal = (actions, change = {}) => ({
  schemaVersion: COACH_PROPOSAL_SCHEMA_VERSION,
  id: "proposal-1",
  analysisId: "analysis",
  sourceProgramId: "prog-a",
  sourceProgramRevision: 1,
  createdAt: "2026-09-02T00:00:00.000Z",
  summary: "Trocar exercício",
  rationale: "R",
  evidenceReferences: [evidence],
  actions,
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
  ...change,
});
const candidates = buildExerciseReplacementContext([A], edges, catalog);
const context = {
  athleteId: ATHLETE,
  sourceProgram: source,
  activeProgramId: "prog-a",
  evidenceIds: new Set([`exercise:${A}`]),
  replacementCandidates: candidates,
  exerciseRelations: edges,
};
const validate = (actions, change, ctx = context) =>
  validateCoachProposal(proposal(actions, change), ctx);
const messages = (result) =>
  result.issues.map((issue) => issue.message).join(" | ");

test("valid replacement from supplied candidates with explicit load transition", () => {
  assert.equal(COACH_PROPOSAL_SCHEMA_VERSION, "coach-proposal-v3");
  assert.equal(validate([replace()]).valid, true);
  assert.equal(
    validate([
      replace({ loadTransition: { mode: "explicit_absolute", loadKg: 30 } }),
    ]).valid,
    true,
  );
});

for (const [name, change, pattern] of [
  [
    "invented exercise ID",
    { replacementExerciseId: "invented" },
    /candidatos fornecidos/,
  ],
  ["source mismatch", { sourceExerciseId: B }, /origem não corresponde/],
  ["same exercise", { replacementExerciseId: A }, /diferente do atual/],
  [
    "exercise without relation",
    { replacementExerciseId: C },
    /candidatos fornecidos/,
  ],
  [
    "wrong relation direction",
    {
      relationshipContext: [
        { relationType: "variation_of", direction: "source_to_candidate" },
      ],
    },
    /não corresponde às relações registradas/,
  ],
  [
    "absolute load silently preserved",
    { loadTransition: { mode: "preserve_non_absolute" } },
    /Carga absoluta não é copiada/,
  ],
  [
    "invalid explicit load",
    { loadTransition: { mode: "explicit_absolute", loadKg: 0 } },
    /positiva/,
  ],
])
  test(`replacement rejects ${name}`, () => {
    const result = validate([replace(change)]);
    assert.equal(result.valid, false);
    assert.match(messages(result), pattern);
  });

test("symmetric relation (both stored directions) is accepted as stored", () =>
  assert.equal(
    validate([
      replace({
        replacementExerciseId: D,
        relationshipContext: [
          {
            relationType: "equipment_alternative",
            direction: "source_to_candidate",
          },
          {
            relationType: "equipment_alternative",
            direction: "candidate_to_source",
          },
        ],
      }),
    ]).valid,
    true,
  ));

test("non-absolute load may be preserved", () => {
  const selected = program("prog-a", A, {
    sets: [set("prog-a-s1", 1, { loadKind: "athlete_selected", loadKg: null })],
  });
  assert.equal(
    validate(
      [replace({ loadTransition: { mode: "preserve_non_absolute" } })],
      {},
      { ...context, sourceProgram: selected },
    ).valid,
    true,
  );
});

test("conflicts: double replacement, absolute-load adjust on replaced prescription, v2 snapshot", () => {
  assert.match(
    messages(
      validate([
        replace(),
        replace({
          replacementExerciseId: D,
          relationshipContext: relationsBetween(A, D, edges),
        }),
      ]),
    ),
    /duas vezes/,
  );
  assert.match(
    messages(
      validate([
        replace(),
        {
          kind: "adjust_absolute_load_target",
          trainingDayId: "prog-a-day",
          exercisePrescriptionId: "prog-a-p",
          prescriptionSetId: "prog-a-s1",
          loadKg: 90,
          rationale: "r",
          evidence: [evidence],
        },
      ]),
    ),
    /transição de carga/,
  );
  assert.match(
    messages(validate([replace()], { schemaVersion: "coach-proposal-v2" })),
    /Somente coach-proposal-v3/,
  );
  assert.match(
    messages(
      validate([replace()], {}, { ...context, replacementCandidates: null }),
    ),
    /candidatos fornecidos/,
  );
});

test("mirror: sets preserved, exercise swapped, load follows the transition only", () => {
  const prescription = source.blocks[0].weeks[0].days[0].prescriptions[0];
  const athlete = materializeProposalPrescription(prescription, [replace()]);
  assert.equal(athlete.exerciseId, B);
  assert.deepEqual(
    athlete.sets.map((item) => [
      item.sequence,
      item.targetMin,
      item.rirMin,
      item.loadKind,
      item.loadKg,
    ]),
    [
      [1, 8, 2, "athlete_selected", null],
      [2, 8, 2, "athlete_selected", null],
    ],
  );
  const explicit = materializeProposalPrescription(prescription, [
    replace({ loadTransition: { mode: "explicit_absolute", loadKg: 30 } }),
  ]);
  assert.deepEqual(
    explicit.sets.map((item) => item.loadKg),
    [30, 30],
  );
  const [summary] = summarizeReplacementChanges(proposal([replace()]), source);
  assert.deepEqual(
    [
      summary.sourceExerciseName,
      summary.replacementExerciseId,
      summary.setCount,
      summary.loadsBefore[0].loadKg,
      summary.loadsAfter[0].loadKind,
    ],
    ["Supino reto com barra", B, 2, 80, "athlete_selected"],
  );
});

// OUTCOME / FIDELITY ---------------------------------------------------------

const decision = (actions = [replace()], change = {}) => ({
  id: "decision-1",
  athleteId: ATHLETE,
  status: "materialized",
  proposal: proposal(actions),
  rejectionReason: null,
  rejectionNotes: null,
  proposedAt: "2026-09-02T00:00:00.000Z",
  approvedAt: "2026-09-02T01:00:00.000Z",
  rejectedAt: null,
  staleAt: null,
  materializedAt: "2026-09-02T01:00:00.000Z",
  materializedProgramId: "prog-b",
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  ...change,
});
const athleteSets = (prefix) => [
  set(`${prefix}-s1`, 1, { loadKind: "athlete_selected", loadKg: null }),
  set(`${prefix}-s2`, 2, { loadKind: "athlete_selected", loadKg: null }),
];
const activatedWith = (exerciseId, extra = {}) =>
  program("prog-b", exerciseId, {
    revision: 2,
    activatedAt: "2026-09-10T00:00:00.000Z",
    sets: athleteSets("prog-b"),
    ...extra,
  });
function session(id, startedAt, programId, exerciseId, setIds, change = {}) {
  return {
    id,
    athleteId: ATHLETE,
    sourceTrainingDayId: `${programId}-day`,
    sourceProgram: { id: programId, revision: 1, supersedesProgramId: null },
    programName: programId,
    dayName: "D",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      {
        id: `${id}-we`,
        sourceExercisePrescriptionId: `${programId}-p`,
        exerciseId,
        sequence: 1,
        exerciseName: exerciseId,
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: setIds.map((sourcePrescriptionSetId, index) => ({
          id: `${id}-set-${index}`,
          sourcePrescriptionSetId,
          sequence: index + 1,
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
          actualValue: 9,
          actualLoadKg: exerciseId === A ? 80 : 30,
          actualRir: 2,
          performedAt: startedAt,
          restStartedAt: null,
          restEndedAt: null,
        })),
      },
    ],
    ...change,
  };
}
const baseline = [
  session("pre-a-1", "2026-09-03T10:00:00.000Z", "prog-a", A, [
    "prog-a-s1",
    "prog-a-s2",
  ]),
  session("pre-a-2", "2026-09-05T10:00:00.000Z", "prog-a", A, [
    "prog-a-s1",
    "prog-a-s2",
  ]),
];
const post = (exerciseId) => [
  session("post-1", "2026-09-11T10:00:00.000Z", "prog-b", exerciseId, [
    "prog-b-s1",
    "prog-b-s2",
  ]),
  session(
    "post-2",
    "2026-09-13T10:00:00.000Z",
    "prog-b",
    exerciseId,
    ["prog-b-s1"],
    {
      status: "abandoned",
      completedAt: null,
      abandonedAt: "2026-09-13T11:00:00.000Z",
    },
  ),
];
const outcome = (
  implementedExercise = B,
  sessions = [...baseline, ...post(implementedExercise)],
  change = {},
) =>
  buildInterventionOutcome({
    decision: decision(),
    sourceProgram: source,
    interventionProgram: activatedWith(implementedExercise),
    sessions,
    bodyWeights: [],
    exerciseRelations: edges,
    generatedAt: "2026-09-20T00:00:00.000Z",
    ...change,
  });

test("A → B activated: fidelity exact, relations rebuilt, cross-exercise pair without deltas", () => {
  const result = outcome();
  assert.equal(result.schemaVersion, "intervention-outcome-v3");
  const action = result.episode.actions[0];
  assert.equal(action.dimension, "exercise_replacement");
  assert.deepEqual(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    true,
  );
  assert.deepEqual(action.replacement.actualRelationshipContext, [
    { relationType: "variation_of", direction: "candidate_to_source" },
  ]);
  assert.deepEqual(
    result.comparisons,
    [],
    "no same-exercise comparisons for the replaced prescription",
  );
  const [pair] = result.crossExercisePairs;
  assert.deepEqual([pair.beforeExerciseId, pair.afterExerciseId], [A, B]);
  assert.deepEqual(
    pair.baseline.exposures.map((item) => item.workoutSessionId),
    ["pre-a-1", "pre-a-2"],
  );
  assert.deepEqual(
    pair.postIntervention.exposures.map((item) => item.workoutSessionId),
    ["post-1", "post-2"],
  );
  assert.equal(pair.postIntervention.exposures[1].sessionStatus, "abandoned");
  assert.deepEqual(pair.nonComparableMetrics, [
    "best_logged_load_kg",
    "best_estimated_one_rep_max_kg",
  ]);
  assert.ok(
    pair.sideBySide.every(
      (fact) => !("absoluteDelta" in fact) && !("relativeDelta" in fact),
    ),
  );
  assert.ok(!pair.sideBySide.some((fact) => /load|one_rep/.test(fact.metric)));
  const completed = pair.sideBySide.find(
    (fact) => fact.metric === "completed_sets_per_exposure",
  );
  assert.deepEqual([completed.before, completed.after], [2, 1.5]);
  // Each exercise keeps its own load/e1RM facts; they are never paired.
  assert.equal(pair.baseline.exercise.bestLoggedLoadKg, 80);
  assert.equal(pair.postIntervention.exercise.bestLoggedLoadKg, 30);
  assert.equal(result.status, "evaluable");
  assert.equal(pair.replacementPriorHistory.available, false);
});

test("proposed A → B but user activated A → C: actual pair, rebuilt (empty) relation, limitation", () => {
  const result = outcome(C);
  const action = result.episode.actions[0];
  assert.equal(action.proposedValue.exerciseId, B);
  assert.equal(action.implementedValue.exerciseId, C);
  assert.equal(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    false,
  );
  assert.deepEqual(
    action.replacement.proposedRelationshipContext,
    replace().relationshipContext,
  );
  assert.deepEqual(action.replacement.actualRelationshipContext, []);
  assert.equal(result.crossExercisePairs[0].afterExerciseId, C);
  const codes = result.limitations.map((item) => item.code);
  assert.ok(codes.includes("replacement_relation_missing"));
  assert.ok(codes.includes("exercise_identity_changed"));
});

test("pre-existing history of the replacement exercise is kept separate from baseline", () => {
  const priorB = session("prior-b", "2026-08-20T10:00:00.000Z", "prog-old", B, [
    "old-s1",
  ]);
  const result = outcome(B, [priorB, ...baseline, ...post(B)]);
  const [pair] = result.crossExercisePairs;
  assert.equal(pair.replacementPriorHistory.available, true);
  assert.deepEqual(
    pair.replacementPriorHistory.window.exposures.map(
      (item) => item.workoutSessionId,
    ),
    ["prior-b"],
  );
  assert.ok(
    !pair.baseline.exposures.some(
      (item) => item.workoutSessionId === "prior-b",
    ),
  );
});

test("replacement plus set-count change is concurrent and context-only", () => {
  const actions = [
    replace(),
    {
      kind: "add_prescription_set",
      trainingDayId: "prog-a-day",
      exercisePrescriptionId: "prog-a-p",
      position: "end",
      copyFromPrescriptionSetId: null,
      plannedSet: (({ id: _id, sequence: _sequence, ...rest }) => rest)(
        set("x", 1, { loadKind: "athlete_selected", loadKg: null }),
      ),
      rationale: "r",
      evidence: [evidence],
    },
  ];
  const result = buildInterventionOutcome({
    decision: decision(actions),
    sourceProgram: source,
    interventionProgram: activatedWith(B, {
      sets: [
        ...athleteSets("prog-b"),
        set("prog-b-s3", 3, { loadKind: "athlete_selected", loadKg: null }),
      ],
    }),
    sessions: [...baseline, ...post(B)],
    bodyWeights: [],
    exerciseRelations: edges,
    generatedAt: "2026-09-20T00:00:00.000Z",
  });
  assert.deepEqual(result.episode.affectedDimensions, [
    "set_count",
    "exercise_replacement",
  ]);
  assert.ok(
    result.limitations.some(
      (item) => item.code === "multiple_variables_changed_concurrently",
    ),
  );
  const ireGroups = buildIndividualResponseEvidence([result]);
  const memory = buildIndividualResponseMemory([result], {
    athleteId: ATHLETE,
    generatedAt: "2026-09-20T00:00:00.000Z",
  });
  const group = memory.groups.items.find(
    (item) => item.interventionDimension === "exercise_replacement",
  );
  assert.equal(
    group.episodes.items[0].comparability.classification,
    "context_only",
  );
  assert.ok(ireGroups.length >= 1);
});

// IRE / MEMORY ---------------------------------------------------------------

const replacementOutcome = (id, sourceId, replacementId, activatedAt) => {
  const src = program(`src-${id}`, sourceId);
  const impl = program(`impl-${id}`, replacementId, {
    revision: 2,
    activatedAt,
    sets: athleteSets(`impl-${id}`),
  });
  return buildInterventionOutcome({
    decision: {
      ...decision(
        [
          replace({
            trainingDayId: `src-${id}-day`,
            exercisePrescriptionId: `src-${id}-p`,
            sourceExerciseId: sourceId,
            replacementExerciseId: replacementId,
            relationshipContext: relationsBetween(
              sourceId,
              replacementId,
              edges,
            ),
          }),
        ],
        { id, materializedProgramId: `impl-${id}` },
      ),
      proposal: {
        ...proposal([
          replace({
            trainingDayId: `src-${id}-day`,
            exercisePrescriptionId: `src-${id}-p`,
            sourceExerciseId: sourceId,
            replacementExerciseId: replacementId,
            relationshipContext: relationsBetween(
              sourceId,
              replacementId,
              edges,
            ),
          }),
        ]),
        sourceProgramId: `src-${id}`,
      },
    },
    sourceProgram: src,
    interventionProgram: impl,
    sessions: [
      session(`${id}-pre`, "2026-09-01T10:00:00.000Z", `src-${id}`, sourceId, [
        `src-${id}-s1`,
      ]),
      session(
        `${id}-post`,
        `${activatedAt.slice(0, 10)}T12:00:00.000Z`,
        `impl-${id}`,
        replacementId,
        [`impl-${id}-s1`],
      ),
    ],
    bodyWeights: [],
    exerciseRelations: edges,
    generatedAt: "2026-09-30T00:00:00.000Z",
  });
};

test("directed groups: A→B, repeated A→B, B→A and A→D are separate; no numeric aggregation", () => {
  const evaluations = [
    replacementOutcome("d1", A, B, "2026-09-10T00:00:00.000Z"),
    replacementOutcome("d2", A, B, "2026-09-12T00:00:00.000Z"),
    replacementOutcome("d3", B, A, "2026-09-14T00:00:00.000Z"),
    replacementOutcome("d4", A, D, "2026-09-16T00:00:00.000Z"),
  ];
  const memory = buildIndividualResponseMemory(evaluations, {
    athleteId: ATHLETE,
    generatedAt: "2026-09-30T00:00:00.000Z",
  });
  const keys = memory.groups.items.map((group) => group.key).sort();
  assert.deepEqual(
    keys,
    [
      `${A}.exercise_replacement.${B}`,
      `${A}.exercise_replacement.${D}`,
      `${B}.exercise_replacement.${A}`,
    ].sort(),
  );
  const ab = memory.groups.items.find(
    (group) => group.key === `${A}.exercise_replacement.${B}`,
  );
  assert.equal(ab.coverage.totalEpisodes, 2);
  assert.equal(ab.coverage.strictComparableEpisodes, 2);
  assert.equal(ab.hasMultipleComparableEpisodes, true);
  assert.deepEqual(ab.aggregates, [], "no cross-exercise numeric aggregation");
  assert.deepEqual(ab.directionsObserved, ["replaced"]);
  assert.equal(ab.replacementExerciseId, B);
  assert.deepEqual(ab.replacementSummary.relationTypesObserved, [
    "variation_of:candidate_to_source",
  ]);
  assert.equal(ab.replacementSummary.postExposureTotal, 2);
  assert.ok(
    ab.episodes.items.every(
      (episode) =>
        episode.observations.length === 0 && episode.crossExercisePair,
    ),
  );
  assert.equal(
    deriveChangeDirection(
      { dimension: "exercise_replacement", exerciseId: A, exerciseName: null },
      { dimension: "exercise_replacement", exerciseId: B, exerciseName: null },
    ),
    "replaced",
  );
  const serialized = JSON.stringify(memory);
  assert.doesNotMatch(
    serialized,
    /best exercise|bestExercise|effectiveness|superior|ranking|score/i,
  );
  assert.deepEqual(
    buildIndividualResponseMemory([...evaluations].reverse(), {
      athleteId: ATHLETE,
      generatedAt: "2026-09-30T00:00:00.000Z",
    }),
    memory,
  );
  const bounded = buildIndividualResponseMemory(evaluations, {
    athleteId: ATHLETE,
    generatedAt: "2026-09-30T00:00:00.000Z",
    groupLimit: 2,
    episodeDetailLimit: 1,
  });
  assert.deepEqual(
    [bounded.groups.included, bounded.groups.hasMore],
    [2, true],
  );
});

test("a user edit back to the original exercise is not a replacement episode", () => {
  const result = outcome(A);
  assert.deepEqual(
    buildIndividualResponseEvidence([result]).filter(
      (group) => group.interventionDimension === "exercise_replacement",
    ),
    [],
  );
});

// DOSSIER V5 ----------------------------------------------------------------

test("dossier v5 carries bounded candidates, compact pairs and no cross deltas", () => {
  const evaluations = [outcome()];
  const dossier = buildAthleteTrainingDossier({
    snapshot: {
      athlete: { id: ATHLETE, userId: "u", onboardingCompletedAt: null },
      profile: null,
      activeGoal: null,
      trainingContext: null,
      availableWeekdays: [],
      latestWeight: null,
    },
    activeProgram: null,
    sessions: [],
    generatedAt: "2026-09-30T00:00:00.000Z",
    interventionHistory: buildInterventionHistory(evaluations),
    responseMemory: buildIndividualResponseMemory(evaluations, {
      athleteId: ATHLETE,
      generatedAt: "2026-09-30T00:00:00.000Z",
    }),
    exerciseReplacementCandidates: buildExerciseReplacementContext(
      [A],
      edges,
      catalog,
    ),
  });
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v6");
  assert.equal(dossier.exerciseReplacementCandidates.items.length, 1);
  assert.equal(
    dossier.exerciseReplacementCandidates.items[0].candidates.length,
    2,
    "not the whole catalog",
  );
  const [pair] = dossier.interventionHistory.items[0].crossExercisePairs;
  assert.equal("baseline" in pair, false);
  assert.deepEqual(pair.nonComparableMetrics, [
    "best_logged_load_kg",
    "best_estimated_one_rep_max_kg",
  ]);
  const ids = collectDossierEvidenceIds(dossier);
  assert.ok(ids.has(`exercise:${B}`));
  assert.doesNotMatch(
    JSON.stringify(dossier.interventionHistory),
    /"absoluteDelta":[^n]/,
  );
});
