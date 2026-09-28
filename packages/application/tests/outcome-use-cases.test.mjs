import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  BuildInterventionHistory,
  BuildInterventionOutcomes,
  GetCoachDecisionOutcome,
  GetIndividualResponseEvidence,
  ListInterventionOutcomes,
} from "../src/index.ts";

const ATHLETE = "athlete-1";
const EXERCISE = "exercise-bench";
const setTarget = (id, min, max) => ({
  id,
  sequence: 1,
  targetMetric: "reps",
  targetMin: min,
  targetMax: max,
  rirMin: null,
  rirMax: null,
  restMinSeconds: null,
  restMaxSeconds: null,
  tempo: null,
  loadKind: "athlete_selected",
  loadKg: null,
});
function program(id, change = {}) {
  const { sets = [setTarget(`${id}-set`, 8, 10)], ...rest } = change;
  return {
    id,
    athleteId: ATHLETE,
    athleteGoalId: null,
    name: id,
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    activatedAt: "2026-08-01T00:00:00.000Z",
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
                id: `${id}-day`,
                sequence: 1,
                name: "D",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: `${id}-p`,
                    exerciseId: EXERCISE,
                    exerciseName: "Supino",
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
function decision(id, sourceId, materializedId, change = {}) {
  return {
    id,
    athleteId: ATHLETE,
    status: materializedId ? "materialized" : "proposed",
    proposal: {
      schemaVersion: "coach-proposal-v1",
      id: `proposal-${id}`,
      analysisId: "analysis",
      sourceProgramId: sourceId,
      sourceProgramRevision: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
      summary: `Proposta ${id}`,
      rationale: "Fixture",
      evidenceReferences: [
        { kind: "training_program", id: sourceId, version: "1" },
      ],
      actions: [
        {
          kind: "adjust_prescription_target",
          trainingDayId: `${sourceId}-day`,
          exercisePrescriptionId: `${sourceId}-p`,
          prescriptionSetId: `${sourceId}-set`,
          targetMetric: "reps",
          targetMin: 6,
          targetMax: 8,
          rationale: "Fixture",
          evidence: [{ kind: "exercise", id: EXERCISE, version: null }],
        },
      ],
      limitations: [],
      requiresHumanApproval: true,
      analysisSnapshot: {
        summary: "S",
        provider: "fixture",
        model: "m",
        promptVersion: "coach-system-v1",
        policyVersion: "coach-safety-v1",
        dossierSchemaVersion: "athlete-training-dossier-v1",
      },
    },
    rejectionReason: null,
    rejectionNotes: null,
    proposedAt: "2026-09-01T00:00:00.000Z",
    approvedAt: materializedId ? "2026-09-01T01:00:00.000Z" : null,
    rejectedAt: null,
    staleAt: null,
    materializedAt: materializedId ? "2026-09-01T01:00:00.000Z" : null,
    materializedProgramId: materializedId,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...change,
  };
}
function session(
  id,
  startedAt,
  programId,
  setId,
  actualValue,
  athleteId = ATHLETE,
) {
  return {
    id,
    athleteId,
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
        exerciseId: EXERCISE,
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: [
          {
            id: `${id}-ws`,
            sourcePrescriptionSetId: setId,
            sequence: 1,
            status: "completed",
            plannedMetric: "reps",
            plannedTargetMin: 8,
            plannedTargetMax: 10,
            plannedRirMin: null,
            plannedRirMax: null,
            plannedRestMinSeconds: null,
            plannedRestMaxSeconds: null,
            plannedTempo: null,
            plannedLoadKind: "athlete_selected",
            plannedLoadKg: null,
            actualValue,
            actualLoadKg: 60,
            actualRir: null,
            performedAt: startedAt,
            restStartedAt: null,
            restEndedAt: null,
          },
        ],
      },
    ],
  };
}

function harness({ decisions, programs, sessions = [], weights = [] }) {
  const calls = [];
  const deps = {
    decisions: { list: async () => decisions },
    programs: {
      get: async (id) => {
        calls.push(id);
        return programs.find((item) => item.id === id) ?? null;
      },
    },
    performance: {
      listHistoricalSessions: async () => sessions,
      getHistoricalSession: async () => null,
    },
    weights: { list: async () => weights },
  };
  const outcomes = new BuildInterventionOutcomes(
    deps.decisions,
    deps.programs,
    deps.performance,
    deps.weights,
    () => new Date("2026-09-30T00:00:00.000Z"),
  );
  return { outcomes, calls };
}

