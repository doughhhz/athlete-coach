import assert from "node:assert/strict";
import test from "node:test";
import {
  assessWorkoutSet,
  plannedTrainingDaysPerWeek,
  SET_ASSESSMENT_VERSION,
} from "../src/index.ts";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const daysAgo = (days) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** Completed set; plan 10-15 reps @ RIR 2-3 (the athlete's real test). */
const set = (sequence, value, load, rir, change = {}) => ({
  id: `set-${sequence}`,
  sourcePrescriptionSetId: `ps-${sequence}`,
  sequence,
  status: value === null ? "pending" : "completed",
  plannedMetric: "reps",
  plannedTargetMin: 10,
  plannedTargetMax: 15,
  plannedRirMin: 2,
  plannedRirMax: 3,
  plannedRestMinSeconds: 60,
  plannedRestMaxSeconds: 90,
  plannedTempo: null,
  plannedLoadKind: "athlete_selected",
  plannedLoadKg: null,
  actualValue: value,
  actualLoadKg: value === null ? null : load,
  actualRir: value === null ? null : rir,
  performedAt: value === null ? null : NOW.toISOString(),
  restStartedAt: null,
  restEndedAt: null,
  ...change,
});
function session(id, startedAt, sets, change = {}) {
  return {
    id,
    athleteId: "athlete",
    sourceTrainingDayId: "day",
    programName: "P",
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
        id: `${id}-ex`,
        sourceExercisePrescriptionId: "prescription",
        exerciseId: "curl",
        sequence: 1,
        exerciseName: "Rosca direta",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: sets.map((item) => ({ ...item, id: `${id}-${item.id}` })),
      },
    ],
    ...change,
  };
}
const today = (sets) =>
  session("today", NOW.toISOString(), sets, {
    status: "in_progress",
    completedAt: null,
  });
const assess = (current, setId, history = [], plannedPerWeek = 3) =>
  assessWorkoutSet({
    session: current,
    workoutSetId: `today-${setId}`,
    history,
    plannedPerWeek,
    now: NOW,
  });

test("the athlete's test: 2 reps at failure after 12 last time -> reduce", () => {
  const history = [
    session("w1", daysAgo(5), [set(1, 12, 2.5, 2), set(2, 11, 2.5, 2)]),
    session("w2", daysAgo(3), [set(1, 12, 2.5, 2)]),
    session("w3", daysAgo(2), [set(1, 13, 2.5, 3)]),
    session("w4", daysAgo(1), [set(1, 12, 2.5, 2)]),
  ];
  const result = assess(
    today([set(1, 2, 2.5, 0), set(2, null), set(3, null)]),
    "set-1",
    history,
  );
  assert.equal(result.version, SET_ASSESSMENT_VERSION);
  assert.equal(result.verdict, "below_plan");
  assert.equal(result.plan.rirAttainment, "below_range");
  assert.equal(result.lastSession.value, 12);
  assert.equal(result.lastSession.startedAt, daysAgo(1));
  assert.ok(Math.abs(result.lastSession.valueChange - -0.8333) < 0.001);
  assert.equal(result.week.workoutsLast7Days, 5);
  assert.equal(result.week.daysSinceExercise, 1);
  assert.deepEqual(result.recommendation, {
    action: "decrease",
    scope: "next_set",
    currentLoadKg: 2.5,
    loadKg: { min: 2, max: 2 },
    target: { min: 10, max: 15 },
    rir: { min: 2, max: 3 },
    confidence: "high",
  });
  for (const reason of ["below_last_session", "heavy_week", "sharp_drop"])
    assert.ok(result.reasons.includes(reason), reason);
  assert.equal(result.recentAverage.sessionCount, 3);
  assert.ok(Math.abs(result.recentAverage.value - 37 / 3) < 1e-9);
});

test("below plan but usual for the athlete at this set -> keep", () => {
  const history = [
    session("w1", daysAgo(4), [set(1, 12, 20, 2), set(2, 9, 20, 1)]),
  ];
  const result = assess(
    today([set(1, 12, 20, 2), set(2, 9, 20, 1), set(3, null)]),
    "set-2",
    history,
  );
  assert.equal(result.verdict, "below_plan");
  assert.equal(result.recommendation.action, "keep");
  assert.deepEqual(result.recommendation.loadKg, { min: 20, max: 20 });
  assert.ok(result.reasons.includes("usual_for_you"));
  assert.equal(result.previousSetToday.sequence, 1);
  assert.equal(result.previousSetToday.change, -0.25);
  // The same drop happened last time: normal fatigue for this athlete.
  assert.ok(result.reasons.includes("steep_in_session_drop"));
});

test("clearly worse than the same set last time -> reduce", () => {
  const history = [
    session("w1", daysAgo(4), [set(1, 12, 20, 2), set(2, 11, 20, 2)]),
  ];
  const result = assess(
    today([set(1, 12, 20, 2), set(2, 9, 20, 1)]),
    "set-2",
    history,
  );
  // 9 vs 11 last time (-18%): not the athlete's usual, so reduce.
  assert.ok(result.reasons.includes("below_last_session"));
  assert.equal(result.recommendation.action, "decrease");
  assert.equal(result.recommendation.scope, "next_session");
  assert.deepEqual(result.recommendation.loadKg, { min: 18, max: 19 });
});

test("above plan three sessions in a row -> increase with high confidence", () => {
  const history = [
    session("w1", daysAgo(6), [set(1, 15, 20, 4)]),
    session("w2", daysAgo(3), [set(1, 16, 20, 4)]),
  ];
  const result = assess(
    today([set(1, 16, 20, 5), set(2, null)]),
    "set-1",
    history,
    3,
  );
  assert.equal(result.verdict, "above_plan");
  assert.equal(result.recommendation.action, "increase");
  assert.deepEqual(result.recommendation.loadKg, { min: 21, max: 21 });
  assert.equal(result.recommendation.confidence, "high");
  assert.ok(result.reasons.includes("consistent_above"));
  assert.ok(!result.reasons.includes("heavy_week"));
});

