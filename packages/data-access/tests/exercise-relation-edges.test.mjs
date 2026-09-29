import assert from "node:assert/strict";
import test from "node:test";
import { DataAccessError } from "../src/supabase/supabase-repositories.ts";
import { SupabaseExerciseCatalogRepository } from "../src/supabase/exercise-catalog-repositories.ts";

const A = "50000000-0000-4000-8000-000000000001";
const B = "50000000-0000-4000-8000-000000000002";
function client(result, calls = []) {
  const builder = {
    select(columns) {
      calls.push(["select", columns]);
      return builder;
    },
    or(filter) {
      calls.push(["or", filter]);
      return builder;
    },
    order(column) {
      calls.push(["order", column]);
      return calls.filter((call) => call[0] === "order").length === 3
        ? Promise.resolve(result)
        : builder;
    },
  };
  return {
    from(table) {
      calls.push(["from", table]);
      return builder;
    },
  };
}

test("relation edges keep stored direction and use a deterministic order", async () => {
  const calls = [];
  const edges = await new SupabaseExerciseCatalogRepository(
    client(
      {
        data: [
          {
            source_exercise_id: B,
            target_exercise_id: A,
            relation_type: "variation_of",
          },
        ],
        error: null,
      },
      calls,
    ),
  ).listRelationEdges([A, A, "not-a-uuid,target_exercise_id.neq.x"]);
  assert.deepEqual(edges, [
    { sourceExerciseId: B, targetExerciseId: A, relationType: "variation_of" },
  ]);
  assert.deepEqual(calls[0], ["from", "exercise_relations"]);
  assert.deepEqual(
    calls.find((call) => call[0] === "or"),
    ["or", `source_exercise_id.in.(${A}),target_exercise_id.in.(${A})`],
  );
  assert.deepEqual(
    calls.filter((call) => call[0] === "order").map((call) => call[1]),
    ["source_exercise_id", "target_exercise_id", "relation_type"],
  );
});

test("no query without valid ids; invalid rows and errors fail safely", async () => {
  const calls = [];
  assert.deepEqual(
    await new SupabaseExerciseCatalogRepository(
      client({ data: [], error: null }, calls),
    ).listRelationEdges(["x"]),
    [],
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    () =>
      new SupabaseExerciseCatalogRepository(
        client({
          data: [
            {
              source_exercise_id: A,
              target_exercise_id: B,
              relation_type: "equivalent",
            },
          ],
          error: null,
        }),
      ).listRelationEdges([A]),
    DataAccessError,
  );
  await assert.rejects(
    () =>
      new SupabaseExerciseCatalogRepository(
        client({ data: null, error: { message: "denied" } }),
      ).listRelationEdges([A]),
    DataAccessError,
  );
});
