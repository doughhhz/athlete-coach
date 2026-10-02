import assert from "node:assert/strict";
import test from "node:test";
import { currentWorkoutPosition, workoutSetProgress } from "../src/index.ts";

const set = (id, sequence, status = "pending") => ({ id, sequence, status });
const session = (exercises) => ({ exercises });
const exercise = (id, sequence, sets) => ({ id, sequence, sets });

test("set progress counts completed and skipped sets", () => {
  assert.deepEqual(
    workoutSetProgress(
      session([
        exercise("a", 1, [
          set("1", 1, "completed"),
          set("2", 2, "skipped"),
          set("3", 3),
        ]),
      ]),
    ),
    { resolved: 2, total: 3, percent: 67 },
  );
  assert.deepEqual(workoutSetProgress(session([])), {
    resolved: 0,
    total: 0,
    percent: 0,
  });
});

test("current position is the first pending set, in sequence order", () => {
  const value = session([
    exercise("b", 2, [set("b1", 1)]),
    exercise("a", 1, [set("a2", 2), set("a1", 1, "completed")]),
  ]);
  assert.deepEqual(currentWorkoutPosition(value), {
    exerciseId: "a",
    setId: "a2",
  });
  // A chosen exercise wins while it still has pending sets.
  assert.deepEqual(currentWorkoutPosition(value, "b"), {
    exerciseId: "b",
    setId: "b1",
  });
});

test("without pending sets: next exercise, else the last set to correct", () => {
  const value = session([
    exercise("a", 1, [set("a1", 1, "completed"), set("a2", 2, "completed")]),
    exercise("b", 2, [set("b1", 1)]),
  ]);
  // The chosen exercise is finished: move on to the next pending set.
  assert.deepEqual(currentWorkoutPosition(value, "a"), {
    exerciseId: "b",
    setId: "b1",
  });
  const done = session([
    exercise("a", 1, [set("a1", 1, "completed"), set("a2", 2, "skipped")]),
  ]);
  assert.deepEqual(currentWorkoutPosition(done), {
    exerciseId: "a",
    setId: "a2",
  });
  assert.deepEqual(currentWorkoutPosition(done, "a"), {
    exerciseId: "a",
    setId: "a2",
  });
  assert.equal(currentWorkoutPosition(session([])), null);
});

test("sets open in order: resolved ones and only the first pending", async () => {
  const { selectableWorkoutSetIds } = await import("../src/index.ts");
  const ids = (sets) => [...selectableWorkoutSetIds({ sets })].sort();
  assert.deepEqual(ids([set("3", 3), set("1", 1, "completed"), set("2", 2)]), [
    "1",
    "2",
  ]);
  assert.deepEqual(ids([set("1", 1), set("2", 2), set("3", 3)]), ["1"]);
  // Skipped sets count as resolved; a correction stays possible.
  assert.deepEqual(
    ids([set("1", 1, "skipped"), set("2", 2, "completed"), set("3", 3)]),
    ["1", "2", "3"],
  );
  assert.deepEqual(ids([set("1", 1, "completed"), set("2", 2, "completed")]), [
    "1",
    "2",
  ]);
});
