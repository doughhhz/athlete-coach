import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveWeekPlan,
  estimateTrainingDayMinutes,
  highlightedWeekPlanDay,
  workoutExerciseProgress,
} from "../src/index.ts";

const set = (sequence, change = {}) => ({
  id: `s${sequence}`,
  sequence,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 2,
  rirMax: 2,
  restMinSeconds: 120,
  restMaxSeconds: 180,
  tempo: null,
  loadKind: "athlete_selected",
  loadKg: null,
  ...change,
});
const day = (id, preferredWeekday, sets = [set(1), set(2), set(3)]) => ({
  id,
  sequence: preferredWeekday ?? 9,
  name: `Dia ${id}`,
  preferredWeekday,
  notes: null,
  prescriptions: [
    {
      id: `p-${id}`,
      exerciseId: "e",
      exerciseName: "E",
      sequence: 1,
      instructions: null,
      athleteCues: null,
      sets,
    },
  ],
});
const program = (days) => ({
  id: "program",
  blocks: [
    {
      id: "b",
      sequence: 1,
      name: "Base",
      description: null,
      weeks: [{ id: "w", sequence: 1, name: null, notes: null, days }],
    },
  ],
});

test("training day duration uses the envelope formula", () => {
  // 300 s warm-up + 60 s transition + 3 x (40 + 150) = 930 s -> 16 min.
  assert.equal(estimateTrainingDayMinutes(day("a", 1)), 16);
  // No planned rest: 60 s per set; seconds and meters as work time.
  assert.equal(
    estimateTrainingDayMinutes(
      day("b", 1, [
        set(1, { restMinSeconds: null, restMaxSeconds: null }),
        set(2, {
          targetMetric: "seconds",
          targetMax: 30,
          restMinSeconds: 60,
          restMaxSeconds: 60,
        }),
        set(3, {
          targetMetric: "meters",
          targetMax: 200,
          restMinSeconds: 0,
          restMaxSeconds: 0,
        }),
      ]),
    ),
    // 300 + 60 + (40 + 60) + (30 + 60) + (200 + 0) = 750 s -> 13 min.
    13,
  );
  assert.equal(
    estimateTrainingDayMinutes({ ...day("c", 1), prescriptions: [] }),
    5,
  );
});

// Wednesday 2026-09-30 15:00 in São Paulo (18:00 UTC).
const now = new Date("2026-09-30T18:00:00Z");
const timeZone = "America/Sao_Paulo";

test("week plan: Monday to Sunday, today, planned, done and rest", () => {
  const week = deriveWeekPlan({
    program: program([day("mon", 1), day("wed", 3), day("fri", 5)]),
    sessions: [
      { status: "completed", startedAt: "2026-09-28T22:00:00Z" }, // Mon 19:00 local
      { status: "abandoned", startedAt: "2026-09-29T12:00:00Z" },
      // Thursday 01:30 UTC is still Wednesday 22:30 in São Paulo.
      { status: "completed", startedAt: "2026-10-01T01:30:00Z" },
    ],
    now,
    timeZone,
  });
  assert.deepEqual(
    week.map((item) => [
      item.weekday,
      item.date,
      item.dayOfMonth,
      item.isToday,
      item.status,
      item.trainingDay?.id ?? null,
    ]),
    [
      [1, "2026-09-28", 28, false, "done", "mon"],
      [2, "2026-09-29", 29, false, "rest", null],
      [3, "2026-09-30", 30, true, "done", "wed"],
      [4, "2026-10-01", 1, false, "rest", null],
      [5, "2026-10-02", 2, false, "planned", "fri"],
      [6, "2026-10-03", 3, false, "rest", null],
      [7, "2026-10-04", 4, false, "rest", null],
    ],
  );
});

test("week starts on Monday even when today is Sunday", () => {
  const sunday = deriveWeekPlan({
    program: null,
    sessions: [],
    now: new Date("2026-10-04T15:00:00Z"),
    timeZone,
  });
  assert.equal(sunday[0].date, "2026-09-28");
  assert.equal(sunday[6].isToday, true);
  assert.ok(sunday.every((item) => item.status === "rest"));
});

