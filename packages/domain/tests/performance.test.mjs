import assert from "node:assert/strict";
import test from "node:test";
import {
  actualRestSeconds,
  classifyRange,
  deriveExercisePerformanceHistory,
  derivePerformanceOverview,
  derivePersonalBests,
  deriveRestAttainment,
  deriveRirAttainment,
  deriveSessionMetrics,
  deriveTargetAttainment,
  estimateOneRepMaxKg,
  EPLEY_FORMULA_VERSION,
} from "../src/index.ts";
function set(change = {}) {
  return {
    id: "set",
    sourcePrescriptionSetId: "ps",
    sequence: 1,
    status: "completed",
    plannedMetric: "reps",
    plannedTargetMin: 8,
    plannedTargetMax: 10,
    plannedRirMin: 2,
    plannedRirMax: 3,
    plannedRestMinSeconds: 90,
    plannedRestMaxSeconds: 120,
    plannedTempo: null,
    plannedLoadKind: "athlete_selected",
    plannedLoadKg: null,
    actualValue: 9,
    actualLoadKg: 60,
    actualRir: 2,
    performedAt: "2026-01-01T10:01:00.000Z",
    restStartedAt: "2026-01-01T10:01:00.000Z",
    restEndedAt: "2026-01-01T10:02:40.000Z",
    ...change,
  };
}
function session(change = {}) {
  return {
    id: "session",
    athleteId: "athlete",
    sourceTrainingDayId: "day",
    programName: "Program",
    dayName: "Day",
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
        sets: [set()],
      },
    ],
    ...change,
  };
}
for (const [value, expected] of [
  [7, "below_range"],
  [8, "within_range"],
  [9, "within_range"],
  [10, "within_range"],
  [11, "above_range"],
])
  test(`target range ${value} is ${expected}`, () =>
    assert.equal(classifyRange(value, 8, 10), expected));
test("target excludes skipped and pending", () => {
  assert.equal(
    deriveTargetAttainment(set({ status: "skipped", actualValue: null })),
    "not_measured",
  );
  assert.equal(
    deriveTargetAttainment(set({ status: "pending", actualValue: null })),
    "not_measured",
  );
});
test("RIR handles below within above and missing", () => {
  assert.equal(deriveRirAttainment(set({ actualRir: 1 })), "below_range");
  assert.equal(deriveRirAttainment(set({ actualRir: 2 })), "within_range");
  assert.equal(deriveRirAttainment(set({ actualRir: 4 })), "above_range");
  assert.equal(deriveRirAttainment(set({ actualRir: null })), "not_measured");
  assert.equal(
    deriveRirAttainment(set({ plannedRirMin: null, plannedRirMax: null })),
    "not_planned",
  );
});
test("rest derives seconds and attainment", () => {
  assert.equal(actualRestSeconds(set()), 100);
  assert.equal(
    deriveRestAttainment(set({ restEndedAt: "2026-01-01T10:02:00.000Z" })),
    "below_range",
  );
  assert.equal(deriveRestAttainment(set()), "within_range");
  assert.equal(
    deriveRestAttainment(set({ restEndedAt: "2026-01-01T10:03:30.000Z" })),
    "above_range",
  );
});
test("rest missing timestamps or plan is not failure", () => {
  assert.equal(
    deriveRestAttainment(set({ restEndedAt: null })),
    "not_measured",
  );
  assert.equal(
    deriveRestAttainment(
      set({ plannedRestMinSeconds: null, plannedRestMaxSeconds: null }),
    ),
    "not_planned",
  );
});
for (const [reps, expected] of [
  [1, 60],
  [2, 64],
  [5, 70],
  [8, 76],
  [12, 84],
])
  test(`Epley v1 estimates ${reps} reps`, () =>
    assert.equal(
      estimateOneRepMaxKg({
        metric: "reps",
        reps,
        loadKg: 60,
        status: "completed",
      }),
      expected,
    ));
test("Epley preserves precision internally", () =>
  assert.equal(
    estimateOneRepMaxKg({
      metric: "reps",
      reps: 7,
      loadKg: 27.5,
      status: "completed",
    }),
    27.5 * (1 + 7 / 30),
  ));
