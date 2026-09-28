import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  BuildIndividualResponseMemory,
  BuildInterventionContext,
  BuildInterventionOutcomes,
  GetResponseMemoryGroup,
} from "../src/index.ts";
import {
  ATHLETE,
  EXERCISE,
  A,
  B,
  baseline,
  decision,
  harness,
  program,
  session,
  setTarget,
} from "./fixtures/outcome-fixtures.mjs";

const ROW = "exercise-row";
const GROUP = `${EXERCISE}.target.reps`;
const post = (id, day, programId, value, exerciseId = EXERCISE) =>
  session(
    id,
    `2026-09-${String(day).padStart(2, "0")}T10:00:00.000Z`,
    programId,
    `${programId}-set`,
    value,
    ATHLETE,
    exerciseId,
  );
const withActions = (base, actions) => ({
  ...base,
  proposal: {
    ...base.proposal,
    actions: actions.map((change) => ({
      ...base.proposal.actions[0],
      ...change,
    })),
  },
});

test("new athlete has an empty, versioned memory", async () => {
  const { outcomes } = harness({ decisions: [], programs: [] });
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  assert.equal(memory.schemaVersion, "individual-response-memory-v2");
  assert.equal(memory.athleteId, null);
  assert.equal(memory.totalEpisodes, 0);
  assert.equal(memory.groups.hasMore, false);
});

test("one activated intervention forms one strict-comparable episode with lineage", async () => {
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, B],
    sessions: [...baseline, post("post-1", 11, "program-b", 7)],
  });
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  assert.equal(memory.athleteId, ATHLETE);
  const [group] = memory.groups.items;
  assert.equal(group.key, GROUP);
  const [episode] = group.episodes.items;
  assert.equal(episode.comparability.classification, "strict_comparable");
  assert.deepEqual(episode.sourceProgram, { id: "program-a", revision: 1 });
  assert.deepEqual(episode.interventionProgram, {
    id: "program-b",
    revision: 2,
  });
  assert.equal(episode.signature.direction, "decrease");
  assert.equal(group.hasMultipleComparableEpisodes, false);
});

test("repeated interventions, overlapping lineage and a confounded episode stay separate but grouped", async () => {
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
  const second = withActions(
    decision("d2", "program-b", "program-c", {
      proposedAt: "2026-09-14T00:00:00.000Z",
    }),
    [
      {
        trainingDayId: "program-b-day",
        exercisePrescriptionId: "program-b-p",
        prescriptionSetId: "program-b-set",
        targetMin: 5,
        targetMax: 7,
      },
    ],
  );
  second.proposal.sourceProgramRevision = 2;
  const cArchived = {
    ...C,
    status: "archived",
    archivedAt: "2026-09-20T00:00:00.000Z",
  };
  const D = program("program-d", {
    revision: 4,
    activatedAt: "2026-09-20T00:00:00.000Z",
    sets: [{ ...setTarget("program-d-set", 4, 6), rirMin: 1, rirMax: 1 }],
  });
  // Target and planned RIR changed together: concurrent variables.
  const third = withActions(
    decision("d3", "program-c", "program-d", {
      proposedAt: "2026-09-19T00:00:00.000Z",
    }),
    [
      {
        trainingDayId: "program-c-day",
        exercisePrescriptionId: "program-c-p",
        prescriptionSetId: "program-c-set",
        targetMin: 4,
        targetMax: 6,
      },
      {
        kind: "adjust_prescription_rir",
        trainingDayId: "program-c-day",
        exercisePrescriptionId: "program-c-p",
        prescriptionSetId: "program-c-set",
        rirMin: 1,
        rirMax: 1,
      },
    ],
  );
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b"), second, third],
    programs: [A, bArchived, cArchived, D],
    sessions: [
      ...baseline,
      post("post-b", 11, "program-b", 7),
      post("post-c", 16, "program-c", 8),
      post("post-d", 21, "program-d", 5),
    ],
  });
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  const group = memory.groups.items.find((item) => item.key === GROUP);
  assert.equal(group.coverage.totalEpisodes, 3);
  assert.equal(group.coverage.strictComparableEpisodes, 2);
  assert.equal(group.coverage.contextOnlyEpisodes, 1);
  assert.equal(group.hasMultipleComparableEpisodes, true);
  const d3 = group.episodes.items.find((item) => item.decisionId === "d3");
  assert.equal(d3.comparability.classification, "context_only");
  assert.ok(
    d3.comparability.reasons.includes(
      "multiple_variables_changed_concurrently",
    ),
  );
  // Planned RIR of the same exercise is its own group (multiple dimensions).
  assert.ok(
    memory.groups.items.some((item) => item.key === `${EXERCISE}.planned_rir`),
  );
  const reps = group.aggregates.find(
    (item) =>
      item.metric === "mean_actual_reps_per_set" &&
      item.scope === "affected_prescription_sets",
  );
  // d1: 9 → 7 (−2); d2: 7 → 8 (+1). Opposite signs are kept, not averaged.
  assert.equal(reps.observedDeltaCount, 2);
  assert.equal(reps.negativeDeltaCount, 1);
  assert.equal(reps.positiveDeltaCount, 1);
  assert.equal(reps.contradictory, true);
  assert.equal(reps.medianAbsoluteDelta, -0.5);
  assert.deepEqual(
    group.episodes.items.map((item) => item.decisionId),
    ["d3", "d2", "d1"],
  );
});

