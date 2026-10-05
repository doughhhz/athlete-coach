import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWarmUp,
  estimateOneRepMaxWithReserveKg,
  inferLoadStepKg,
  LOAD_SUGGESTION_VERSION,
  loadForRepsKg,
  roundToLoadStep,
  suggestWorkoutLoads,
} from "../src/index.ts";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const daysAgo = (days) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();
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
const exercise = (exerciseId, sequence, sets) => ({
  id: `we-${exerciseId}-${sequence}`,
  sourceExercisePrescriptionId: `p-${exerciseId}`,
  exerciseId,
  sequence,
  exerciseName: exerciseId,
  plannedInstructions: null,
  plannedAthleteCues: null,
  sets,
});
const session = (id, startedAt, exercises, status = "completed") => ({
  id,
  athleteId: "a",
  sourceTrainingDayId: "d",
  programName: "P",
  dayName: "A",
  status,
  athleteNotes: null,
  startedAt,
  completedAt: status === "completed" ? startedAt : null,
  abandonedAt: null,
  createdAt: startedAt,
  updatedAt: startedAt,
  exercises,
});
const profiles = new Map([
  [
    "squat",
    {
      mechanics: "compound",
      primaryMuscleGroups: ["Quadríceps", "Glúteos"],
      equipment: "barbell",
    },
  ],
  [
    "leg-press",
    {
      mechanics: "compound",
      primaryMuscleGroups: ["Quadríceps", "Glúteos"],
      equipment: "machine",
    },
  ],
  [
    "curl",
    {
      mechanics: "isolation",
      primaryMuscleGroups: ["Bíceps"],
      equipment: "dumbbell",
    },
  ],
  [
    "raise",
    {
      mechanics: "isolation",
      primaryMuscleGroups: ["Ombros"],
      equipment: "dumbbell",
    },
  ],
  [
    "pushup",
    {
      mechanics: "compound",
      primaryMuscleGroups: ["Peitoral"],
      equipment: "bodyweight",
    },
  ],
]);
const squatPlan = (change = {}) => ({
  plannedTargetMin: 6,
  plannedTargetMax: 8,
  plannedRirMin: 1,
  plannedRirMax: 2,
  ...change,
});
const suggest = (exercises, history = [], plannedPerWeek = 3) =>
  suggestWorkoutLoads({
    session: session("today", NOW.toISOString(), exercises, "in_progress"),
    history,
    profiles,
    plannedPerWeek,
    now: NOW,
  });

test("Epley with reserve, inverse and rounding (limits)", () => {
  assert.ok(
    Math.abs(estimateOneRepMaxWithReserveKg(80, 8, 2) - 80 * (1 + 10 / 30)) <
      1e-9,
  );
  assert.equal(estimateOneRepMaxWithReserveKg(80, 8, null), 80 * (1 + 8 / 30));
  assert.equal(estimateOneRepMaxWithReserveKg(20, 15, 5), 20 * (1 + 20 / 30));
  assert.equal(estimateOneRepMaxWithReserveKg(20, 16, 5), null);
  assert.equal(estimateOneRepMaxWithReserveKg(0, 8, 2), null);
  assert.equal(estimateOneRepMaxWithReserveKg(20, 2.5, 2), null);
  assert.ok(Math.abs(loadForRepsKg(80 * (1 + 10 / 30), 8, 2) - 80) < 1e-9);
  assert.equal(roundToLoadStep(84.2, 2.5), 85);
  assert.equal(roundToLoadStep(83.75, 2.5), 82.5); // tie goes down
  assert.equal(roundToLoadStep(0.3, 1), 1); // never below one step
  assert.equal(roundToLoadStep(20.9, 1), 21);
});

test("load step: the athlete's real increments, else the equipment default", () => {
  assert.equal(inferLoadStepKg([20, 22, 24, 22], "dumbbell"), 2);
  assert.equal(inferLoadStepKg([80, 82.5, 85], "other"), 2.5);
  assert.equal(inferLoadStepKg([20], "dumbbell"), 1);
  assert.equal(inferLoadStepKg([], "barbell"), 2.5);
  assert.equal(inferLoadStepKg([10, 10.25, 20], "kettlebell"), 4); // < 0.5 ignored; 9.75 > 5
});

test("from history: barbell squat 8 x 80 kg RIR 2 -> 85 kg with a full ramp", () => {
  const history = [
    session("w1", daysAgo(9), [
      exercise("squat", 1, [
        set(1, 8, 80, 2, squatPlan()),
        set(2, 7, 82.5, 1, squatPlan()),
      ]),
    ]),
  ];
  const [result] = suggest(
    [exercise("squat", 1, [set(1, null, null, null, squatPlan())])],
    history,
  );
  assert.equal(result.version, LOAD_SUGGESTION_VERSION);
  assert.equal(result.kind, "from_history");
  assert.deepEqual(result.target, { reps: 7, rir: 1 });
  assert.equal(result.basis.loadKg, 80);
  assert.equal(result.stepKg, 2.5);
  assert.equal(result.workingLoadKg, 85);
  assert.deepEqual(result.warmUp, {
    plan: "full",
    sets: [
      { loadKg: 32.5, reps: 10, percent: 0.4 },
      { loadKg: 50, reps: 5, percent: 0.6 },
      { loadKg: 67.5, reps: 3, percent: 0.8 },
    ],
  });
});

