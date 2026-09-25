import assert from "node:assert/strict";
import test from "node:test";

import { createAthleteCoachSupabaseClient } from "../src/supabase/create-athlete-coach-supabase-client.ts";

test("rejects an invalid Supabase URL", () => {
  assert.throws(
    () =>
      createAthleteCoachSupabaseClient({
        publishableKey: "sb_publishable_test",
        url: "not-a-url",
      }),
    /must be a valid URL/,
  );
});

test("rejects a non-HTTP Supabase URL", () => {
  assert.throws(
    () =>
      createAthleteCoachSupabaseClient({
        publishableKey: "sb_publishable_test",
        url: "file:///local/database",
      }),
    /must use HTTP or HTTPS/,
  );
});

test("rejects an empty publishable key", () => {
  assert.throws(
    () =>
      createAthleteCoachSupabaseClient({
        publishableKey: "   ",
        url: "http://127.0.0.1:54321",
      }),
    /PUBLISHABLE_KEY is required/,
  );
});

test("creates a typed client from public configuration without a network request", () => {
  const client = createAthleteCoachSupabaseClient({
    publishableKey: "sb_publishable_test",
    url: "http://127.0.0.1:54321",
  });

  assert.equal(typeof client.from, "function");
  assert.equal(typeof client.auth.getSession, "function");
});
