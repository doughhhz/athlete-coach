import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Implementation Phase 19 (ADR-0097..0099): structural editing lives in the
// pure application editor; deletion is explicit; persistence stays whole-tree.
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const editorPath =
  "packages/application/src/training/program-structure-editor.ts";
const builderPath =
  "apps/mobile/src/presentation/training/program-builder-screen.tsx";

test("structure operations live in the application editor, not in presentation", async () => {
  const builder = await read(builderPath);
  const labels = await read(
    "apps/mobile/src/presentation/training/structure-labels.ts",
  );
  for (const text of [builder, labels]) {
    assert.doesNotMatch(
      text,
      /resequence|\.splice\(|sequence: [a-z]+\s*\+\s*1/,
    );
    assert.doesNotMatch(text, /\.filter\(\(_, (index|i)\) =>/);
  }
  const editor = await read(editorPath);
  for (const operation of [
    "addBlock(",
    "addWeek(",
    "addDay(",
    "removeBlock(",
    "removeWeek(",
    "removeDay(",
    "moveBlock(",
    "moveWeek(",
    "moveDay(",
  ])
    assert.ok(editor.includes(`  ${operation}`), operation);
});

test("nodes are dropped only inside explicit remove operations", async () => {
  const editor = await read(editorPath);
  const drops = [...editor.matchAll(/\.filter\(\(_, (index|i)\) =>/g)].map(
    (match) => {
      const before = editor.slice(0, match.index);
      return before
        .match(/\n  (\w+)\(/g)
        .at(-1)
        .trim()
        .slice(0, -1);
    },
  );
  assert.deepEqual(drops.sort(), [
    "removeBlock",
    "removeDay",
    "removePrescription",
    "removeSet",
    "removeWeek",
  ]);
});

test("no generic mutation or JSON Patch semantics; save stays whole-tree", async () => {
  const editor = await read(editorPath);
  assert.doesNotMatch(
    editor,
    /applyPatch|jsonPatch|"op":|\bop: "(add|remove|replace)"/i,
  );
  assert.doesNotMatch(editor, /from "@supabase|fetch\(/);
  const builder = await read(builderPath);
  assert.match(builder, /app\.saveProgramStructure\(programId, structure\)/);
  assert.equal(
    [...builder.matchAll(/saveProgramStructure\(/g)].length,
    1,
    "one persistence path",
  );
});

test("the builder imports no Coach authority, auto-draft or activation modules", async () => {
  const builder = await read(builderPath);
  const imports = [...builder.matchAll(/import[\s\S]*?from "([^"]+)"/g)]
    .map((match) => match[0])
    .join("\n");
  assert.doesNotMatch(
    imports,
    /autoDraft|AutoDraft|governance|Governance|coachDecision|activateProgram|coach-auto-draft/,
  );
  assert.doesNotMatch(
    builder,
    /activateProgram|auto_draft|autoDraftCoachDecision/,
  );
});

test("last-node rules mirror the canonical min(1) schema invariants", async () => {
  const editor = await read(editorPath);
  assert.match(
    editor,
    /canRemoveBlock: \(structure: StructureInput\) => structure\.blocks\.length > 1/,
  );
  assert.match(editor, /weeks\.length \?\? 0\) > 1/);
  assert.match(editor, /days\.length \?\? 0\) > 1/);
  // Every container level of the canonical save schema rejects emptiness.
  const { programStructureInputSchema } =
    await import("../../packages/application/src/training/schemas.ts");
  const set = {
    sequence: 1,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    loadKind: "unprescribed",
    rirMin: null,
    rirMax: null,
    restMinSeconds: null,
    restMaxSeconds: null,
    tempo: null,
    loadKg: null,
  };
  const tree = (sets, prescriptions, days, weeks) => ({
    blocks: [
      {
        sequence: 1,
        name: "B",
        weeks: weeks ?? [
          {
            sequence: 1,
            days: days ?? [
              {
                sequence: 1,
                name: "D",
                prescriptions: prescriptions ?? [
                  {
                    sequence: 1,
                    exerciseId: "00000000-0000-4000-8000-000000000001",
                    sets: sets ?? [set],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(programStructureInputSchema.safeParse(tree()).success, true);
  for (const empty of [
    tree([]),
    tree(undefined, []),
    tree(undefined, undefined, []),
    tree(undefined, undefined, undefined, []),
    { blocks: [] },
  ])
    assert.equal(programStructureInputSchema.safeParse(empty).success, false);
});
