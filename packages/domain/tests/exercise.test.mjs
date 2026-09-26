import assert from "node:assert/strict";
import test from "node:test";
import {
  exerciseRelationTypes,
  movementPatterns,
  muscleRoles,
} from "../src/index.ts";

test("exercise vocabularies are closed and contain no prescription concepts", () => {
  assert.equal(new Set(movementPatterns).size, movementPatterns.length);
  assert.deepEqual(muscleRoles, ["primary", "secondary", "stabilizer"]);
  assert.ok(exerciseRelationTypes.includes("equipment_alternative"));
  assert.ok(
    !movementPatterns.some((value) =>
      /set|rep|load|rir|rest|tempo/.test(value),
    ),
  );
});
