import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  BuildInterventionContext,
  BuildInterventionHistory,
  GetCoachDecisionOutcome,
  GetIndividualResponseEvidence,
  ListInterventionOutcomes,
} from "../src/index.ts";
import {
  ATHLETE,
  EXERCISE,
  setTarget,
  program,
  decision,
  session,
  harness,
  A,
  B,
  baseline,
} from "./fixtures/outcome-fixtures.mjs";

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
    new BuildInterventionContext(outcomes),
  ).execute();
  assert.equal(withHistory.schemaVersion, "athlete-training-dossier-v8");
  assert.equal(withHistory.responseMemory.totalEpisodes, 0);
  assert.equal(without.responseMemory, null);
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