test("highlight: today if planned, else next planned, else first planned", () => {
  const build = (days, sessions = []) =>
    highlightedWeekPlanDay(
      deriveWeekPlan({ program: program(days), sessions, now, timeZone }),
    );
  assert.equal(
    build([day("mon", 1), day("wed", 3), day("fri", 5)]).trainingDay.id,
    "wed",
  );
  // Today already done: the next planned day.
  assert.equal(
    build(
      [day("mon", 1), day("wed", 3), day("fri", 5)],
      [{ status: "completed", startedAt: "2026-09-30T12:00:00Z" }],
    ).trainingDay.id,
    "fri",
  );
  // Nothing left this week: the first planned day of the week.
  assert.equal(build([day("mon", 1), day("tue", 2)]).trainingDay.id, "mon");
  assert.equal(build([day("x", null)]), null);
  // Template week = first week of the first block; first day wins a weekday.
  const twoBlocks = {
    blocks: [
      {
        id: "b2",
        sequence: 2,
        weeks: [{ id: "w", sequence: 1, days: [day("later", 3)] }],
      },
      {
        id: "b1",
        sequence: 1,
        weeks: [
          {
            id: "w",
            sequence: 1,
            days: [day("first", 3), { ...day("dup", 3), sequence: 99 }],
          },
        ],
      },
    ],
  };
  assert.equal(
    highlightedWeekPlanDay(
      deriveWeekPlan({ program: twoBlocks, sessions: [], now, timeZone }),
    ).trainingDay.id,
    "first",
  );
});

test("workout progress counts exercises with no pending set", () => {
  const exercise = (statuses) => ({
    sets: statuses.map((status) => ({ status })),
  });
  assert.deepEqual(
    workoutExerciseProgress({
      exercises: [
        exercise(["completed", "skipped"]),
        exercise(["completed", "pending"]),
        exercise([]),
      ],
    }),
    { finished: 1, total: 3 },
  );
});

test("home summaries: week done/planned, last 28 days, weight goal", async () => {
  const {
    summarizeWeekPlan,
    countRecentCompletedWorkouts,
    weightGoalDifferenceKg,
  } = await import("../src/index.ts");
  const week = deriveWeekPlan({
    program: program([day("mon", 1), day("wed", 3), day("fri", 5)]),
    sessions: [
      { status: "completed", startedAt: "2026-09-28T22:00:00Z" },
      // Done on an unplanned day still counts as done.
      { status: "completed", startedAt: "2026-09-29T22:00:00Z" },
    ],
    now,
    timeZone,
  });
  assert.deepEqual(summarizeWeekPlan(week), { done: 2, planned: 3 });
  const sessions = [
    { status: "completed", startedAt: "2026-09-29T12:00:00Z" },
    { status: "completed", startedAt: "2026-09-02T18:00:01Z" }, // inside 28 days
    { status: "completed", startedAt: "2026-09-02T18:00:00Z" }, // exactly 28 days: out
    { status: "abandoned", startedAt: "2026-09-29T12:00:00Z" },
    { status: "completed", startedAt: "2026-10-01T12:00:00Z" }, // future: out
  ];
  assert.equal(countRecentCompletedWorkouts(sessions, now), 2);
  assert.equal(countRecentCompletedWorkouts(sessions, now, 7), 1);
  assert.equal(weightGoalDifferenceKg(78.4, 82.4), 4);
  assert.equal(weightGoalDifferenceKg(80, 74.95), -5.1);
  assert.equal(weightGoalDifferenceKg(null, 80), null);
  assert.equal(weightGoalDifferenceKg(80, null), null);
});

test("weight goal rounding is symmetric (half away from zero)", async () => {
  const { weightGoalDifferenceKg } = await import("../src/index.ts");
  assert.equal(weightGoalDifferenceKg(80, 80.05), 0.1);
  assert.equal(weightGoalDifferenceKg(80.05, 80), -0.1);
  assert.equal(weightGoalDifferenceKg(80, 80.04), 0);
  assert.equal(weightGoalDifferenceKg(80, 80), 0);
});
