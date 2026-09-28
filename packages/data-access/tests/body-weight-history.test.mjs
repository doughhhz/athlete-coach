import assert from "node:assert/strict";
import test from "node:test";
import {
  DataAccessError,
  SupabaseBodyWeightRepository,
} from "../src/supabase/supabase-repositories.ts";

function client(result, calls = []) {
  const builder = {
    select(columns) {
      calls.push(["select", columns]);
      return builder;
    },
    order(column, options) {
      calls.push(["order", column, options]);
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

test("body weight history is read-only, RLS-scoped and chronologically ordered", async () => {
  const calls = [];
  const rows = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      measured_at: "2026-09-01T08:00:00+00:00",
      weight_kg: 80.4,
      source: "manual",
      created_at: "2026-09-01T08:00:00+00:00",
    },
  ];
  const result = await new SupabaseBodyWeightRepository(
    client({ data: rows, error: null }, calls),
  ).list();
  assert.deepEqual(result, [
    {
      athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      measuredAt: "2026-09-01T08:00:00+00:00",
      source: "manual",
      weightKg: 80.4,
    },
  ]);
  assert.deepEqual(calls[0], ["from", "body_weight_entries"]);
  assert.deepEqual(
    calls.filter((call) => call[0] === "order").map((call) => call[1]),
    ["measured_at", "created_at", "id"],
  );
});

test("body weight history handles empty, invalid and failed reads safely", async () => {
  assert.deepEqual(
    await new SupabaseBodyWeightRepository(
      client({ data: null, error: null }),
    ).list(),
    [],
  );
  await assert.rejects(() =>
    new SupabaseBodyWeightRepository(
      client({ data: [{ id: "bad" }], error: null }),
    ).list(),
  );
  await assert.rejects(
    () =>
      new SupabaseBodyWeightRepository(
        client({ data: null, error: { message: "denied" } }),
      ).list(),
    DataAccessError,
  );
});
