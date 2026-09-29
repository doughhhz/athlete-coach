import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// ADR-0078: "Client-returned Coach analysis is display data, never
// authoritative coaching state."
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("coach-propose never parses an analysis from the request body", async () => {
  const source = await read("supabase/functions/coach-propose/index.ts");
  assert.doesNotMatch(
    source,
    /coachAnalysisSchema|body\.analysis|analysis\s*\?\?/,
  );
  assert.match(source, /coachProposalRequestSchema/);
  assert.match(source, /SupabaseCoachAnalysisRepository/);
  assert.match(source, /GenerateCoachProposalForAnalysisRequest/);
});

test("proposal request contract is strict and carries only the analysis identity", async () => {
  const source = await read(
    "packages/application/src/coach/proposal-use-cases.ts",
  );
  assert.match(
    source,
    /coachProposalRequestSchema = z\s*\.object\(\{ analysisRequestId: z\.uuid\(\) \}\)\s*\.strict\(\)/,
  );
  // The generator only accepts an authoritative record, never a bare analysis.
  assert.match(source, /async execute\(\s*record: CoachAnalysisRecord,/);
});

test("the mobile client sends only the analysis request id for proposals", async () => {
  const gateway = await read(
    "apps/mobile/src/infrastructure/coach/supabase-coach-gateway.ts",
  );
  assert.match(gateway, /body: \{ analysisRequestId \}/);
  assert.doesNotMatch(
    gateway,
    /\{ analysis, analysisRequestId \}|body: \{ analysis \}/,
  );
});

test("ledger writes go through the server-owned analysis handoff", async () => {
  const repository = await read(
    "packages/data-access/src/supabase/coach-decision-repository.ts",
  );
  assert.match(repository, /"create_coach_decision_for_analysis"/);
  assert.doesNotMatch(repository, /rpc\("create_coach_decision",/);
});

test("analysis snapshots are never logged", async () => {
  for (const name of ["coach-analyze", "coach-propose"]) {
    const source = await read(`supabase/functions/${name}/index.ts`);
    for (const line of source
      .split("\n")
      .filter((item) => /console\./.test(item)))
      assert.doesNotMatch(
        line,
        /analysis\s*[,}]|analysis_snapshot|summary|observations|userRequest|proposal[,}]/,
        `${name}: ${line.trim().slice(0, 80)}`,
      );
  }
});
