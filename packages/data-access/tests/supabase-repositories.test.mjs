import assert from "node:assert/strict";
import test from "node:test";

import {
  DataAccessError,
  SupabaseAthleteRepository,
} from "../src/supabase/supabase-repositories.ts";

test("athlete repository maps a valid external row", async () => {
  const repository = new SupabaseAthleteRepository({
    async rpc() {
      return {
        data: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          onboarding_completed_at: null,
          user_id: "11111111-1111-4111-8111-111111111111",
        },
        error: null,
      };
    },
  });

  assert.deepEqual(await repository.ensureCurrent(), {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    onboardingCompletedAt: null,
    userId: "11111111-1111-4111-8111-111111111111",
  });
});

test("athlete repository rejects a malformed external row safely", async () => {
  const repository = new SupabaseAthleteRepository({
    async rpc() {
      return {
        data: {
          id: "not-a-uuid",
          onboarding_completed_at: null,
          user_id: "also-invalid",
        },
        error: null,
      };
    },
  });

  await assert.rejects(
    repository.ensureCurrent(),
    (error) =>
      error instanceof DataAccessError &&
      error.message === "A identidade retornada pelo servidor é inválida.",
  );
});
