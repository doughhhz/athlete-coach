import assert from "node:assert/strict";
import test from "node:test";

import {
  DataAccessError,
  SupabaseInitialProgramGenerationLog,
  SupabaseProgramCatalogReader,
  SupabaseProgramIntakeRepository,
} from "../src/index.ts";

const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
/** Minimal fluent fake: records calls, resolves to the configured result. */
function fakeClient(results, calls = []) {
  const query = (table) => {
    const call = { table, ops: [] };
    calls.push(call);
    const builder = {
      then(resolve, reject) {
        return Promise.resolve(results[table]).then(resolve, reject);
      },
    };
    for (const op of [
      "select",
      "eq",
      "order",
      "maybeSingle",
      "single",
      "upsert",
      "insert",
    ])
      builder[op] = (...args) => {
        call.ops.push([op, ...args]);
        return builder;
      };
    return builder;
  };
  return {
    calls,
    from: query,
    rpc: async (name) => results[`rpc:${name}`],
  };
}
const intakeRow = {
  athlete_id: athleteId,
  current_pain_or_injury: true,
  pain_or_injury_notes: "Joelho sensível",
  medical_exercise_restriction: false,
  preferred_exercises_notes: null,
  avoided_exercises_notes: "Agachamento livre",
  other_sports_notes: "Futebol",
  available_equipment: ["bench", "dumbbell"],
  updated_at: "2026-10-01T12:00:00+00:00",
};

test("intake repository maps the row and treats absence as null", async () => {
  const repository = new SupabaseProgramIntakeRepository(
    fakeClient({ athlete_program_intakes: { data: intakeRow, error: null } }),
  );
  assert.deepEqual(await repository.getCurrent(), {
    athleteId,
    currentPainOrInjury: true,
    painOrInjuryNotes: "Joelho sensível",
    medicalExerciseRestriction: false,
    preferredExercisesNotes: null,
    avoidedExercisesNotes: "Agachamento livre",
    otherSportsNotes: "Futebol",
    availableEquipment: ["bench", "dumbbell"],
    updatedAt: "2026-10-01T12:00:00+00:00",
  });
  const empty = new SupabaseProgramIntakeRepository(
    fakeClient({ athlete_program_intakes: { data: null, error: null } }),
  );
  assert.equal(await empty.getCurrent(), null);
  const malformed = new SupabaseProgramIntakeRepository(
    fakeClient({
      athlete_program_intakes: {
        data: { ...intakeRow, athlete_id: "x" },
        error: null,
      },
    }),
  );
  await assert.rejects(malformed.getCurrent(), DataAccessError);
});

test("intake repository upserts for the current athlete; empty equipment is null", async () => {
  const calls = [];
  const repository = new SupabaseProgramIntakeRepository(
    fakeClient(
      {
        "rpc:current_athlete_id": { data: athleteId, error: null },
        athlete_program_intakes: { data: intakeRow, error: null },
      },
      calls,
    ),
  );
  await repository.saveCurrent({
    currentPainOrInjury: false,
    medicalExerciseRestriction: false,
    availableEquipment: [],
  });
  await repository.saveCurrent({
    currentPainOrInjury: true,
    painOrInjuryNotes: "Joelho sensível",
    medicalExerciseRestriction: false,
    availableEquipment: ["dumbbell", "bench", "dumbbell"],
  });
  const upserts = calls.map(
    (call) => call.ops.find(([op]) => op === "upsert")[1],
  );
  assert.equal(upserts[0].athlete_id, athleteId);
  assert.equal(upserts[0].available_equipment, null);
  assert.equal(upserts[0].pain_or_injury_notes, null);
  assert.deepEqual(upserts[1].available_equipment, ["bench", "dumbbell"]);
  const failing = new SupabaseProgramIntakeRepository(
    fakeClient({
      "rpc:current_athlete_id": { data: null, error: { message: "no" } },
    }),
  );
  await assert.rejects(
    failing.saveCurrent({
      currentPainOrInjury: false,
      medicalExerciseRestriction: false,
    }),
    DataAccessError,
  );
});

test("catalog reader returns active exercises with equipment slugs", async () => {
  const calls = [];
  const reader = new SupabaseProgramCatalogReader(
    fakeClient(
      {
        exercises: {
          data: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              slug: "barbell-bench-press",
              name_pt: "Supino reto com barra",
              movement_pattern: "horizontal_push",
              mechanics: "compound",
              laterality: "bilateral",
              difficulty: "intermediate",
              exercise_equipment: [
                { equipment: { slug: "bench" } },
                { equipment: { slug: "barbell" } },
              ],
            },
          ],
          error: null,
        },
      },
      calls,
    ),
  );
  const [exercise] = await reader.listForProgram();
  assert.deepEqual(exercise.equipmentSlugs, ["barbell", "bench"]);
  assert.equal(exercise.namePt, "Supino reto com barra");
  assert.deepEqual(
    calls[0].ops.find(([op]) => op === "eq"),
    ["eq", "is_active", true],
  );
  const invalid = new SupabaseProgramCatalogReader(
    fakeClient({ exercises: { data: [{ id: "x" }], error: null } }),
  );
  await assert.rejects(invalid.listForProgram(), DataAccessError);
});

test("generation log resolves the athlete from the authenticated user", async () => {
  const calls = [];
  const log = new SupabaseInitialProgramGenerationLog(
    fakeClient(
      {
        athletes: { data: { id: athleteId }, error: null },
        initial_program_generations: { data: null, error: null },
      },
      calls,
    ),
    "11111111-1111-4111-8111-111111111111",
  );
  await log.record({
    programId: "f0000000-0000-4000-8000-000000000001",
    origin: "basic",
    provider: null,
    model: null,
    promptVersion: null,
    envelopeVersion: "initial-program-envelope-v1",
    specVersion: "personal-spec-v1",
    repaired: false,
  });
  assert.deepEqual(
    calls[0].ops.find(([op]) => op === "eq"),
    ["eq", "user_id", "11111111-1111-4111-8111-111111111111"],
  );
  const row = calls[1].ops.find(([op]) => op === "insert")[1];
  assert.equal(row.athlete_id, athleteId);
  assert.equal(row.origin, "basic");
  assert.equal(row.spec_version, "personal-spec-v1");
  const failing = new SupabaseInitialProgramGenerationLog(
    fakeClient({
      athletes: { data: { id: athleteId }, error: null },
      initial_program_generations: { data: null, error: { code: "23503" } },
    }),
    "u",
  );
  await assert.rejects(
    failing.record({
      programId: "p",
      origin: "basic",
      provider: null,
      model: null,
      promptVersion: null,
      envelopeVersion: "e",
      specVersion: "s",
      repaired: false,
    }),
    DataAccessError,
  );
});
