import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Corrective pass after Implementation Phase 18: the builder holds and saves
// the whole draft; the selected day is only a viewport.
const root = resolve(import.meta.dirname, "..");
const builder = await readFile(
  resolve(root, "src/presentation/training/program-builder-screen.tsx"),
  "utf8",
);

test("the builder loads the whole program through the lossless editor model", () => {
  assert.match(builder, /programToStructureInput\(program\)/);
  assert.doesNotMatch(builder, /blocks\[0\]|weeks\[0\]|days\[0\]/);
  assert.doesNotMatch(builder, /flatMap\([^)]*\)\s*=>\s*\{[^}]*return \[\]/s);
});

test("save always sends the full tree", () => {
  assert.match(builder, /app\.saveProgramStructure\(programId, structure\)/);
  assert.match(
    builder,
    /Always the full tree: the viewport is never the save scope/,
  );
});

test("any existing day can be selected; switching keeps unsaved edits", () => {
  assert.match(builder, /listDays\(structure\)/);
  assert.match(builder, /setSelected\(item\.path\)/);
  assert.ok(builder.includes("Dia em edição"));
  assert.ok(builder.includes("trocar de dia não as"));
  assert.ok(builder.includes("descarta"));
});

test("empty days show an empty state; nothing jumps or disappears silently", () => {
  assert.ok(builder.includes("Este dia ainda não tem exercícios."));
  assert.ok(builder.includes("Exercício fora do catálogo (mantido)"));
  assert.match(builder, /emptyDays\(structure\)/);
});

test("ranges are edited explicitly instead of being collapsed", () => {
  for (const label of [
    "RIR mín.",
    "RIR máx.",
    "Desc. mín. (s)",
    "Desc. máx. (s)",
  ])
    assert.ok(builder.includes(label), label);
  assert.doesNotMatch(builder, /rirMax: x\.rir|restMaxSeconds: x\.rest/);
});

test("all structural edits go through typed editor operations", () => {
  for (const operation of [
    "structureEdits.updateSet",
    "structureEdits.addSet",
    "structureEdits.removeSet",
    "structureEdits.replaceExercise",
    "structureEdits.movePrescription",
    "structureEdits.addPrescription",
    "structureEdits.removePrescription",
  ])
    assert.ok(builder.includes(operation), operation);
});
