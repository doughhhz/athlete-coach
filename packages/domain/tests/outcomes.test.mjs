import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERVENTION_OUTCOME_SCHEMA_VERSION,
  OUTCOME_EXPOSURE_WINDOW,
  buildIndividualResponseEvidence,
  buildInterventionHistory,
  buildInterventionOutcome,
  buildAthleteTrainingDossier,
  collectDossierEvidenceIds,
  deriveBodyWeightContext,
  deriveObservedFacts,
} from "../src/index.ts";

const ATHLETE = "athlete-1";
const BENCH = "exercise-bench";
const ROW = "exercise-row";

function prescriptionSet(id, sequence, change = {}) {
  return {
    id,
    sequence,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 2,
    rirMax: 2,
    restMinSeconds: 90,
    restMaxSeconds: 120,
    tempo: null,
    loadKind: "athlete_selected",
    loadKg: null,
    ...change,
  };
}

/** Program with bench (2 sets) and row (1 set) on one day. */
function program(prefix, change = {}) {
  const {
    benchSets = [
      prescriptionSet(`${prefix}-s1`, 1),
      prescriptionSet(`${prefix}-s2`, 2),
    ],
    benchExerciseId = BENCH,
    rowSets = [prescriptionSet(`${prefix}-s3`, 1)],
    ...rest
  } = change;
  return {
    id: `program-${prefix}`,
    athleteId: ATHLETE,
    athleteGoalId: null,
    name: `Program ${prefix}`,
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    activatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    blocks: [
      {
        id: `${prefix}-block`,
        sequence: 1,
        name: "Bloco",
        description: null,
        weeks: [
          {
            id: `${prefix}-week`,
            sequence: 1,
            name: null,
            notes: null,
            days: [
              {
                id: `${prefix}-day`,
                sequence: 1,
                name: "A",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: `${prefix}-bench`,
                    exerciseId: benchExerciseId,
                    exerciseName:
                      benchExerciseId === BENCH ? "Supino" : "Crucifixo",
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets: benchSets,
                  },
                  {
                    id: `${prefix}-row`,
                    exerciseId: ROW,
                    exerciseName: "Remada",
                    sequence: 2,
                    instructions: null,
                    athleteCues: null,
                    sets: rowSets,
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

const sourceA = program("a", {
  status: "archived",
  archivedAt: "2026-09-10T00:00:00.000Z",
});
const ACTIVATED_AT = "2026-09-10T00:00:00.000Z";
function programB(change = {}) {
  return program("b", {
    revision: 2,
    supersedesProgramId: "program-a",
    activatedAt: ACTIVATED_AT,
    benchSets: [
      prescriptionSet("b-s1", 1, { targetMin: 6, targetMax: 8 }),
      prescriptionSet("b-s2", 2),
    ],
    ...change,
  });
}

function targetAction(change = {}) {
  return {
    kind: "adjust_prescription_target",
    trainingDayId: "a-day",
    exercisePrescriptionId: "a-bench",
    prescriptionSetId: "a-s1",
    targetMetric: "reps",
    targetMin: 6,
    targetMax: 8,
    rationale: "Faixa menor",
    evidence: [{ kind: "exercise", id: BENCH, version: null }],
    ...change,
  };
}

function decision(change = {}) {
  const { actions = [targetAction()], ...rest } = change;
  return {
    id: "decision-1",
    athleteId: ATHLETE,
    status: "materialized",
    proposal: {
      schemaVersion: "coach-proposal-v1",
      id: "proposal-1",
      analysisId: "analysis-1",
      sourceProgramId: "program-a",
      sourceProgramRevision: 1,
      createdAt: "2026-09-09T00:00:00.000Z",
      summary: "Ajustar faixa do supino",
      rationale: "Fixture",
      evidenceReferences: [
        { kind: "training_program", id: "program-a", version: "1" },
      ],
      actions,
      limitations: [],
      requiresHumanApproval: true,
      analysisSnapshot: {
        summary: "Resumo",
        provider: "fixture",
        model: "deterministic",
        promptVersion: "coach-system-v1",
        policyVersion: "coach-safety-v1",
        dossierSchemaVersion: "athlete-training-dossier-v1",
      },
    },
    rejectionReason: null,
    rejectionNotes: null,
    proposedAt: "2026-09-09T00:00:00.000Z",
    approvedAt: "2026-09-09T01:00:00.000Z",
    rejectedAt: null,
    staleAt: null,
    materializedAt: "2026-09-09T01:00:00.000Z",
    materializedProgramId: "program-b",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T01:00:00.000Z",
    ...rest,
  };
}

function workoutSet(id, sourcePrescriptionSetId, change = {}) {
  return {
    id,
    sourcePrescriptionSetId,
    sequence: 1,
    status: "completed",
    plannedMetric: "reps",
    plannedTargetMin: 8,
    plannedTargetMax: 10,
    plannedRirMin: 2,
    plannedRirMax: 2,
    plannedRestMinSeconds: 90,
    plannedRestMaxSeconds: 120,
    plannedTempo: null,
    plannedLoadKind: "athlete_selected",
    plannedLoadKg: null,
    actualValue: 9,
    actualLoadKg: 60,
    actualRir: 2,
    performedAt: "2026-09-02T10:00:00.000Z",
    restStartedAt: null,
    restEndedAt: null,
    ...change,
  };
}

/** A bench-only session with one set per prescription set given. */
function session(id, startedAt, programId, benchSets, change = {}) {
  return {
    id,
    athleteId: ATHLETE,
    sourceTrainingDayId: `${programId}-day`,
    sourceProgram: {
      id: `program-${programId}`,
      revision: programId === "a" ? 1 : 2,
      supersedesProgramId: null,
    },
    programName: `Program ${programId}`,
    dayName: "A",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      {
        id: `${id}-bench`,
        sourceExercisePrescriptionId: `${programId}-bench`,
        exerciseId: BENCH,
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: benchSets.map((set, index) => ({
          ...set,
          id: `${id}-set-${index}`,
          sequence: index + 1,
          performedAt: set.performedAt ?? startedAt,
        })),
      },
    ],
    ...change,
  };
}

const baselineSessions = [
  session("pre-1", "2026-09-02T10:00:00.000Z", "a", [
    workoutSet("", "a-s1", { actualValue: 8, actualLoadKg: 55 }),
  ]),
  session("pre-2", "2026-09-04T10:00:00.000Z", "a", [
    workoutSet("", "a-s1", { actualValue: 9, actualLoadKg: 60 }),
  ]),
  session("pre-3", "2026-09-06T10:00:00.000Z", "a", [
    workoutSet("", "a-s1", { actualValue: 10, actualLoadKg: 60 }),
    workoutSet("", "a-s2", { actualValue: 8, actualLoadKg: 60 }),
  ]),
  session("pre-4", "2026-09-08T10:00:00.000Z", "a", [
    workoutSet("", "a-s1", { actualValue: 9, actualLoadKg: 62.5 }),
  ]),
];
const plannedB = {
  plannedTargetMin: 6,
  plannedTargetMax: 8,
};
const postSessions = [
  session("post-1", "2026-09-11T10:00:00.000Z", "b", [
    workoutSet("", "b-s1", { ...plannedB, actualValue: 7, actualLoadKg: 65 }),
  ]),
  session("post-2", "2026-09-13T10:00:00.000Z", "b", [
    workoutSet("", "b-s1", { ...plannedB, actualValue: 8, actualLoadKg: 67.5 }),
  ]),
];

function build(change = {}) {
  return buildInterventionOutcome({
    decision: decision(),
    sourceProgram: sourceA,
    interventionProgram: programB(),
    sessions: [...baselineSessions, ...postSessions],
    bodyWeights: [],
    generatedAt: "2026-09-20T00:00:00.000Z",
    ...change,
  });
}
const codes = (evaluation) => evaluation.limitations.map((item) => item.code);
const comparison = (evaluation, metric, kind = "affected_prescription_sets") =>
  evaluation.comparisons.find(
    (item) => item.metric === metric && item.scope.kind === kind,
  );

// ACTIVATION ---------------------------------------------------------------

test("materialized draft not activated is awaiting_activation without windows", () => {
  const result = build({
    interventionProgram: programB({ status: "draft", activatedAt: null }),
  });
  assert.equal(result.schemaVersion, INTERVENTION_OUTCOME_SCHEMA_VERSION);
  assert.equal(result.status, "awaiting_activation");
  assert.equal(result.activatedAt, null);
  assert.deepEqual(result.comparisons, []);
  assert.deepEqual(result.baseline, []);
  assert.equal(
    result.interventionFidelity.implementedProgramState,
    "draft_not_activated",
  );
});

test("draft archived without activation was never an intervention", () => {
  const result = build({
    interventionProgram: programB({
      status: "archived",
      activatedAt: null,
      archivedAt: "2026-09-12T00:00:00.000Z",
    }),
  });
  assert.equal(result.status, "never_activated");
  assert.deepEqual(result.postIntervention, []);
});

test("decision that was not materialized produces no intervention", () => {
  const result = build({
    decision: decision({
      status: "rejected",
      materializedProgramId: null,
      materializedAt: null,
      approvedAt: null,
    }),
  });
  assert.equal(result.status, "not_materialized");
  assert.equal(result.interventionProgram, null);
});

test("activated program creates an episode with the exact activation timestamp", () => {
  const result = build();
  assert.equal(result.activatedAt, ACTIVATED_AT);
  assert.equal(result.episode.activatedAt, ACTIVATED_AT);
  assert.equal(result.episode.decisionId, "decision-1");
  assert.equal(result.episode.proposalSchemaVersion, "coach-proposal-v1");
  assert.deepEqual(result.episode.sourceProgram, {
    id: "program-a",
    revision: 1,
  });
  assert.equal(result.episode.interventionProgram.id, "program-b");
  assert.deepEqual(result.episode.affectedExerciseIds, [BENCH]);
  assert.deepEqual(result.episode.affectedDimensions, ["target"]);
  assert.equal(result.episode.provenance.provider, "fixture");
  assert.ok(
    result.evidenceReferences.some(
      (item) => item.kind === "coach_decision" && item.id === "decision-1",
    ),
  );
});

// FIDELITY -----------------------------------------------------------------

test("proposal equal to activated prescription has full factual fidelity", () => {
  const result = build();
  const [action] = result.episode.actions;
  assert.deepEqual(action.sourceValue, {
    dimension: "target",
    metric: "reps",
    min: 8,
    max: 10,
  });
  assert.deepEqual(action.proposedValue, action.materializedValue);
  assert.deepEqual(action.implementedValue, action.proposedValue);
  assert.equal(action.implementedPrescriptionSetId, "b-s1");
  assert.deepEqual(result.interventionFidelity.actions[0], {
    actionIndex: 0,
    locatedInImplementedProgram: true,
    exerciseIdentityPreserved: true,
    proposedValueImplemented: true,
    additionalChangesInAffectedPrescription: [],
  });
  assert.equal(
    result.interventionFidelity.unproposedChangedPrescriptionCount,
    0,
  );
  assert.doesNotMatch(
    codes(result).join(","),
    /multiple_variables|unproposed|differs/,
  );
});

test("user edit before activation (extra set) is captured, not hidden", () => {
  const result = build({
    interventionProgram: programB({
      benchSets: [
        prescriptionSet("b-s1", 1, { targetMin: 6, targetMax: 8 }),
        prescriptionSet("b-s2", 2),
        prescriptionSet("b-s2b", 3, { targetMin: 6, targetMax: 8 }),
      ],
    }),
  });
  const fidelity = result.interventionFidelity.actions[0];
  assert.equal(fidelity.proposedValueImplemented, true);
  assert.deepEqual(fidelity.additionalChangesInAffectedPrescription, [
    { setSequence: null, dimension: "set_count" },
  ]);
  assert.ok(
    codes(result).includes("unproposed_changes_in_affected_prescription"),
  );
  assert.ok(codes(result).includes("multiple_variables_changed_concurrently"));
});

test("activated value different from proposal is reported with the real value", () => {
  const result = build({
    interventionProgram: programB({
      benchSets: [
        prescriptionSet("b-s1", 1, { targetMin: 5, targetMax: 7 }),
        prescriptionSet("b-s2", 2),
      ],
    }),
  });
  assert.deepEqual(result.episode.actions[0].implementedValue, {
    dimension: "target",
    metric: "reps",
    min: 5,
    max: 7,
  });
  assert.equal(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    false,
  );
  assert.ok(codes(result).includes("proposed_value_differs_at_activation"));
});

test("proposal action missing because exercise was replaced before activation", () => {
  const result = build({
    interventionProgram: programB({ benchExerciseId: "exercise-fly" }),
  });
  const fidelity = result.interventionFidelity.actions[0];
  assert.equal(fidelity.locatedInImplementedProgram, false);
  assert.equal(fidelity.exerciseIdentityPreserved, false);
  assert.equal(result.episode.actions[0].implementedValue, null);
  assert.ok(
    codes(result).includes("proposed_action_not_present_at_activation"),
  );
  assert.ok(codes(result).includes("exercise_identity_changed"));
});

test("unrelated manual edits elsewhere in the revision are counted", () => {
  const result = build({
    interventionProgram: programB({
      rowSets: [
        prescriptionSet("b-s3", 1, { restMinSeconds: 30, restMaxSeconds: 45 }),
      ],
    }),
  });
  assert.equal(
    result.interventionFidelity.unproposedChangedPrescriptionCount,
    1,
  );
  assert.ok(
    codes(result).includes("program_revision_changed_other_prescriptions"),
  );
});

test("multiple changed dimensions are flagged as concurrent", () => {
  const actions = [
    targetAction(),
    {
      kind: "adjust_prescription_rir",
      trainingDayId: "a-day",
      exercisePrescriptionId: "a-bench",
      prescriptionSetId: "a-s2",
      rirMin: 1,
      rirMax: 1,
      rationale: "RIR",
      evidence: [{ kind: "exercise", id: BENCH, version: null }],
    },
  ];
  const result = build({
    decision: decision({ actions }),
    interventionProgram: programB({
      benchSets: [
        prescriptionSet("b-s1", 1, { targetMin: 6, targetMax: 8 }),
        prescriptionSet("b-s2", 2, { rirMin: 1, rirMax: 1 }),
      ],
    }),
  });
  assert.equal(result.episode.concurrentActionCount, 2);
  assert.deepEqual(result.episode.affectedDimensions, [
    "target",
    "planned_rir",
  ]);
  assert.ok(codes(result).includes("multiple_variables_changed_concurrently"));
  assert.ok(
    result.interventionFidelity.actions.every(
      (item) => item.proposedValueImplemented,
    ),
  );
});

// WINDOWS ------------------------------------------------------------------

test("baseline keeps the latest bounded exposures before activation", () => {
  const result = build();
  assert.equal(OUTCOME_EXPOSURE_WINDOW, 3);
  assert.deepEqual(
    result.baseline[0].exposures.map((item) => item.workoutSessionId),
    ["pre-2", "pre-3", "pre-4"],
  );
});

test("post window keeps earliest bounded exposures from the intervention program", () => {
  const extra = [3, 4, 5].map((day) =>
    session(`post-${day}`, `2026-09-1${day + 2}T10:00:00.000Z`, "b", [
      workoutSet("", "b-s1", { ...plannedB, actualValue: 7 }),
    ]),
  );
  const result = build({
    sessions: [...baselineSessions, ...postSessions, ...extra],
  });
  assert.deepEqual(
    result.postIntervention[0].exposures.map((item) => item.workoutSessionId),
    ["post-1", "post-2", "post-3"],
  );
  assert.equal(result.postIntervention[0].closed, true);
  assert.equal(result.postIntervention[0].closeReason, "max_exposures_reached");
});

test("later program revision stops the post window deterministically", () => {
  const later = session("program-c", "2026-09-15T10:00:00.000Z", "c", [
    workoutSet("", "c-s1", { actualValue: 9 }),
  ]);
  const result = build({
    interventionProgram: programB({
      status: "archived",
      archivedAt: "2026-09-14T00:00:00.000Z",
    }),
    sessions: [...baselineSessions, ...postSessions, later],
  });
  assert.deepEqual(
    result.postIntervention[0].exposures.map((item) => item.workoutSessionId),
    ["post-1", "post-2"],
  );
  assert.equal(
    result.postIntervention[0].closeReason,
    "intervention_program_ended",
  );
  assert.ok(
    codes(result).includes("intervention_program_ended_before_window_filled"),
  );
});

test("no prior exposure yields limited data with explicit limitation", () => {
  const result = build({ sessions: postSessions });
  assert.equal(result.status, "limited_data");
  assert.equal(result.dataCoverage.exercises[0].comparable, false);
  assert.ok(codes(result).includes("no_baseline_exposures"));
  assert.deepEqual(result.comparisons, []);
});

test("no post exposure yet is awaiting_post_exposure", () => {
  const result = build({ sessions: baselineSessions });
  assert.equal(result.status, "awaiting_post_exposure");
  assert.ok(codes(result).includes("no_post_exposures"));
  assert.ok(codes(result).includes("post_window_open"));
});

test("abandoned session completed sets are eligible; skipped and pending are not exposures", () => {
  const abandoned = session(
    "post-abandoned",
    "2026-09-11T10:00:00.000Z",
    "b",
    [workoutSet("", "b-s1", { ...plannedB, actualValue: 6 })],
    {
      status: "abandoned",
      completedAt: null,
      abandonedAt: "2026-09-11T11:00:00.000Z",
    },
  );
  const skippedOnly = session("post-skipped", "2026-09-12T10:00:00.000Z", "b", [
    workoutSet("", "b-s1", {
      ...plannedB,
      status: "skipped",
      actualValue: null,
      actualLoadKg: null,
      actualRir: null,
    }),
  ]);
  const pendingOnly = session(
    "post-pending",
    "2026-09-12T12:00:00.000Z",
    "b",
    [
      workoutSet("", "b-s1", {
        ...plannedB,
        status: "pending",
        actualValue: null,
        actualLoadKg: null,
        actualRir: null,
        performedAt: null,
      }),
    ],
    {
      status: "abandoned",
      completedAt: null,
      abandonedAt: "2026-09-12T13:00:00.000Z",
    },
  );
  const result = build({
    sessions: [...baselineSessions, abandoned, skippedOnly, pendingOnly],
  });
  const exposures = result.postIntervention[0].exposures;
  assert.deepEqual(
    exposures.map((item) => item.workoutSessionId),
    ["post-abandoned"],
  );
  assert.equal(exposures[0].sessionStatus, "abandoned");
});

test("in-progress sessions are never used as exposures", () => {
  const inProgress = session(
    "post-live",
    "2026-09-11T10:00:00.000Z",
    "b",
    [workoutSet("", "b-s1", { ...plannedB, actualValue: 7 })],
    { status: "in_progress", completedAt: null },
  );
  const result = build({ sessions: [...baselineSessions, inProgress] });
  assert.equal(result.status, "awaiting_post_exposure");
});

// COMPARISON ---------------------------------------------------------------

test("positive, negative and zero deltas with explicit sample counts", () => {
  const result = build();
  const load = comparison(result, "best_logged_load_kg");
  assert.equal(load.before, 62.5);
  assert.equal(load.after, 67.5);
  assert.equal(load.absoluteDelta, 5);
  assert.equal(load.relativeDelta, 5 / 62.5);
  assert.equal(load.beforeSampleCount, 3);
  assert.equal(load.afterSampleCount, 2);
  const reps = comparison(result, "mean_actual_reps_per_set");
  assert.equal(reps.before, 28 / 3);
  assert.equal(reps.after, 7.5);
  assert.ok(reps.absoluteDelta < 0);
  const rir = comparison(result, "mean_actual_rir");
  assert.equal(rir.absoluteDelta, 0);
  assert.equal(rir.relativeDelta, 0);
  assert.deepEqual(load.relevantDimensions, ["target"]);
  assert.ok(load.evidence.some((item) => item.id === "pre-4"));
  assert.ok(load.evidence.some((item) => item.id === "post-2"));
});

test("missing previous value and zero denominator do not fabricate deltas", () => {
  const noLoad = baselineSessions.map((item) => ({
    ...item,
    exercises: item.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        actualLoadKg: null,
        actualRir: 0,
      })),
    })),
  }));
  const result = build({ sessions: [...noLoad, ...postSessions] });
  const load = comparison(result, "best_logged_load_kg");
  assert.equal(load.before, null);
  assert.equal(load.absoluteDelta, null);
  assert.equal(load.relativeDelta, null);
  assert.equal(load.beforeSampleCount, 0);
  const rir = comparison(result, "mean_actual_rir");
  assert.equal(rir.before, 0);
  assert.equal(rir.absoluteDelta, 2);
  assert.equal(rir.relativeDelta, null);
});

test("e1RM is compared only inside the same canonical exercise", () => {
  const result = build();
  assert.ok(
    result.comparisons.every((item) => item.scope.exerciseId === BENCH),
  );
  const e1rm = comparison(result, "best_estimated_one_rep_max_kg", "exercise");
  assert.equal(e1rm.after, 67.5 * (1 + 8 / 30));
});

test("unequal exposure counts are declared", () => {
  assert.ok(codes(build()).includes("unequal_exposure_counts"));
});

test("RIR and rest missing observations limit evidence explicitly", () => {
  const actions = [
    {
      kind: "adjust_prescription_rest",
      trainingDayId: "a-day",
      exercisePrescriptionId: "a-bench",
      prescriptionSetId: "a-s1",
      restMinSeconds: 60,
      restMaxSeconds: 90,
      rationale: "Descanso",
      evidence: [{ kind: "exercise", id: BENCH, version: null }],
    },
  ];
  const result = build({
    decision: decision({ actions }),
    interventionProgram: programB({
      benchSets: [
        prescriptionSet("b-s1", 1, { restMinSeconds: 60, restMaxSeconds: 90 }),
        prescriptionSet("b-s2", 2),
      ],
    }),
  });
  assert.ok(codes(result).includes("rest_observations_missing"));
  assert.equal(comparison(result, "rest_coverage_rate").before, 0);
});

test("observed facts keep reps, seconds and meters separate and count planned values", () => {
  const facts = deriveObservedFacts([
    workoutSet("1", "x", { actualValue: 10 }),
    workoutSet("2", "x", {
      plannedMetric: "seconds",
      actualValue: 30,
      actualLoadKg: null,
    }),
    workoutSet("3", "x", { status: "skipped", actualValue: null }),
    workoutSet("4", "x", {
      actualRir: null,
      restStartedAt: "2026-09-01T10:00:00.000Z",
      restEndedAt: "2026-09-01T10:02:00.000Z",
    }),
  ]);
  assert.equal(facts.completedSetCount, 3);
  assert.equal(facts.skippedSetCount, 1);
  assert.equal(facts.actualReps.total, 19);
  assert.equal(facts.actualSeconds.total, 30);
  assert.equal(facts.actualMeters.sampleCount, 0);
  assert.equal(facts.rir.measuredSetCount, 2);
  assert.equal(facts.rest.measuredSetCount, 1);
  assert.equal(facts.rest.within, 1);
  assert.equal(facts.rest.measuredRestSeconds.mean, 120);
  assert.ok(facts.plannedValues.length >= 4);
});

// BODY WEIGHT --------------------------------------------------------------

test("body weight context is factual delta only", () => {
  const entries = [
    {
      athleteId: ATHLETE,
      id: "w1",
      measuredAt: "2026-09-09T08:00:00.000Z",
      source: "manual",
      weightKg: 80,
    },
    {
      athleteId: ATHLETE,
      id: "w2",
      measuredAt: "2026-09-12T08:00:00.000Z",
      source: "manual",
      weightKg: 81.5,
    },
    {
      athleteId: "other",
      id: "w3",
      measuredAt: "2026-09-12T09:00:00.000Z",
      source: "manual",
      weightKg: 50,
    },
  ];
  const result = build({ bodyWeights: entries });
  assert.equal(result.bodyWeightContext.atActivation.entryId, "w1");
  assert.equal(result.bodyWeightContext.latestInPostWindow.entryId, "w2");
  assert.equal(result.bodyWeightContext.absoluteDeltaKg, 1.5);
  assert.ok(codes(result).includes("body_weight_changed"));
  assert.ok(codes(build()).includes("body_weight_unavailable"));
  assert.deepEqual(deriveBodyWeightContext(entries, null, null), {
    atActivation: null,
    latestInPostWindow: null,
    absoluteDeltaKg: null,
  });
});

// ELIGIBILITY / SAFETY OF LANGUAGE -----------------------------------------

test("evaluable means computable for every affected exercise", () => {
  assert.equal(build().status, "evaluable");
});

test("outcome contract carries no causal or success labels", () => {
  const serialized = JSON.stringify(build());
  assert.doesNotMatch(
    serialized,
    /improved|worsened|success|failure|effective|worked|did_not_work|score/i,
  );
  assert.match(serialized, /evidence, not proof of causation/);
});

test("other athletes' sessions and programs are ignored", () => {
  const foreign = {
    ...postSessions[0],
    id: "foreign",
    athleteId: "athlete-2",
    startedAt: "2026-09-12T10:00:00.000Z",
  };
  const result = build({ sessions: [...baselineSessions, foreign] });
  assert.equal(result.status, "awaiting_post_exposure");
  const foreignProgram = build({
    interventionProgram: { ...programB(), athleteId: "athlete-2" },
  });
  assert.equal(foreignProgram.status, "not_materialized");
});

// DETERMINISM ---------------------------------------------------------------

test("repeat build is semantically identical regardless of input order", () => {
  const a = build();
  const b = build({
    sessions: [...postSessions, ...baselineSessions].reverse(),
  });
  assert.deepEqual(a, b);
});

// INDIVIDUAL RESPONSE + HISTORY --------------------------------------------

test("individual response groups comparable episodes without averaging", () => {
  const first = build();
  const second = buildInterventionOutcome({
    decision: decision({
      id: "decision-2",
      proposedAt: "2026-09-16T00:00:00.000Z",
      materializedProgramId: "program-c",
    }),
    sourceProgram: sourceA,
    interventionProgram: programB({
      id: "program-c",
      activatedAt: "2026-09-17T00:00:00.000Z",
    }),
    sessions: [...baselineSessions, ...postSessions],
    bodyWeights: [],
    interventionProgramIds: new Set(["program-b", "program-c"]),
    generatedAt: "2026-09-20T00:00:00.000Z",
  });
  const evidence = buildIndividualResponseEvidence([second, first]);
  assert.equal(evidence.length, 1);
  const [group] = evidence;
  assert.equal(group.exerciseId, BENCH);
  assert.equal(group.interventionDimension, "target");
  assert.equal(group.episodeCount, 2);
  assert.deepEqual(
    group.episodes.map((episode) => episode.decisionId),
    ["decision-1", "decision-2"],
  );
  assert.equal(group.observationCount, 1);
  assert.match(group.notice, /accumulated evidence/);
  assert.doesNotMatch(JSON.stringify(group), /average|best_volume|optimal/i);
  // Overlapping episodes stay separate, with their own windows.
  assert.notDeepEqual(group.episodes[0].postExposureCount, undefined);
  assert.ok(
    second.limitations.some(
      (item) => item.code === "baseline_includes_prior_intervention",
    ),
  );
});

test("intervention history is bounded, ordered and exposes truncation", () => {
  const evaluations = Array.from({ length: 12 }, (_, index) =>
    build({
      decision: decision({
        id: `decision-${String(index).padStart(2, "0")}`,
        proposedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    }),
  );
  const history = buildInterventionHistory(evaluations);
  assert.equal(history.totalAvailable, 12);
  assert.equal(history.included, 10);
  assert.equal(history.hasMore, true);
  assert.equal(history.items[0].decisionId, "decision-11");
  assert.equal(history.items[9].decisionId, "decision-02");
  assert.ok(
    history.items[0].comparisons.every((item) => !("evidence" in item)),
  );
  assert.equal(history.items[0].changes[0].proposedValueImplemented, true);
});

test("dossier v3 embeds bounded history and exposes its evidence for grounding", () => {
  const history = buildInterventionHistory([build()]);
  const dossier = buildAthleteTrainingDossier({
    snapshot: {
      athlete: { id: ATHLETE, userId: "user", onboardingCompletedAt: null },
      profile: null,
      activeGoal: null,
      trainingContext: null,
      availableWeekdays: [],
      latestWeight: null,
    },
    activeProgram: null,
    sessions: [],
    generatedAt: "2026-09-20T00:00:00.000Z",
    interventionHistory: history,
  });
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v6");
  assert.equal(dossier.interventionHistory.included, 1);
  const ids = collectDossierEvidenceIds(dossier);
  assert.ok(ids.has("coach_decision:decision-1"));
  assert.ok(ids.has("workout_session:post-1"));
});

// SET COUNT (Phase 13) ------------------------------------------------------

const addSetAction = (change = {}) => ({
  kind: "add_prescription_set",
  trainingDayId: "a-day",
  exercisePrescriptionId: "a-bench",
  position: "end",
  copyFromPrescriptionSetId: "a-s2",
  plannedSet: {
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 2,
    rirMax: 2,
    restMinSeconds: 90,
    restMaxSeconds: 120,
    tempo: null,
    loadKind: "athlete_selected",
    loadKg: null,
  },
  rationale: "Uma série a mais",
  evidence: [{ kind: "exercise", id: BENCH, version: null }],
  ...change,
});
const setCountDecision = (actions) => {
  const base = decision({ actions });
  return {
    ...base,
    proposal: { ...base.proposal, schemaVersion: "coach-proposal-v2" },
  };
};
const threeSetB = (extra = []) =>
  programB({
    benchSets: [
      prescriptionSet("b-s1", 1),
      prescriptionSet("b-s2", 2),
      prescriptionSet("b-s3", 3),
      ...extra,
    ],
  });
const postSetSessions = [
  session("sc-post-1", "2026-09-11T10:00:00.000Z", "b", [
    workoutSet("", "b-s1", { actualValue: 9 }),
    workoutSet("", "b-s2", { actualValue: 9 }),
    workoutSet("", "b-s3", {
      status: "skipped",
      actualValue: null,
      actualLoadKg: null,
      actualRir: null,
    }),
  ]),
  session("sc-post-2", "2026-09-13T10:00:00.000Z", "b", [
    workoutSet("", "b-s1", { actualValue: 8 }),
    workoutSet("", "b-s2", { actualValue: 8 }),
    workoutSet("", "b-s3", { actualValue: 7 }),
  ]),
];
const buildSetCount = (
  actions,
  interventionProgram,
  sessions = postSetSessions,
) =>
  build({
    decision: setCountDecision(actions),
    interventionProgram,
    sessions: [...baselineSessions, ...sessions],
  });
const setCountSnapshot = (result) =>
  result.episode.actions.find((action) => action.dimension === "set_count");

test("set count 2 → 3 activated is a single-variable set_count snapshot", () => {
  const result = buildSetCount([addSetAction()], threeSetB());
  const snapshot = setCountSnapshot(result);
  assert.equal(result.schemaVersion, "intervention-outcome-v3");
  assert.equal(snapshot.kind, "set_count_change");
  assert.deepEqual(snapshot.sourceValue, { dimension: "set_count", count: 2 });
  assert.deepEqual(snapshot.proposedValue, {
    dimension: "set_count",
    count: 3,
  });
  assert.deepEqual(snapshot.implementedValue, {
    dimension: "set_count",
    count: 3,
  });
  assert.equal(snapshot.setCountChange.addedSets.length, 1);
  assert.deepEqual(snapshot.sourceScopeSetIds, ["a-s1", "a-s2"]);
  assert.deepEqual(snapshot.implementedScopeSetIds, ["b-s1", "b-s2", "b-s3"]);
  assert.equal(result.episode.concurrentActionCount, 1);
  assert.deepEqual(result.episode.affectedDimensions, ["set_count"]);
  assert.equal(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    true,
  );
  assert.deepEqual(
    result.interventionFidelity.actions[0]
      .additionalChangesInAffectedPrescription,
    [],
  );
  assert.doesNotMatch(codes(result).join(","), /multiple_variables|unproposed/);
});

test("proposal 2 → 3 but the athlete activates 4: the activated count is the intervention", () => {
  const result = buildSetCount(
    [addSetAction()],
    threeSetB([prescriptionSet("b-s4", 4)]),
  );
  const snapshot = setCountSnapshot(result);
  assert.equal(snapshot.proposedValue.count, 3);
  assert.equal(snapshot.materializedValue.count, 3);
  assert.equal(snapshot.implementedValue.count, 4);
  assert.equal(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    false,
  );
  assert.ok(
    result.interventionFidelity.actions[0].additionalChangesInAffectedPrescription.some(
      (item) => item.dimension === "set_count",
    ),
  );
  assert.ok(codes(result).includes("proposed_value_differs_at_activation"));
});

test("planned sets and completed sets stay distinct per exposure", () => {
  const result = buildSetCount([addSetAction()], threeSetB());
  const post = result.postIntervention[0].affectedPrescriptionSets;
  assert.equal(post.plannedSetCount, 6);
  assert.equal(post.completedSetCount, 5);
  assert.equal(post.skippedSetCount, 1);
  const planned = comparison(result, "planned_sets_per_exposure");
  const completed = comparison(result, "completed_sets_per_exposure");
  assert.equal(planned.after, 3);
  assert.equal(completed.after, 2.5);
  assert.deepEqual(planned.relevantDimensions, ["set_count"]);
  assert.ok(comparison(result, "actual_reps_per_exposure"));
  assert.ok(comparison(result, "best_estimated_one_rep_max_kg", "exercise"));
  assert.equal(
    comparison(result, "best_logged_load_kg").relevantDimensions.includes(
      "set_count",
    ),
    true,
  );
});

test("set count plus another dimension is concurrent (confounded)", () => {
  const result = buildSetCount(
    [
      addSetAction(),
      {
        kind: "adjust_prescription_rir",
        trainingDayId: "a-day",
        exercisePrescriptionId: "a-bench",
        prescriptionSetId: "a-s1",
        rirMin: 1,
        rirMax: 1,
        rationale: "RIR",
        evidence: [{ kind: "exercise", id: BENCH, version: null }],
      },
    ],
    programB({
      benchSets: [
        prescriptionSet("b-s1", 1, { rirMin: 1, rirMax: 1 }),
        prescriptionSet("b-s2", 2),
        prescriptionSet("b-s3", 3),
      ],
    }),
  );
  assert.deepEqual(result.episode.affectedDimensions, [
    "planned_rir",
    "set_count",
  ]);
  assert.ok(codes(result).includes("multiple_variables_changed_concurrently"));
  assert.ok(
    result.interventionFidelity.actions.every(
      (item) => item.proposedValueImplemented,
    ),
  );
});

test("remove + add keeping the count is a structural edit, not a set-count intervention", () => {
  const result = buildSetCount(
    [
      {
        kind: "remove_prescription_set",
        trainingDayId: "a-day",
        exercisePrescriptionId: "a-bench",
        prescriptionSetId: "a-s2",
        rationale: "r",
        evidence: [{ kind: "exercise", id: BENCH, version: null }],
      },
      addSetAction({ copyFromPrescriptionSetId: null }),
    ],
    programB({
      benchSets: [
        prescriptionSet("b-s1", 1),
        prescriptionSet("b-s2", 2, { restMinSeconds: 90, restMaxSeconds: 120 }),
      ],
    }),
  );
  const snapshot = setCountSnapshot(result);
  assert.equal(snapshot.sourceValue.count, snapshot.implementedValue.count);
  assert.ok(
    codes(result).includes("set_structure_changed_without_count_change"),
  );
  assert.deepEqual(buildIndividualResponseEvidence([result]), []);
});

test("set-count outcomes carry no muscle-volume or optimal fields", () => {
  const serialized = JSON.stringify(
    buildSetCount([addSetAction()], threeSetB()),
  );
  assert.doesNotMatch(
    serialized,
    /muscle|effective|hardSet|stimul|tonnage|workload|volumeLoad|optimal|improved|success/i,
  );
  assert.doesNotMatch(serialized, /(MEV|MAV|MRV)/);
});

test("changed-set per-exposure counts divide only by exposures containing those sets", () => {
  const otherProgram = session("other-pre", "2026-09-09T10:00:00.000Z", "z", [
    workoutSet("", "z-s1", { actualValue: 9 }),
  ]);
  const result = build({
    decision: setCountDecision([addSetAction()]),
    interventionProgram: threeSetB(),
    sessions: [...baselineSessions, otherProgram, ...postSetSessions],
  });
  const baselineScope = result.baseline[0].affectedPrescriptionSets;
  assert.equal(result.baseline[0].exposures.length, 3);
  assert.equal(baselineScope.exposureCount, 2);
  assert.equal(comparison(result, "planned_sets_per_exposure").before, 3 / 2);
  assert.equal(
    comparison(result, "planned_sets_per_exposure", "exercise").before,
    4 / 3,
  );
  assert.ok(codes(result).includes("baseline_includes_other_programs"));
});
