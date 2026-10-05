import assert from "node:assert/strict";
import test from "node:test";
import {
  AssessWorkoutSet,
  GetExercisePerformanceHistory,
  GetExercisePersonalBests,
  GetPerformanceOverview,
  GetWorkoutDerivedSummary,
} from "../src/index.ts";
const set = {
  id: "set",
  sourcePrescriptionSetId: "ps",
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
  actualValue: 8,
  actualLoadKg: 60,
  actualRir: null,
  performedAt: "2026-01-01T10:01:00.000Z",
  restStartedAt: null,
  restEndedAt: null,
};
const session = {
  id: "session",
  athleteId: "a",
  sourceTrainingDayId: "d",
  programName: "P",
  dayName: "D",
  status: "completed",
  athleteNotes: null,
  startedAt: "2026-01-01T10:00:00.000Z",
  completedAt: "2026-01-01T10:10:00.000Z",
  abandonedAt: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:10:00.000Z",
  exercises: [
    {
      id: "we",
      sourceExercisePrescriptionId: "ep",
      exerciseId: "exercise",
      sequence: 1,
      exerciseName: "Supino",
      plannedInstructions: null,
      plannedAthleteCues: null,
      sets: [set],
    },
  ],
};
function repository(sessions = [session]) {
  return {
    listHistoricalSessions: async () => sessions,
    getHistoricalSession: async (id) =>
      sessions.find((item) => item.id === id) ?? null,
  };
}
test("overview derives factual totals", async () => {
  const result = await new GetPerformanceOverview(repository()).execute();
  assert.equal(result.completedWorkoutCount, 1);
  assert.equal(result.totalActualReps, 8);
});
test("empty history returns zeros and no bests", async () => {
  assert.equal(
    (await new GetPerformanceOverview(repository([])).execute())
      .completedSetCount,
    0,
  );
  assert.deepEqual(
    await new GetExercisePersonalBests(repository([])).execute(),
    [],
  );
});
test("history filters canonical exercise", async () => {
  const points = await new GetExercisePerformanceHistory(repository()).execute(
    "exercise",
  );
  assert.equal(points.length, 1);
  assert.equal(points[0].exerciseId, "exercise");
});
test("personal bests are derived from raw sessions", async () =>
  assert.equal(
    (await new GetExercisePersonalBests(repository()).execute())[0]
      .maxLoggedLoadKg,
    60,
  ));
test("workout summary returns null when ownership/read boundary yields no session", async () =>
  assert.equal(
    await new GetWorkoutDerivedSummary(repository([])).execute("missing"),
    null,
  ));
test("workout summary includes deterministic metrics", async () =>
  assert.equal(
    (await new GetWorkoutDerivedSummary(repository()).execute("session"))
      .metrics.bestEstimatedOneRepMaxKg,
    76,
  ));

test("AssessWorkoutSet: history and planned week feed the deterministic assessment", async () => {
  const current = {
    ...session,
    id: "current",
    status: "in_progress",
    startedAt: "2026-01-03T10:00:00.000Z",
    completedAt: null,
    exercises: [
      {
        ...session.exercises[0],
        id: "we-current",
        sets: [
          { ...set, id: "current-set", actualValue: 10, actualLoadKg: 60 },
        ],
      },
    ],
  };
  const day = (id) => ({
    id,
    sequence: 1,
    preferredWeekday: null,
    prescriptions: [],
  });
  const result = await new AssessWorkoutSet(repository([session, current]), {
    getActive: async () => ({
      blocks: [
        { sequence: 1, weeks: [{ sequence: 1, days: [day("a"), day("b")] }] },
      ],
    }),
  }).execute({
    session: current,
    workoutSetId: "current-set",
    now: new Date("2026-01-03T10:30:00.000Z"),
  });
  assert.equal(result.verdict, "within_plan");
  assert.equal(result.previousSessionCount, 1);
  assert.equal(result.lastSession.value, 8);
  assert.equal(result.lastSession.valueChange, 0.25);
  assert.equal(result.week.plannedPerWeek, 2);
  assert.equal(result.week.workoutsLast7Days, 2);
  assert.deepEqual(result.records, [
    { kind: "estimated_one_rep_max", scope: "all_time" },
    { kind: "reps_at_load", scope: "all_time" },
  ]);
  assert.equal(
    await new AssessWorkoutSet(repository([]), {
      getActive: async () => null,
    }).execute({
      session: current,
      workoutSetId: "unknown",
    }),
    null,
  );
});