const A = program("program-a", {
  status: "archived",
  archivedAt: "2026-09-10T00:00:00.000Z",
});
const B = program("program-b", {
  revision: 2,
  activatedAt: "2026-09-10T00:00:00.000Z",
  sets: [setTarget("program-b-set", 6, 8)],
});
const baseline = [
  session("pre-1", "2026-09-05T10:00:00.000Z", "program-a", "program-a-set", 9),
];

test("materialized decision with draft revision is awaiting activation", async () => {
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, { ...B, status: "draft", activatedAt: null }],
    sessions: baseline,
  });
  const [result] = await new ListInterventionOutcomes(outcomes).execute();
  assert.equal(result.status, "awaiting_activation");
});

test("activated outcome compares baseline and post exposures", async () => {
  const { outcomes, calls } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, B],
    sessions: [
      ...baseline,
      session(
        "post-1",
        "2026-09-11T10:00:00.000Z",
        "program-b",
        "program-b-set",
        7,
      ),
    ],
  });
  const result = await new GetCoachDecisionOutcome(outcomes).execute("d1");
  assert.equal(result.status, "evaluable");
  assert.equal(result.generatedAt, "2026-09-30T00:00:00.000Z");
  assert.deepEqual([...calls].sort(), ["program-a", "program-b"]);
  const reps = result.comparisons.find(
    (item) =>
      item.metric === "mean_actual_reps_per_set" &&
      item.scope.kind === "affected_prescription_sets",
  );
  assert.equal(reps.absoluteDelta, -2);
  assert.equal(
    await new GetCoachDecisionOutcome(outcomes).execute("missing"),
    null,
  );
});

test("manually edited draft shows the activated value, not the proposal", async () => {
  const edited = {
    ...B,
    blocks: program("program-b", { sets: [setTarget("program-b-set", 4, 6)] })
      .blocks,
  };
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, edited],
    sessions: baseline,
  });
  const [result] = await new ListInterventionOutcomes(outcomes).execute();
  assert.equal(
    result.interventionFidelity.actions[0].proposedValueImplemented,
    false,
  );
  assert.equal(result.episode.actions[0].implementedValue.min, 4);
  assert.equal(result.episode.actions[0].proposedValue.min, 6);
});

test("outcome after several workouts closes at the exposure window", async () => {
  const posts = [11, 12, 13, 14].map((day) =>
    session(
      `post-${day}`,
      `2026-09-${day}T10:00:00.000Z`,
      "program-b",
      "program-b-set",
      7,
    ),
  );
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, B],
    sessions: [...baseline, ...posts],
  });
  const [result] = await new ListInterventionOutcomes(outcomes).execute();
  assert.equal(result.postIntervention[0].exposures.length, 3);
  assert.equal(result.postIntervention[0].closeReason, "max_exposures_reached");
});

test("later revision and overlapping intervention keep separate episodes", async () => {
  const bArchived = {
    ...B,
    status: "archived",
    archivedAt: "2026-09-15T00:00:00.000Z",
  };
  const C = program("program-c", {
    revision: 3,
    activatedAt: "2026-09-15T00:00:00.000Z",
    sets: [setTarget("program-c-set", 5, 7)],
  });
  const second = decision("d2", "program-b", "program-c", {
    proposedAt: "2026-09-14T00:00:00.000Z",
    proposal: {
      ...decision("d2", "program-b", "program-c").proposal,
      sourceProgramRevision: 2,
      actions: [
        {
          ...decision("d2", "program-b", "program-c").proposal.actions[0],
          targetMin: 5,
          targetMax: 7,
        },
      ],
    },
  });
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b"), second],
    programs: [A, bArchived, C],
    sessions: [
      ...baseline,
      session(
        "post-b",
        "2026-09-11T10:00:00.000Z",
        "program-b",
        "program-b-set",
        7,
      ),
      session(
        "post-c",
        "2026-09-16T10:00:00.000Z",
        "program-c",
        "program-c-set",
        6,
      ),
    ],
  });
  const results = await new ListInterventionOutcomes(outcomes).execute();
  assert.deepEqual(
    results.map((item) => item.decisionId),
    ["d2", "d1"],
  );
  const [d2, d1] = results;
  assert.deepEqual(
    d1.postIntervention[0].exposures.map((item) => item.workoutSessionId),
    ["post-b"],
  );
  assert.equal(
    d1.postIntervention[0].closeReason,
    "intervention_program_ended",
  );
  assert.deepEqual(
    d2.baseline[0].exposures.map((item) => item.workoutSessionId),
    ["pre-1", "post-b"],
  );
  assert.ok(
    d2.limitations.some(
      (item) => item.code === "baseline_includes_prior_intervention",
    ),
  );
  const evidence = await new GetIndividualResponseEvidence(outcomes).execute();
  assert.equal(evidence[0].episodeCount, 2);
});

