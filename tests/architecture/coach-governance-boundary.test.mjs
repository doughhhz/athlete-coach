import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
async function sources(directory) {
  const entries = await readdir(resolve(root, directory), {
    recursive: true,
    withFileTypes: true,
  });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return { path, text: await readFile(path, "utf8") };
      }),
  );
}

test("governance is decided by the domain policy, never by the AI package", async () => {
  for (const file of await sources("packages/ai/src"))
    assert.doesNotMatch(
      file.text,
      /reviewClass|review_class|standard_review|elevated_review|coach-governance/,
      file.path,
    );
  const policy = await read(
    "packages/domain/src/coach-governance/governance.ts",
  );
  assert.doesNotMatch(policy, /@athlete-coach\/(ai|application)|gemini/i);
  assert.match(policy, /allowsAutomaticMaterialization: false/);
  assert.match(policy, /allowsAutomaticActivation: false/);
});

test("the proactive path never materializes or activates", async () => {
  const orchestration = await read(
    "packages/application/src/coach/governance-use-cases.ts",
  );
  const analyze = await read("supabase/functions/coach-analyze/index.ts");
  for (const text of [orchestration, analyze])
    assert.doesNotMatch(
      text,
      /\.materialize\(|materialize_coach_decision|activateProgram|activate_training_program|ApproveCoachProposal/,
    );
});

test("no scheduler or background agent drives the Coach", async () => {
  const files = [
    ...(await sources("packages/application/src/coach")),
    ...(await sources("supabase/functions")),
  ];
  for (const file of files)
    assert.doesNotMatch(
      file.text,
      /setInterval|setTimeout\(|Deno\.cron|pg_cron|EdgeRuntime\.waitUntil/,
      file.path,
    );
});

test("edge functions never read origin or review class from the request body", async () => {
  for (const name of ["coach-analyze", "coach-propose", "coach-decide"]) {
    const text = await read(`supabase/functions/${name}/index.ts`);
    assert.doesNotMatch(
      text,
      /body\.(reviewClass|proposalOrigin|origin|autonomyMode|governance)/,
      name,
    );
  }
});
