import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

// Corrective pass after Implementation Phase 19 (ADR-0100..0102):
// "Creating a training program is one transactional user intent, not a
// sequence of independently durable mutations."
const root = resolve(import.meta.dirname, "../..");
async function sources(dirs) {
  const files = [];
  for (const dir of dirs)
    for (const entry of await readdir(resolve(root, dir), {
      recursive: true,
      withFileTypes: true,
    }))
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
        files.push(join(entry.parentPath, entry.name));
  return Promise.all(
    files.map(async (path) => ({ path, text: await readFile(path, "utf8") })),
  );
}

test("mobile has one atomic creation boundary, never create-then-save", async () => {
  const mobile = await sources(["apps/mobile/app", "apps/mobile/src"]);
  for (const file of mobile) {
    assert.doesNotMatch(
      file.text,
      /createProgramDraft|CreateTrainingProgramDraft/,
      file.path,
    );
    assert.doesNotMatch(
      file.text,
      /from\("training_programs"\)\s*\.insert/,
      file.path,
    );
  }
  assert.ok(
    mobile.some((file) => /app\.createProgramWithStructure\(/.test(file.text)),
  );
});

test("the creation RPC is reached only through the dedicated repository operation", async () => {
  const code = await sources([
    "apps/mobile/src",
    "packages/application/src",
    "packages/data-access/src/supabase",
  ]);
  const callers = code
    .filter((file) =>
      /"create_training_program_with_structure"/.test(file.text),
    )
    .map((file) => file.path.replaceAll("\\", "/").split("/").at(-1));
  assert.deepEqual(callers, ["training-program-repository.ts"]);
  const repository = code.find((file) =>
    file.path.endsWith("training-program-repository.ts"),
  ).text;
  const create = repository.match(
    /async createWithStructure\([\s\S]*?\n  \}/,
  )[0];
  assert.doesNotMatch(
    create,
    /p_athlete_id|athlete_id:|lineage/i,
    "athlete and lineage are server-derived",
  );
});

test("the migration reuses the canonical structure writer instead of copying it", async () => {
  const migration = await readFile(
    resolve(
      root,
      "supabase/migrations/20261006120000_atomic_program_creation.sql",
    ),
    "utf8",
  );
  assert.match(
    migration,
    /perform public\.replace_training_program_structure\(program_id, p_structure\)/,
  );
  assert.doesNotMatch(
    migration,
    /insert into public\.(training_blocks|training_weeks|training_days|exercise_prescriptions|prescription_sets)/,
  );
  // Activation stays human-only: no activation call, timestamp or transition.
  assert.doesNotMatch(
    migration,
    /activate_training_program|activated_at\s*=|app\.training_program_transition|'active'/,
  );
});

// ADR-0103: "Initial TrainingProgram creation is only permitted through the
// atomic creation boundary." / "RLS ownership is not sufficient authority to
// create a TrainingProgram root."
test("no production code inserts program rows directly or keeps an empty-draft API", async () => {
  const production = await sources([
    "apps/mobile/app",
    "apps/mobile/src",
    "packages/application/src",
    "packages/data-access/src/supabase",
    "packages/domain/src",
  ]);
  for (const file of production) {
    assert.doesNotMatch(
      file.text,
      /from\(\s*["']training_programs["']\s*\)\s*\.(insert|upsert)\(/,
      file.path,
    );
    assert.doesNotMatch(
      file.text,
      /\bcreateDraft\b|CreateTrainingProgramDraft|createProgramDraftInputSchema/,
      file.path,
    );
  }
});

test("the database revokes client INSERT on program rows and keeps the creators controlled", async () => {
  const migration = await readFile(
    resolve(
      root,
      "supabase/migrations/20261007120000_enforce_atomic_program_creation_boundary.sql",
    ),
    "utf8",
  );
  assert.match(
    migration,
    /revoke insert on public\.training_programs from authenticated, anon;/,
  );
  assert.match(
    migration,
    /alter function public\.create_training_program_with_structure\(uuid,text,jsonb,text,uuid\) security definer;/,
  );
  assert.match(
    migration,
    /alter function public\.clone_training_program_as_draft\(uuid\) security definer;/,
  );
  assert.doesNotMatch(migration, /grant (all|insert)[^;]*training_programs/i);
  assert.doesNotMatch(migration, /for (insert|all) to authenticated/);
});