test("the athlete's dumbbell example: 12 x 20 kg sobrando 4 -> 21 kg, isolation single warm-up", () => {
  const [result] = suggest(
    [exercise("curl", 1, [set(1, null)])],
    [session("w1", daysAgo(3), [exercise("curl", 1, [set(1, 12, 20, 4)])])],
  );
  assert.equal(result.workingLoadKg, 21);
  assert.equal(result.stepKg, 1);
  assert.deepEqual(result.warmUp, {
    plan: "single",
    sets: [{ loadKg: 10, reps: 10, percent: 0.5 }],
  });
  assert.ok(result.reasons.includes("isolation"));
});

test("context: long break lowers 10%; heavy week never raises; +10% cap", () => {
  const curlToday = [exercise("curl", 1, [set(1, null)])];
  const old = [
    session("w1", daysAgo(20), [exercise("curl", 1, [set(1, 12, 20, 4)])]),
  ];
  const [afterBreak] = suggest(curlToday, old);
  assert.equal(afterBreak.workingLoadKg, 19); // 20.9 x 0.9 = 18.8
  assert.ok(afterBreak.reasons.includes("long_break"));

  const busy = [
    session("w1", daysAgo(1), [exercise("curl", 1, [set(1, 12, 20, 4)])]),
    session("w2", daysAgo(2), []),
    session("w3", daysAgo(3), []),
  ];
  const [heavy] = suggest(curlToday, busy, 3);
  assert.equal(heavy.workingLoadKg, 20);
  assert.ok(heavy.reasons.includes("heavy_week"));

  const easy = [
    session("w1", daysAgo(2), [exercise("curl", 1, [set(1, 15, 20, 5)])]),
  ];
  const [capped] = suggest(curlToday, easy);
  assert.equal(capped.workingLoadKg, 22); // estimate says 22.7; cap 20 x 1.1
  assert.ok(capped.reasons.includes("capped_increase"));
});

test("prescribed load wins; warm-up still computed from it", () => {
  const [result] = suggest([
    exercise("squat", 1, [
      set(
        1,
        null,
        null,
        null,
        squatPlan({ plannedLoadKind: "absolute", plannedLoadKg: 60 }),
      ),
    ]),
  ]);
  assert.equal(result.kind, "prescribed");
  assert.equal(result.workingLoadKg, 60);
  assert.equal(result.basis, null);
  assert.deepEqual(
    result.warmUp.sets.map((item) => item.loadKg),
    [22.5, 35, 47.5],
  );
});

test("light barbell ramp starts at the empty bar and drops useless sets", () => {
  assert.deepEqual(buildWarmUp("full", 30, 2.5, profiles.get("squat")), [
    { loadKg: 20, reps: 8, percent: null },
    { loadKg: 22.5, reps: 4, percent: 0.75 },
  ]);
  assert.deepEqual(buildWarmUp("full", 20, 2.5, profiles.get("squat")), []);
  assert.deepEqual(buildWarmUp("none", 100, 2.5, profiles.get("squat")), []);
});

test("muscle group already warm: second compound gets a single set; isolation of a new group too", () => {
  const history = [
    session("w1", daysAgo(4), [
      exercise("squat", 1, [set(1, 8, 80, 2, squatPlan())]),
      exercise("leg-press", 2, [set(1, 12, 150, 2)]),
      exercise("raise", 3, [set(1, 12, 6, 2)]),
    ]),
  ];
  const [, legPress, raise] = suggest(
    [
      exercise("squat", 1, [set(1, null, null, null, squatPlan())]),
      exercise("leg-press", 2, [set(1, null)]),
      exercise("raise", 3, [set(1, null)]),
    ],
    history,
  );
  assert.equal(legPress.warmUp.plan, "single");
  assert.ok(legPress.reasons.includes("group_already_warm"));
  assert.equal(legPress.warmUp.sets.length, 1);
  // 6 kg raise: light isolation, no formal warm-up.
  assert.equal(raise.warmUp.plan, "none");
});

test("no history: exploratory (no load invented); bodyweight; non-rep sets skipped", () => {
  const results = suggest([
    exercise("curl", 1, [set(1, null)]),
    exercise("pushup", 2, [set(1, null)]),
    exercise("plank", 3, [
      set(1, null, null, null, { plannedMetric: "seconds" }),
    ]),
    exercise("unknown", 4, [
      set(1, null, null, null, { plannedRirMin: null, plannedRirMax: null }),
    ]),
  ]);
  assert.equal(results.length, 3);
  assert.equal(results[0].kind, "exploratory");
  assert.equal(results[0].workingLoadKg, null);
  assert.deepEqual(results[0].warmUp, { plan: "none", sets: [] });
  assert.equal(results[1].kind, "bodyweight");
  assert.equal(results[2].kind, "exploratory");
  assert.deepEqual(results[2].target, { reps: 12, rir: 2 });
  assert.ok(results[2].reasons.includes("rir_assumed"));
});

test("only finished sessions of the same exercise count", () => {
  const [result] = suggest(
    [exercise("curl", 1, [set(1, null)])],
    [
      session(
        "live",
        daysAgo(0.5),
        [exercise("curl", 1, [set(1, 12, 50, 2)])],
        "in_progress",
      ),
      session("other", daysAgo(1), [exercise("raise", 1, [set(1, 12, 50, 2)])]),
      session("w1", daysAgo(2), [
        exercise("curl", 1, [set(1, 12, 20, 4), set(2, 4, 20, 0)]),
      ]),
    ],
  );
  assert.equal(result.basis.value, 12);
  assert.equal(result.workingLoadKg, 21);
});
