import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// A proposal request that ends without a concrete change (decision null) must
// be visible to the athlete, not a silent no-op (found by the cloud E2E).
const root = resolve(import.meta.dirname, "..");
const personal = await readFile(
  resolve(root, "app/(tabs)/personal.tsx"),
  "utf8",
);
const labels = await readFile(
  resolve(root, "src/presentation/coach/governance-labels.ts"),
  "utf8",
);

test("a null proposal shows a factual notice instead of nothing", () => {
  assert.match(personal, /setNoProposal\(value === null\)/);
  assert.match(personal, /noProposal && !decision/);
  assert.match(personal, /testID="coach-no-proposal"/);
  assert.match(personal, /\{NO_PROPOSAL_MESSAGE\}/);
  assert.match(labels, /n.o encontrou um ajuste concreto para propor/);
  assert.match(labels, /Seu programa n.o foi alterado/);
});

test("a new analysis clears the previous notice", () => {
  assert.match(personal, /setAnalysis\(result\);\s+setNoProposal\(false\);/);
});
