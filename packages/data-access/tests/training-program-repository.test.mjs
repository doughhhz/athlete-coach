import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseTrainingProgramRepository } from "../src/supabase/training-program-repository.ts";
test("training adapter sends aggregate structure through transactional RPC", async () => {
  let call;
  const client = {
    rpc: async (name, args) => {
      call = { name, args };
      return { data: null, error: null };
    },
  };
  const repository = new SupabaseTrainingProgramRepository(client);
  repository.get = async () => ({ id: "p" });
  const structure = {
    blocks: [
      {
        sequence: 1,
        name: "B",
        weeks: [
          {
            sequence: 1,
            days: [
              {
                sequence: 1,
                name: "D",
                prescriptions: [
                  {
                    sequence: 1,
                    exerciseId: "50000000-0000-4000-8000-000000000001",
                    sets: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  await repository.saveStructure("p", structure);
  assert.equal(call.name, "replace_training_program_structure");
  assert.deepEqual(call.args, { p_program_id: "p", p_structure: structure });
});
