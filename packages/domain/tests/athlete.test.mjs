import assert from "node:assert/strict";
import test from "node:test";

import { deriveAge, goalTypes } from "../src/index.ts";

test("derives age from birth date without persisting age", () => {
  assert.equal(deriveAge("2000-09-25", new Date("2026-09-25T12:00:00Z")), 26);
  assert.equal(deriveAge("2000-09-26", new Date("2026-09-25T12:00:00Z")), 25);
});

test("rejects future and impossible birth dates", () => {
  assert.throws(
    () => deriveAge("2027-01-01", new Date("2026-09-25T00:00:00Z")),
    /future/,
  );
  assert.throws(
    () => deriveAge("2020-02-30", new Date("2026-09-25T00:00:00Z")),
    /real calendar/,
  );
});

test("goal types are distinct and canonical", () => {
  assert.deepEqual(goalTypes, [
    "hypertrophy",
    "fat_loss",
    "recomposition",
    "strength",
    "general_fitness",
  ]);
});
