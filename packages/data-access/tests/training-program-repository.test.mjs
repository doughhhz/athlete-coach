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

// Corrective pass after Implementation Phase 19 (ADR-0100..0102).
test("new program creation is one atomic RPC carrying the request identity", async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "ensure_current_athlete")
        return {
          data: { id: "00000000-0000-4000-8000-00000000000a" },
          error: null,
        };
      return { data: "00000000-0000-4000-8000-0000000000aa", error: null };
    },
    from: () => {
      throw new Error("no direct table write for creation");
    },
  };
  const repository = new SupabaseTrainingProgramRepository(client);
  repository.get = async (id) => ({ id, status: "draft" });
  const structure = { blocks: [] };
  const program = await repository.createWithStructure({
    creationRequestId: "d0000000-0000-4000-8000-000000000001",
    name: "Treino A",
    structure,
  });
  assert.equal(program.id, "00000000-0000-4000-8000-0000000000aa");
  assert.deepEqual(
    calls.map((call) => call.name),
    ["ensure_current_athlete", "create_training_program_with_structure"],
  );
  assert.deepEqual(calls[1].args, {
    p_creation_request_id: "d0000000-0000-4000-8000-000000000001",
    p_name: "Treino A",
    p_structure: structure,
  });
  assert.equal(
    "p_athlete_id" in calls[1].args,
    false,
    "athlete is server-derived",
  );
});

test("creation conflict is normalized with the existing draft id", async () => {
  const { ProgramCreationConflictError } =
    await import("@athlete-coach/application");
  const client = {
    rpc: async (name) =>
      name === "ensure_current_athlete"
        ? { data: { id: "00000000-0000-4000-8000-00000000000a" }, error: null }
        : {
            data: null,
            error: { code: "23505", message: "program_creation_conflict" },
          },
    from: () => ({
      select: () => ({
        eq: (column, value) => {
          assert.equal(column, "creation_request_id");
          assert.equal(value, "d0000000-0000-4000-8000-000000000001");
          return {
            maybeSingle: async () => ({
              data: { id: "existing" },
              error: null,
            }),
          };
        },
      }),
    }),
  };
  const repository = new SupabaseTrainingProgramRepository(client);
  await assert.rejects(
    repository.createWithStructure({
      creationRequestId: "d0000000-0000-4000-8000-000000000001",
      name: "Treino B",
      structure: { blocks: [] },
    }),
    (error) =>
      error instanceof ProgramCreationConflictError &&
      error.existingProgramId === "existing",
  );
});
