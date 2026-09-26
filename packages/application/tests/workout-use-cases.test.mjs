import assert from "node:assert/strict";
import test from "node:test";
import {
  StartWorkoutSession,
  GetInProgressWorkoutSession,
  RecordWorkoutSet,
  SkipWorkoutSet,
  CompleteWorkoutSession,
  AbandonWorkoutSession,
} from "../src/index.ts";
const set = {
  id: "set",
  sourcePrescriptionSetId: "ps",
  sequence: 1,
  status: "pending",
  plannedMetric: "reps",
  plannedTargetMin: 8,
  plannedTargetMax: 10,
  plannedRirMin: 2,
  plannedRirMax: 2,
  plannedRestMinSeconds: 120,
  plannedRestMaxSeconds: 120,
  plannedTempo: null,
  plannedLoadKind: "absolute",
  plannedLoadKg: 30,
  actualValue: null,
  actualLoadKg: null,
  actualRir: null,
  performedAt: null,
  restStartedAt: null,
  restEndedAt: null,
};
const session = {
  id: "session",
  athleteId: "athlete",
  sourceTrainingDayId: "day",
  programName: "Program",
  dayName: "Day",
  status: "in_progress",
  athleteNotes: null,
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  abandonedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  exercises: [
    {
      id: "exercise",
      sourceExercisePrescriptionId: "ep",
      exerciseId: "x",
      sequence: 1,
      exerciseName: "X",
      plannedInstructions: null,
      plannedAthleteCues: null,
      sets: [set],
    },
  ],
};
function fake() {
  return {
    started: null,
    recorded: null,
    start(id) {
      this.started = id;
      return Promise.resolve(session);
    },
    getInProgress() {
      return Promise.resolve(session);
    },
    get() {
      return Promise.resolve(session);
    },
    list() {
      return Promise.resolve([]);
    },
    recordSet(id, input) {
      this.recorded = { id, input };
      return Promise.resolve(session);
    },
    skipSet() {
      return Promise.resolve(session);
    },
    complete() {
      return Promise.resolve(session);
    },
    abandon() {
      return Promise.resolve(session);
    },
  };
}
test("starts from a training day", async () => {
  const r = fake();
  await new StartWorkoutSession(r).execute("day");
  assert.equal(r.started, "day");
});
test("resumes the active session", async () =>
  assert.equal(
    await new GetInProgressWorkoutSession(fake()).execute(),
    session,
  ));
test("records observed performance outside target", async () => {
  const r = fake();
  await new RecordWorkoutSet(r).execute("session", "set", {
    actualValue: 12,
    actualLoadKg: 27.5,
    actualRir: 0,
  });
  assert.equal(r.recorded.input.actualValue, 12);
});
test("rejects fractional reps", async () =>
  await assert.rejects(() =>
    new RecordWorkoutSet(fake()).execute("session", "set", {
      actualValue: 8.5,
      actualLoadKg: null,
      actualRir: null,
    }),
  ));
test("skips without fabricated performance", async () =>
  assert.equal(await new SkipWorkoutSet(fake()).execute("set"), session));
test("completion rejects pending sets", async () =>
  await assert.rejects(() =>
    new CompleteWorkoutSession(fake()).execute("session"),
  ));
test("completion accepts resolved sets", async () => {
  const r = fake();
  r.get = () =>
    Promise.resolve({
      ...session,
      exercises: [
        { ...session.exercises[0], sets: [{ ...set, status: "skipped" }] },
      ],
    });
  assert.equal(await new CompleteWorkoutSession(r).execute("session"), session);
});
test("abandon delegates without rewriting sets", async () =>
  assert.equal(
    await new AbandonWorkoutSession(fake()).execute("session"),
    session,
  ));
