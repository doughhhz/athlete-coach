import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Implementation Phase 17 (ADR-0088/0090): "Auto-draft authority may not
// expand itself from review history." Review evidence is supervision
// evidence only; it never feeds any authority policy.
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const reviewModule = /coach-draft-review|draft-review|DraftReview|draftReview/;

test("auto-draft policy and orchestration never import review evidence", async () => {
  for (const path of [
    "packages/domain/src/coach-auto-draft/auto-draft.ts",
    "packages/domain/src/coach-governance/governance.ts",
    "packages/application/src/coach/auto-draft-use-cases.ts",
    "packages/application/src/coach/governance-use-cases.ts",
    "packages/application/src/coach/proposal-use-cases.ts",
  ])
    assert.doesNotMatch(await read(path), reviewModule, path);
});

test("coach-auto-draft-v1 eligible set is exactly the three scalar directions", async () => {
  const policy = await read(
    "packages/domain/src/coach-auto-draft/auto-draft.ts",
  );
  assert.match(
    policy,
    /COACH_AUTO_DRAFT_POLICY_VERSION = "coach-auto-draft-v1"/,
  );
  const block = policy.slice(
    policy.indexOf("const eligibleByKind"),
    policy.indexOf("};", policy.indexOf("const eligibleByKind")),
  );
  assert.deepEqual(
    [...block.matchAll(/(\w+): "(\w+)"/g)].map(
      (match) => `${match[1]}=${match[2]}`,
    ),
    [
      "adjust_prescription_rir=planned_rir_increase",
      "adjust_prescription_rest=planned_rest_increase",
      "adjust_absolute_load_target=absolute_load_decrease",
    ],
  );
});

test("review evidence carries no score, rate, reward or trust vocabulary", async () => {
  const sources = [
    await read("packages/domain/src/coach-draft-review/draft-review.ts"),
    await read("packages/application/src/coach/draft-review-use-cases.ts"),
  ].join("\n");
  const code = sources.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(
    code,
    /score|Rate\b|rate:|percent|reward|trust|accept|success|correct|quality/i,
  );
});

test("review evidence has no path to activation, materialization or ledger writes", async () => {
  for (const path of [
    "packages/domain/src/coach-draft-review/draft-review.ts",
    "packages/application/src/coach/draft-review-use-cases.ts",
  ]) {
    const source = await read(path);
    assert.doesNotMatch(
      source,
      /activateProgram|activate_training_program|\.activate\(|materialize\(|autoDraft\(|\.create\(|\.reject\(|setDraftAuthorityMode|setAutonomyMode/,
      path,
    );
  }
});

test("Implementation Phase 17 is derived-only (no new migration)", async () => {
  const migrations = (await readdir(resolve(root, "supabase/migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(
    migrations.at(-1),
    "20261003120000_conservative_auto_draft_authority.sql",
  );
});
