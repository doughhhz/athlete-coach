import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

// ADR-0104: "Training structure mutation is an aggregate operation, not
// table-level client authority."
const root = resolve(import.meta.dirname, "../..");
const structureTables = [
  "training_blocks",
  "training_weeks",
  "training_days",
  "exercise_prescriptions",
  "prescription_sets",
];
async function sources(dirs) {
  const files = [];
  for (const dir of dirs)
    for (const entry of await readdir(resolve(root, dir), {
      recursive: true,
      withFileTypes: true,
    }))
      if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name))
        files.push(join(entry.parentPath, entry.name));
  return Promise.all(
    files.map(async (path) => ({ path, text: await readFile(path, "utf8") })),
  );
}

test("production code never mutates structure tables directly", async () => {
  const production = await sources([
    "apps/mobile/app",
    "apps/mobile/src",
    "packages/application/src",
    "packages/data-access/src/supabase",
    "packages/domain/src",
    "packages/ai/src",
    "supabase/functions",
  ]);
  for (const file of production)
    for (const table of structureTables)
      assert.doesNotMatch(
        file.text,
        new RegExp(
          String.raw`from\(\s*["'\`]${table}["'\`]\s*\)[\s\S]{0,80}?\.(insert|update|delete|upsert)\(`,
        ),
        `${file.path} mutates ${table}`,
      );
});

test("draft structure writes go through the full-tree save only", async () => {
  const repository = await readFile(
    resolve(
      root,
      "packages/data-access/src/supabase/training-program-repository.ts",
    ),
    "utf8",
  );
  assert.match(repository, /"replace_training_program_structure"/);
  for (const table of structureTables)
    assert.doesNotMatch(
      repository,
      new RegExp(String.raw`from\(\s*"${table}"`),
    );
});

test("the database makes structure tables client read-only", async () => {
  const migration = await readFile(
    resolve(
      root,
      "supabase/migrations/20261008120000_enforce_training_structure_mutation_boundary.sql",
    ),
    "utf8",
  );
  assert.match(
    migration,
    /revoke insert, update, delete on[\s\S]*from authenticated, anon;/,
  );
  for (const table of structureTables) {
    assert.match(
      migration,
      new RegExp(String.raw`drop policy ${table}_own on public\.${table};`),
    );
    assert.match(
      migration,
      new RegExp(
        String.raw`create policy ${table}_own_select on public\.${table} for select to authenticated`,
      ),
    );
  }
  assert.match(
    migration,
    /alter function public\.replace_training_program_structure\(uuid,jsonb\) security definer;/,
  );
  assert.doesNotMatch(migration, /grant (all|insert|update|delete)/i);
  assert.doesNotMatch(migration, /for (insert|update|delete|all) to/);
});