test("e1RM rejects ineligible observations", () => {
  for (const input of [
    { metric: "reps", reps: 8, loadKg: null, status: "completed" },
    { metric: "seconds", reps: 8, loadKg: 60, status: "completed" },
    { metric: "meters", reps: 8, loadKg: 60, status: "completed" },
    { metric: "reps", reps: 13, loadKg: 60, status: "completed" },
    { metric: "reps", reps: 8, loadKg: 60, status: "skipped" },
  ])
    assert.equal(estimateOneRepMaxKg(input), null);
});
test("session derives terminal duration counts and separate units", () => {
  const s = session({
    exercises: [
      {
        ...session().exercises[0],
        sets: [
          set(),
          set({ id: "seconds", plannedMetric: "seconds", actualValue: 30 }),
          set({ id: "meters", plannedMetric: "meters", actualValue: 100 }),
          set({
            id: "skip",
            status: "skipped",
            actualValue: null,
            actualLoadKg: null,
            performedAt: "2026-01-01T10:04:00.000Z",
          }),
        ],
      },
    ],
  });
  const m = deriveSessionMetrics(s);
  assert.equal(m.durationSeconds, 600);
  assert.equal(m.completedSetCount, 3);
  assert.equal(m.skippedSetCount, 1);
  assert.equal(m.totalActualReps, 9);
  assert.equal(m.totalActualSeconds, 30);
  assert.equal(m.totalActualMeters, 100);
});
test("abandoned duration and pending remain factual", () => {
  const s = session({
    status: "abandoned",
    completedAt: null,
    abandonedAt: "2026-01-01T10:05:00.000Z",
    exercises: [
      {
        ...session().exercises[0],
        sets: [
          set(),
          set({
            id: "pending",
            status: "pending",
            actualValue: null,
            actualLoadKg: null,
            performedAt: null,
          }),
        ],
      },
    ],
  });
  const m = deriveSessionMetrics(s);
  assert.equal(m.durationSeconds, 300);
  assert.equal(m.pendingSetCount, 1);
  assert.equal(derivePerformanceOverview([s]).abandonedWorkoutCount, 1);
});
test("PR chronology treats first as baseline, tie/lower as no PR, greater as PR", () => {
  const values = [60, 60, 55, 65];
  const sessions = values.map((load, index) =>
    session({
      id: `s${index}`,
      startedAt: `2026-01-0${index + 1}T10:00:00.000Z`,
      completedAt: `2026-01-0${index + 1}T10:10:00.000Z`,
      exercises: [
        {
          ...session().exercises[0],
          sets: [
            set({
              id: `set${index}`,
              actualLoadKg: load,
              performedAt: `2026-01-0${index + 1}T10:01:00.000Z`,
            }),
          ],
        },
      ],
    }),
  );
  const points = deriveExercisePerformanceHistory(sessions);
  assert.deepEqual(
    points.map((p) => p.isNewMaxLoggedLoad),
    [false, false, false, true],
  );
  assert.equal(derivePersonalBests(points)[0].maxLoggedLoadKg, 65);
  assert.equal(
    derivePersonalBests(points)[0].e1rmFormulaVersion,
    EPLEY_FORMULA_VERSION,
  );
});
test("multiple records in one session are deterministic", () => {
  const s = session({
    exercises: [
      {
        ...session().exercises[0],
        sets: [
          set({
            id: "a",
            actualLoadKg: 50,
            performedAt: "2026-01-01T10:01:00.000Z",
          }),
          set({
            id: "b",
            actualLoadKg: 55,
            performedAt: "2026-01-01T10:02:00.000Z",
          }),
        ],
      },
    ],
  });
  const earlier = session({
    id: "earlier",
    startedAt: "2025-12-01T10:00:00.000Z",
    completedAt: "2025-12-01T10:10:00.000Z",
    exercises: [
      {
        ...session().exercises[0],
        sets: [
          set({
            id: "old",
            actualLoadKg: 45,
            performedAt: "2025-12-01T10:01:00.000Z",
          }),
        ],
      },
    ],
  });
  assert.deepEqual(
    deriveExercisePerformanceHistory([s, earlier]).map(
      (p) => p.isNewMaxLoggedLoad,
    ),
    [false, true, true],
  );
});
test("completed set in abandoned session contributes while skipped does not", () => {
  const abandoned = session({
    status: "abandoned",
    completedAt: null,
    abandonedAt: "2026-01-01T10:10:00.000Z",
    exercises: [
      {
        ...session().exercises[0],
        sets: [
          set(),
          set({
            id: "skip",
            status: "skipped",
            actualValue: null,
            actualLoadKg: null,
          }),
        ],
      },
    ],
  });
  const points = deriveExercisePerformanceHistory([abandoned]);
  assert.equal(points.length, 1);
  assert.equal(points[0].sessionStatus, "abandoned");
});
