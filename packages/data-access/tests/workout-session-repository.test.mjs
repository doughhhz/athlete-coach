import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseWorkoutSessionRepository } from "../src/supabase/workout-session-repository.ts";

test("workout adapter records observed data through guarded RPC", async () => {
  let call;
  const client = {
    rpc: async (name, args) => {
      call = { name, args };
      return { data: null, error: null };
    },
  };
  const repository = new SupabaseWorkoutSessionRepository(client);
  repository.findBySet = async () => ({ id: "session" });
  const result = await repository.recordSet("set", {
    actualValue: 12,
    actualLoadKg: 27.5,
    actualRir: 0,
  });
  assert.equal(result.id, "session");
  assert.deepEqual(call, {
    name: "record_workout_set",
    args: {
      p_set_id: "set",
      p_actual_value: 12,
      p_actual_load_kg: 27.5,
      p_actual_rir: 0,
    },
  });
});

test("workout adapter does not send absent optional performance as invented values", async () => {
  let args;
  const client = {
    rpc: async (_name, input) => {
      args = input;
      return { data: null, error: null };
    },
  };
  const repository = new SupabaseWorkoutSessionRepository(client);
  repository.findBySet = async () => ({ id: "session" });
  await repository.recordSet("set", {
    actualValue: 30,
    actualLoadKg: null,
    actualRir: null,
  });
  assert.deepEqual(args, { p_set_id: "set", p_actual_value: 30 });
});