test("no cross-athlete leakage from sessions, programs or weights", async () => {
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, { ...B, athleteId: "intruder" }],
    sessions: [
      ...baseline,
      session(
        "x",
        "2026-09-11T10:00:00.000Z",
        "program-b",
        "program-b-set",
        7,
        "intruder",
      ),
    ],
    weights: [
      {
        athleteId: "intruder",
        id: "w",
        measuredAt: "2026-09-01T00:00:00.000Z",
        source: "manual",
        weightKg: 50,
      },
    ],
  });
  const [result] = await new ListInterventionOutcomes(outcomes).execute();
  assert.equal(result.status, "not_materialized");
  assert.equal(JSON.stringify(result).includes("intruder"), false);
});

test("proposals never materialized are not listed as interventions but appear in history", async () => {
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", null)],
    programs: [A],
  });
  assert.deepEqual(await new ListInterventionOutcomes(outcomes).execute(), []);
  const history = await new BuildInterventionHistory(outcomes).execute();
  assert.equal(history.items[0].outcomeStatus, "not_materialized");
});

test("bounded outcome history for the dossier", async () => {
  const decisions = Array.from({ length: 11 }, (_, index) =>
    decision(`d${String(index).padStart(2, "0")}`, "program-a", null, {
      proposedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }),
  );
  const { outcomes } = harness({ decisions, programs: [A] });
  const history = await new BuildInterventionHistory(outcomes).execute();
  assert.equal(history.totalAvailable, 11);
  assert.equal(history.included, 10);
  assert.equal(history.hasMore, true);
  assert.equal(history.items[0].decisionId, "d10");
});

test("dossier embeds intervention history only when a loader is composed", async () => {
  const deps = [
    {
      execute: async () => ({
        athlete: { id: ATHLETE, userId: "u", onboardingCompletedAt: null },
        profile: null,
        activeGoal: null,
        trainingContext: null,
        availableWeekdays: [],
        latestWeight: null,
      }),
    },
    { getActive: async () => null },
    { getInProgress: async () => null },
    { listHistoricalSessions: async () => [] },
    () => new Date("2026-09-30T00:00:00.000Z"),
  ];
  const without = await new BuildAthleteTrainingDossier(...deps).execute();
  assert.equal(without.interventionHistory, null);
  const { outcomes } = harness({ decisions: [], programs: [] });
  const withHistory = await new BuildAthleteTrainingDossier(
    ...deps,
    new BuildInterventionHistory(outcomes),
  ).execute();
  assert.equal(withHistory.schemaVersion, "athlete-training-dossier-v2");
  assert.deepEqual(
    {
      total: withHistory.interventionHistory.totalAvailable,
      hasMore: withHistory.interventionHistory.hasMore,
    },
    { total: 0, hasMore: false },
  );
});

test("rebuild is deterministic", async () => {
  const input = {
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, B],
    sessions: [
      ...baseline,
      session(
        "post-1",
        "2026-09-11T10:00:00.000Z",
        "program-b",
        "program-b-set",
        7,
      ),
    ],
  };
  const first = await new ListInterventionOutcomes(
    harness(input).outcomes,
  ).execute();
  const second = await new ListInterventionOutcomes(
    harness(input).outcomes,
  ).execute();
  assert.deepEqual(first, second);
});