test("reps at the top with RIR inside the plan -> keep (approved bands)", () => {
  const result = assess(today([set(1, 15, 20, 3)]), "set-1");
  assert.equal(result.verdict, "within_plan");
  assert.equal(result.recommendation.action, "keep");
  assert.ok(result.reasons.includes("first_time"));
  assert.equal(result.recommendation.confidence, "low");
  assert.equal(result.lastSession, null);
  assert.equal(result.trend, null);
  assert.deepEqual(result.records, []);
});

test("stopped early with reserve left: keep and aim for the target", () => {
  const result = assess(today([set(1, 8, 20, 5)]), "set-1");
  assert.equal(result.verdict, "stopped_early");
  assert.equal(result.recommendation.action, "keep");
});

test("without RIR the reduction band is not applied; confidence low", () => {
  const result = assess(today([set(1, 4, 20, null)]), "set-1");
  assert.equal(result.verdict, "below_plan");
  assert.equal(result.plan.rirAttainment, null);
  assert.equal(result.recommendation.action, "keep");
  assert.ok(result.reasons.includes("rir_not_recorded"));
});

test("bodyweight sets get guidance without a load range", () => {
  const result = assess(today([set(1, 16, null, 4)]), "set-1");
  assert.equal(result.recommendation.action, "increase");
  assert.equal(result.recommendation.loadKg, null);
  assert.equal(result.recommendation.currentLoadKg, null);
});

test("different load: compares estimated strength, not reps", () => {
  const history = [session("w1", daysAgo(2), [set(1, 10, 20, 2)])];
  const result = assess(today([set(1, 10, 22.5, 2)]), "set-1", history);
  assert.equal(result.lastSession.valueChange, null);
  assert.ok(
    Math.abs(result.lastSession.estimatedOneRepMaxChange - 0.125) < 1e-9,
  );
  assert.ok(result.reasons.includes("above_last_session"));
  assert.deepEqual(result.records, [
    { kind: "load", scope: "all_time" },
    { kind: "estimated_one_rep_max", scope: "all_time" },
  ]);
});

test("records: more reps at the same load; 28-day record vs all time", () => {
  const history = [
    session("old", daysAgo(60), [set(1, 12, 30, 2)]),
    session("w1", daysAgo(10), [set(1, 10, 25, 2)]),
  ];
  const result = assess(today([set(1, 12, 25, 2)]), "set-1", history);
  assert.deepEqual(result.records, [
    { kind: "estimated_one_rep_max", scope: "last_28_days" },
    { kind: "reps_at_load", scope: "last_28_days" },
  ]);
});

test("trend over 28 days: first vs last session best e1RM (2.5% threshold)", () => {
  const rising = assess(today([set(1, 10, 22, 2)]), "set-1", [
    session("w1", daysAgo(20), [set(1, 10, 20, 2)]),
    session("w2", daysAgo(10), [set(1, 10, 21, 2)]),
  ]);
  assert.equal(rising.trend.direction, "rising");
  assert.equal(rising.trend.sessionCount, 3);
  const stable = assess(today([set(1, 10, 20.25, 2)]), "set-1", [
    session("w1", daysAgo(20), [set(1, 10, 20, 2)]),
    session("w2", daysAgo(10), [set(1, 10, 21, 2)]),
  ]);
  assert.equal(stable.trend.direction, "stable");
  const falling = assess(today([set(1, 10, 19, 2)]), "set-1", [
    session("w1", daysAgo(20), [set(1, 10, 20, 2)]),
    session("w2", daysAgo(10), [set(1, 10, 20, 2)]),
    session("w0", daysAgo(40), [set(1, 10, 50, 2)]),
  ]);
  assert.equal(falling.trend.direction, "falling");
  assert.equal(falling.trend.sessionCount, 3);
});

test("long break and other exercises/sessions are ignored correctly", () => {
  const other = session("x", daysAgo(1), [set(1, 10, 80, 2)]);
  other.exercises[0] = { ...other.exercises[0], exerciseId: "squat" };
  const result = assess(today([set(1, 10, 20, 2)]), "set-1", [
    other,
    session("w1", daysAgo(20), [set(1, 10, 20, 2)]),
    session("live", daysAgo(0.1), [set(1, 99, 99, 2)], {
      status: "in_progress",
    }),
  ]);
  assert.equal(result.week.daysSinceExercise, 20);
  assert.ok(result.reasons.includes("long_break"));
  assert.equal(result.previousSessionCount, 1);
  assert.equal(result.week.workoutsLast7Days, 2);
});

test("pending or unknown sets are not assessed", () => {
  assert.equal(assess(today([set(1, null)]), "set-1"), null);
  assert.equal(assess(today([set(1, 10, 20, 2)]), "missing"), null);
});

test("planned training days per week come from the template week", () => {
  assert.equal(plannedTrainingDaysPerWeek(null), null);
  const day = (id, sequence) => ({
    id,
    sequence,
    preferredWeekday: null,
    prescriptions: [],
  });
  assert.equal(
    plannedTrainingDaysPerWeek({
      blocks: [
        { sequence: 2, weeks: [{ sequence: 1, days: [day("x", 1)] }] },
        {
          sequence: 1,
          weeks: [
            { sequence: 2, days: [day("y", 1)] },
            { sequence: 1, days: [day("a", 1), day("b", 2), day("c", 3)] },
          ],
        },
      ],
    }),
    3,
  );
});
