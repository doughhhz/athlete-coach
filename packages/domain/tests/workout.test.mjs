import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkoutSetPerformance,
  canCompleteWorkout,
  canTransitionWorkout,
  workoutDurationSeconds,
} from "../src/index.ts";
for (const metric of ["reps", "seconds", "meters"])
  test(`accepts observed ${metric} outside planned ranges`, () =>
    assert.doesNotThrow(() =>
      assertWorkoutSetPerformance(metric, {
        actualValue: metric === "reps" ? 12 : 12.5,
        actualLoadKg: 0,
        actualRir: 0,
      }),
    ));
test("reps must be integral", () =>
  assert.throws(() =>
    assertWorkoutSetPerformance("reps", {
      actualValue: 8.5,
      actualLoadKg: null,
      actualRir: null,
    }),
  ));
test("actual values must be positive", () =>
  assert.throws(() =>
    assertWorkoutSetPerformance("seconds", {
      actualValue: 0,
      actualLoadKg: null,
      actualRir: null,
    }),
  ));
test("load cannot be negative", () =>
  assert.throws(() =>
    assertWorkoutSetPerformance("reps", {
      actualValue: 8,
      actualLoadKg: -1,
      actualRir: null,
    }),
  ));
test("RIR is optional and bounded", () => {
  assert.doesNotThrow(() =>
    assertWorkoutSetPerformance("reps", {
      actualValue: 8,
      actualLoadKg: null,
      actualRir: null,
    }),
  );
  assert.throws(() =>
    assertWorkoutSetPerformance("reps", {
      actualValue: 8,
      actualLoadKg: null,
      actualRir: 11,
    }),
  );
});
const session = {
  id: "s",
  athleteId: "a",
  sourceTrainingDayId: "d",
  programName: "P",
  dayName: "D",
  status: "in_progress",
  athleteNotes: null,
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  abandonedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  exercises: [
    {
      id: "e",
      sourceExercisePrescriptionId: "p",
      exerciseId: "x",
      sequence: 1,
      exerciseName: "X",
      plannedInstructions: null,
      plannedAthleteCues: null,
      sets: [{ status: "completed" }],
    },
  ],
};
test("completion eligibility requires every set resolved", () => {
  assert.equal(canCompleteWorkout(session), true);
  assert.equal(
    canCompleteWorkout({
      ...session,
      exercises: [{ ...session.exercises[0], sets: [{ status: "pending" }] }],
    }),
    false,
  );
});
test("only active sessions transition", () => {
  assert.equal(canTransitionWorkout("in_progress", "completed"), true);
  assert.equal(canTransitionWorkout("completed", "abandoned"), false);
});
test("duration is derived from timestamps", () =>
  assert.equal(
    workoutDurationSeconds({
      ...session,
      status: "completed",
      completedAt: "2026-01-01T00:02:01.000Z",
    }),
    121,
  ));