test("multiple exercises form separate groups", async () => {
  const rowA = program("row-a", {
    exerciseId: ROW,
    status: "archived",
    archivedAt: "2026-09-12T00:00:00.000Z",
  });
  const rowB = program("row-b", {
    exerciseId: ROW,
    revision: 2,
    activatedAt: "2026-09-12T00:00:00.000Z",
    sets: [setTarget("row-b-set", 6, 8)],
  });
  const rowDecision = withActions(decision("r1", "row-a", "row-b"), [
    {
      trainingDayId: "row-a-day",
      exercisePrescriptionId: "row-a-p",
      prescriptionSetId: "row-a-set",
      evidence: [{ kind: "exercise", id: ROW, version: null }],
    },
  ]);
  const { outcomes } = harness({
    decisions: [decision("d1", "program-a", "program-b"), rowDecision],
    programs: [A, B, rowA, rowB],
    sessions: [
      ...baseline,
      post("post-1", 11, "program-b", 7),
      session(
        "row-pre",
        "2026-09-05T10:00:00.000Z",
        "row-a",
        "row-a-set",
        9,
        ATHLETE,
        ROW,
      ),
      post("row-post", 13, "row-b", 8, ROW),
    ],
  });
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  assert.deepEqual(
    memory.groups.items.map((item) => item.key).sort(),
    [`${EXERCISE}.target.reps`, `${ROW}.target.reps`].sort(),
  );
});

test("athlete isolation: foreign programs and sessions never enter memory", async () => {
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
  });
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  assert.equal(memory.totalEpisodes, 0);
  assert.equal(JSON.stringify(memory).includes("intruder"), false);
});

test("group drill-down is unbounded; unknown keys return null", async () => {
  const decisions = Array.from({ length: 7 }, (_, index) =>
    decision(`d${index}`, "program-a", `program-b${index}`, {
      proposedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
    }),
  );
  const programs = [
    A,
    ...decisions.map((item, index) =>
      program(item.materializedProgramId, {
        revision: 2,
        activatedAt: `2026-09-${String(index + 10).padStart(2, "0")}T00:00:00.000Z`,
        sets: [setTarget(`${item.materializedProgramId}-set`, 6, 8)],
      }),
    ),
  ];
  const { outcomes } = harness({ decisions, programs, sessions: baseline });
  const bounded = await new BuildIndividualResponseMemory(outcomes).execute();
  assert.deepEqual(
    [
      bounded.groups.items[0].episodes.included,
      bounded.groups.items[0].episodes.hasMore,
    ],
    [5, true],
  );
  const full = await new GetResponseMemoryGroup(outcomes).execute(GROUP);
  assert.equal(full.episodes.included, 7);
  assert.equal(full.episodes.hasMore, false);
  assert.equal(
    await new GetResponseMemoryGroup(outcomes).execute("nope"),
    null,
  );
});

test("dossier v3 context computes outcomes once and embeds history plus memory", async () => {
  let listCalls = 0;
  const outcomes = new BuildInterventionOutcomes(
    {
      list: async () => {
        listCalls += 1;
        return [decision("d1", "program-a", "program-b")];
      },
    },
    { get: async (id) => [A, B].find((item) => item.id === id) ?? null },
    {
      listHistoricalSessions: async () => [
        ...baseline,
        post("post-1", 11, "program-b", 7),
      ],
      getHistoricalSession: async () => null,
    },
    { list: async () => [] },
    () => new Date("2026-09-30T00:00:00.000Z"),
  );
  const dossier = await new BuildAthleteTrainingDossier(
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
    new BuildInterventionContext(outcomes),
  ).execute();
  assert.equal(listCalls, 1);
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v4");
  assert.equal(dossier.interventionHistory.totalAvailable, 1);
  assert.equal(dossier.responseMemory.groups.items[0].key, GROUP);
  assert.doesNotMatch(
    JSON.stringify(dossier),
    /optimal|effectiveness|successScore|responseScore|preferredRir|preferredRest|recommendedLoad|causalEffect/i,
  );
});

test("memory rebuild is deterministic", async () => {
  const input = {
    decisions: [decision("d1", "program-a", "program-b")],
    programs: [A, B],
    sessions: [...baseline, post("post-1", 11, "program-b", 7)],
  };
  assert.deepEqual(
    await new BuildIndividualResponseMemory(harness(input).outcomes).execute(),
    await new BuildIndividualResponseMemory(harness(input).outcomes).execute(),
  );
});
