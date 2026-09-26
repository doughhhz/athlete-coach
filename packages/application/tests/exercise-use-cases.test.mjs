import assert from "node:assert/strict";
import test from "node:test";
import {
  GetExerciseRelations,
  ListExercisesByEquipment,
  ListExercisesByMuscle,
  SearchExercises,
} from "../src/index.ts";

test("catalog use cases delegate explicit factual filters", async () => {
  const calls = [];
  const repository = {
    list: async (filters) => (calls.push(filters), []),
    getBySlug: async () => null,
  };
  await new SearchExercises(repository).execute("  supino  ", {
    equipmentSlug: "barbell",
  });
  await new ListExercisesByMuscle(repository).execute(
    "pectoralis-major-sternocostal",
  );
  await new ListExercisesByEquipment(repository).execute("barbell");
  assert.deepEqual(calls, [
    { equipmentSlug: "barbell", query: "supino" },
    { muscleSlug: "pectoralis-major-sternocostal" },
    { equipmentSlug: "barbell" },
  ]);
  assert.deepEqual(
    await new GetExerciseRelations(repository).execute("missing"),
    [],
  );
});
