import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Implementation Phase 18 (ADR-0091..0094): one canonical structural matcher.
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("review evidence and outcome fidelity use the canonical lineage matcher", async () => {
  for (const path of [
    "packages/domain/src/coach-draft-review/draft-review.ts",
    "packages/domain/src/outcomes/outcomes.ts",
  ]) {
    const source = await read(path);
    assert.match(source, /from "\.\.\/training\/lineage\.ts"/, path);
    assert.match(source, /structureMatchingStrategy/, path);
    assert.match(source, /matchSets|matchPrescriptions/, path);
  }
  const review = await read(
    "packages/domain/src/coach-draft-review/draft-review.ts",
  );
  assert.doesNotMatch(
    review,
    /reviewedPrescription\.sets\.find\(\s*\(set\) => set\.sequence ===/,
    "no private positional set matching in review evidence",
  );
});

test("lineage matching lives only in the training lineage module", async () => {
  const lineage = await read("packages/domain/src/training/lineage.ts");
  assert.match(lineage, /export function matchPrescriptions/);
  assert.match(lineage, /export function matchSets/);
  assert.match(lineage, /"legacy_position"/);
  for (const path of [
    "packages/domain/src/coach-draft-review/draft-review.ts",
    "packages/domain/src/outcomes/outcomes.ts",
    "packages/application/src/coach/draft-review-use-cases.ts",
  ])
    assert.doesNotMatch(
      await read(path),
      /function match(Prescriptions|Sets)\b/,
      `${path} must not define its own matcher`,
    );
});

test("every structure-copy path in the database preserves lineage", async () => {
  const migration = await read(
    "supabase/migrations/20261004120000_training_structure_lineage.sql",
  );
  for (const fn of [
    "clone_training_program_as_draft",
    "replace_training_program_structure",
    "materialize_coach_decision",
  ])
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${fn}`),
      fn,
    );
  for (const table of [
    "training_blocks",
    "training_weeks",
    "training_days",
    "exercise_prescriptions",
    "prescription_sets",
  ]) {
    assert.match(
      migration,
      new RegExp(`insert into public\\.${table}\\(lineage_id,`),
      table,
    );
    assert.match(
      migration,
      new RegExp(`create trigger ${table}_lineage`),
      table,
    );
  }
});

test("lineage never widens authority or reaches the model as raw ids", async () => {
  const policy = await read(
    "packages/domain/src/coach-auto-draft/auto-draft.ts",
  );
  assert.doesNotMatch(policy, /lineage/i);
  const prompts = [
    await read("packages/ai/src/prompt.ts"),
    await read("packages/ai/src/proposal.ts"),
  ].join("\n");
  assert.doesNotMatch(prompts, /lineageId/);
});
