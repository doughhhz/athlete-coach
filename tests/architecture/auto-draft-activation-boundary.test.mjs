import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// ADR-0086: "Automatic draft creation is limited authority over an inactive
// revision, never authority over the active training program." There is no
// code path Coach → activation or Coach → active program mutation.
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const activation =
  /activate_training_program|activateProgram|ActivateTrainingProgram|\.activate\(|transition_training_program|status\s*=\s*'active'|status:\s*"active"/;

test("auto-draft application and domain code has no activation path", async () => {
  for (const path of [
    "packages/domain/src/coach-auto-draft/auto-draft.ts",
    "packages/application/src/coach/auto-draft-use-cases.ts",
    "packages/application/src/coach/governance-use-cases.ts",
    "supabase/functions/coach-analyze/index.ts",
  ])
    assert.doesNotMatch(await read(path), activation, path);
});

test("the auto-draft RPC only creates an inactive draft through the single engine", async () => {
  const migration = await read(
    "supabase/migrations/20261003120000_conservative_auto_draft_authority.sql",
  );
  const body = migration.slice(
    migration.indexOf("create function public.auto_draft_coach_decision"),
    migration.indexOf(
      "revoke all on function public.auto_draft_coach_decision",
    ),
  );
  assert.ok(body.length > 0);
  assert.doesNotMatch(
    body,
    /activate_training_program|transition_training_program|insert into public\.training_programs|update public\.training_programs/,
  );
  assert.match(
    body,
    /public\.materialize_coach_decision\(p_user_id, p_decision_id\)/,
  );
  assert.match(body, /Auto-draft must produce an inactive draft/);
  assert.match(body, /supersedes_program_id=decision\.source_program_id/);
  assert.match(
    migration,
    /grant execute on function public\.auto_draft_coach_decision\(uuid,uuid\) to service_role;/,
  );
  assert.match(
    migration,
    /revoke all on function public\.auto_draft_coach_decision\(uuid,uuid\) from public, anon, authenticated;/,
  );
});

test("the domain policy never allows automatic activation", async () => {
  const policy = await read(
    "packages/domain/src/coach-auto-draft/auto-draft.ts",
  );
  assert.match(policy, /allowsAutomaticActivation: false/);
  assert.doesNotMatch(policy, /allowsAutomaticActivation: true/);
  assert.doesNotMatch(policy, /@athlete-coach\/(ai|application)|gemini/i);
});

test("clients cannot request auto-draft or choose materialization origin", async () => {
  for (const name of ["coach-analyze", "coach-propose", "coach-decide"]) {
    const source = await read(`supabase/functions/${name}/index.ts`);
    assert.doesNotMatch(
      source,
      /body\.(autoDraft|autoMaterialize|materializationOrigin|draftAuthority)/,
      name,
    );
  }
  const decide = await read("supabase/functions/coach-decide/index.ts");
  assert.doesNotMatch(decide, /autoDraft|auto_draft/);
});

test("the model never receives or returns auto-draft authority", async () => {
  for (const path of [
    "packages/ai/src/prompt.ts",
    "packages/ai/src/proposal.ts",
    "packages/ai/src/providers.ts",
  ])
    assert.doesNotMatch(
      await read(path),
      /autoDraft|auto_draft|draftAuthority/,
      path,
    );
});
