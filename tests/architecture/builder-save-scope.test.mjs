import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

// Corrective pass after Implementation Phase 18 (ADR-0095/0096):
// "A partial editing surface must never imply a full-aggregate replacement."
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
async function mobileSources() {
  const entries = [];
  for (const dir of ["apps/mobile/app", "apps/mobile/src"]) {
    const found = await readdir(resolve(root, dir), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of found)
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
        entries.push(join(entry.parentPath, entry.name));
  }
  return Promise.all(
    entries.map(async (path) => ({ path, text: await readFile(path, "utf8") })),
  );
}

test("builder and editor never serialize a first-node-only structure", async () => {
  for (const path of [
    "apps/mobile/src/presentation/training/program-builder-screen.tsx",
    "packages/application/src/training/program-structure-editor.ts",
  ])
    assert.doesNotMatch(
      await read(path),
      /blocks\[0\]|weeks\[0\]|days\[0\]|prescriptions\[0\]/,
      path,
    );
});

test("every mobile structure save sends the full editor tree", async () => {
  const saves = (await mobileSources()).filter((file) =>
    /saveProgramStructure\(\s*programId/.test(file.text),
  );
  assert.equal(saves.length, 1, "one save composition point");
  assert.match(saves[0].text, /saveProgramStructure\(programId, structure\)/);
  assert.match(saves[0].text, /programToStructureInput\(program\)/);
});

test("the save RPC rejects incomplete trees and verifies the result atomically", async () => {
  const migration = await read(
    "supabase/migrations/20261005120000_full_draft_structure_preservation.sql",
  );
  assert.match(
    migration,
    /create or replace function public\.replace_training_program_structure/,
  );
  assert.equal(migration.split("Incomplete program structure").length - 1, 2);
  assert.match(migration, /Unknown structure lineage/);
  assert.match(migration, /Duplicate structure lineage/);
});
