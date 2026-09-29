import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanDraftEditSession,
  CreateTrainingProgramWithStructure,
  draftEditTransition,
  ProgramCreationConflictError,
  shouldGuardDraftLeave,
} from "../src/index.ts";

// Corrective pass after Implementation Phase 19 (ADR-0100..0102): new program
// creation is one atomic, idempotent intent.
const set = {
  sequence: 1,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 1,
  rirMax: 2,
  restMinSeconds: 90,
  restMaxSeconds: 150,
  tempo: null,
  loadKind: "athlete_selected",
  loadKg: null,
};
const day = (sequence, name) => ({
  sequence,
  name,
  prescriptions: [
    {
      sequence: 1,
      exerciseId: "50000000-0000-4000-8000-000000000001",
      sets: [set],
    },
  ],
});
const structure = {
  blocks: [
    {
      sequence: 1,
      name: "A",
      weeks: [{ sequence: 1, days: [day(1, "D1"), day(2, "D2")] }],
    },
    { sequence: 2, name: "B", weeks: [{ sequence: 1, days: [day(1, "D3")] }] },
  ],
};
const REQUEST = "d0000000-0000-4000-8000-000000000001";
/** Fake idempotent backend: one program per request id; conflicts on change. */
function backend({ failFirst = 0 } = {}) {
  const calls = [];
  const programs = new Map();
  let failures = failFirst;
  return {
    calls,
    programs,
    repository: {
      async createWithStructure(input) {
        calls.push(structuredClone(input));
        if (failures > 0) {
          failures -= 1;
          throw new Error("Falha de rede.");
        }
        const key = JSON.stringify([input.name, input.structure]);
        const existing = programs.get(input.creationRequestId);
        if (existing && existing.key !== key)
          throw new ProgramCreationConflictError(existing.program.id);
        if (existing) return existing.program;
        const program = {
          id: `program-${programs.size + 1}`,
          name: input.name,
          status: "draft",
        };
        programs.set(input.creationRequestId, { key, program });
        return program;
      },
    },
  };
}
const input = () => ({
  creationRequestId: REQUEST,
  name: "Treino A",
  structure: structuredClone(structure),
});

test("one call creates the draft with its complete tree and request id", async () => {
  const fake = backend();
  const program = await new CreateTrainingProgramWithStructure(
    fake.repository,
  ).execute(input());
  assert.equal(program.status, "draft");
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].creationRequestId, REQUEST);
  assert.deepEqual(fake.calls[0].structure, structure, "full tree sent");
});

test("network-like failure keeps the local tree; the retry reuses the same request id", async () => {
  const fake = backend({ failFirst: 1 });
  const useCase = new CreateTrainingProgramWithStructure(fake.repository);
  const local = input();
  let session = draftEditTransition(cleanDraftEditSession, "edited");
  session = draftEditTransition(session, "save_started");
  await assert.rejects(useCase.execute(local), /Falha de rede/);
  session = draftEditTransition(session, "save_failed");
  assert.equal(shouldGuardDraftLeave(session), true, "dirty after failure");
  assert.deepEqual(local.structure, structure, "local tree untouched");
  session = draftEditTransition(session, "save_started");
  const program = await useCase.execute(local);
  session = draftEditTransition(session, "save_succeeded");
  assert.equal(shouldGuardDraftLeave(session), false, "clean after success");
  assert.deepEqual(
    fake.calls.map((call) => call.creationRequestId),
    [REQUEST, REQUEST],
  );
  assert.equal(program.id, "program-1");
  assert.equal(fake.programs.size, 1);
});

test("lost response: retrying the same intent resolves to the same draft", async () => {
  const fake = backend();
  const useCase = new CreateTrainingProgramWithStructure(fake.repository);
  const first = await useCase.execute(input());
  const retry = await useCase.execute(input());
  assert.equal(retry.id, first.id);
  assert.equal(fake.programs.size, 1);
});

test("same request id with a changed payload is a normalized conflict", async () => {
  const fake = backend();
  const useCase = new CreateTrainingProgramWithStructure(fake.repository);
  const first = await useCase.execute(input());
  await assert.rejects(
    useCase.execute({ ...input(), name: "Treino B" }),
    (error) =>
      error instanceof ProgramCreationConflictError &&
      error.existingProgramId === first.id &&
      /Nada foi alterado/.test(error.message),
  );
  assert.equal(fake.programs.size, 1);
  assert.equal(fake.programs.get(REQUEST).program.name, "Treino A");
});

test("creation input is validated before the repository: request id, tree, no lineage", async () => {
  const fake = backend();
  const useCase = new CreateTrainingProgramWithStructure(fake.repository);
  await assert.rejects(async () =>
    useCase.execute({ ...input(), creationRequestId: "x" }),
  );
  await assert.rejects(async () =>
    useCase.execute({ ...input(), creationRequestId: undefined }),
  );
  await assert.rejects(async () =>
    useCase.execute({ ...input(), structure: { blocks: [] } }),
  );
  const withLineage = input();
  withLineage.structure.blocks[0].weeks[0].days[0].lineageId =
    "00000000-0000-4000-8000-000000000009";
  await assert.rejects(async () => useCase.execute(withLineage), /linhagem/);
  const emptyDay = input();
  emptyDay.structure.blocks[1].weeks[0].days[0].prescriptions = [];
  await assert.rejects(async () => useCase.execute(emptyDay));
  assert.equal(fake.calls.length, 0, "nothing reached the repository");
});
