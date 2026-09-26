import assert from "node:assert/strict";
import test from "node:test";
import { SupabasePerformanceReadRepository } from "../src/supabase/performance-read-repository.ts";
import { mapWorkoutSession } from "../src/supabase/workout-session-repository.ts";
test("performance read repository requests historical sessions chronologically", async () => {
  const calls = [];
  const query = {
    select(value) {
      calls.push(["select", value]);
      return this;
    },
    neq(column, value) {
      calls.push(["neq", column, value]);
      return this;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return this;
    },
    then(resolve) {
      return Promise.resolve(resolve({ data: [], error: null }));
    },
  };
  const repository = new SupabasePerformanceReadRepository({
    from(table) {
      calls.push(["from", table]);
      return query;
    },
  });
  assert.deepEqual(await repository.listHistoricalSessions(), []);
  assert.deepEqual(calls.at(-1), ["order", "started_at", { ascending: true }]);
  assert.ok(
    calls.some((call) => call[0] === "neq" && call[2] === "in_progress"),
  );
});
test("workout mapper rejects malformed external payload", () =>
  assert.throws(() => mapWorkoutSession({ id: "not-a-uuid" })));
