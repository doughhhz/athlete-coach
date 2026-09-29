import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Implementation Phase 19: explicit block/week/day editing and the
// unsaved-changes guard (ADR-0097..0099).
const root = resolve(import.meta.dirname, "..");
const builder = await readFile(
  resolve(root, "src/presentation/training/program-builder-screen.tsx"),
  "utf8",
);
const labels = await readFile(
  resolve(root, "src/presentation/training/structure-labels.ts"),
  "utf8",
);

test("Block → Week → Day selectors with add and ↑/↓ at every level", () => {
  for (const level of ["block", "week", "day"])
    assert.match(builder, new RegExp(`<LevelSelector\\s+level="${level}"`));
  for (const text of [
    "+ Bloco",
    "+ Semana neste bloco",
    "+ Dia nesta semana",
    "Dia em edição",
  ])
    assert.ok(labels.includes(text), text);
  assert.match(builder, /Mover \$\{labels\.noun\} para cima/);
  assert.match(builder, /Mover \$\{labels\.noun\} para baixo/);
  // Touch targets usable on iPhone 11 (44pt) and horizontal chip rows.
  assert.match(builder, /action: \{ minHeight: 44, minWidth: 44/);
  assert.match(
    builder,
    /<ScrollView horizontal contentContainerStyle=\{s\.chips\}>/,
  );
});

test("structural edits call the pure editor operations only", () => {
  for (const operation of [
    "structureEdits.addBlock",
    "structureEdits.addWeek",
    "structureEdits.addDay",
    "structureEdits.removeBlock",
    "structureEdits.removeWeek",
    "structureEdits.removeDay",
    "structureEdits.moveBlock",
    "structureEdits.moveWeek",
    "structureEdits.moveDay",
    "clampPath(next, path)",
  ])
    assert.ok(builder.includes(operation), operation);
  assert.doesNotMatch(builder, /\.splice\(|\.filter\(\(_, index\) =>/);
});

test("removal asks for confirmation with factual counts and no preselected choice", () => {
  assert.match(
    builder,
    /Alert\.alert\(removalTitle\(level, summary\), removalMessage\(level, summary\)/,
  );
  assert.match(builder, /structureSummaries\[level\]\(structure, selected\)/);
  assert.ok(builder.includes('{ text: "Cancelar", style: "cancel" }'));
  for (const text of [
    "semana",
    "dia",
    "exercício",
    "série",
    "Remover bloco",
    "Remover semana",
    "Remover dia",
  ])
    assert.ok(labels.includes(text), text);
  for (const alarm of [
    "permanente",
    "irreversível",
    "perigo",
    "cuidado",
    "ATENÇÃO",
    "checkbox",
    "<Switch",
  ])
    assert.equal(
      `${builder}${labels}`.toLowerCase().includes(alarm.toLowerCase()),
      false,
      alarm,
    );
});

test("the last node explains the invariant instead of offering removal", () => {
  assert.match(builder, /canRemove \? \(/);
  assert.match(builder, /lastNodeExplanation\[level\]/);
  for (const text of [
    "ao menos um bloco",
    "ao menos uma semana",
    "ao menos um dia",
  ])
    assert.ok(labels.includes(text), text);
  assert.match(builder, /structureRemovalRules\.canRemoveBlock/);
  assert.match(builder, /structureRemovalRules\.canRemoveWeek/);
  assert.match(builder, /structureRemovalRules\.canRemoveDay/);
});

test("leaving with unsaved edits asks; clean drafts and in-builder navigation do not", () => {
  assert.match(
    builder,
    /import \{ usePreventRemove \} from "expo-router\/react-navigation"/,
  );
  assert.match(builder, /usePreventRemove\(shouldGuardDraftLeave\(session\)/);
  assert.match(builder, /const \[keep, discard\] = draftLeaveOptions/);
  assert.match(
    builder,
    /onPress: \(\) => navigation\.dispatch\(data\.action\)/,
  );
  // Selecting another block/week/day never emits an edit event.
  const select = builder.match(
    /function select\(path: DayPath\) \{[\s\S]*?\n  \}/,
  )[0];
  assert.doesNotMatch(select, /track\(/);
  assert.doesNotMatch(builder, /Salvar e sair/);
});

test("discard never saves; dirty clears only after a successful save", () => {
  const guard = builder.match(/usePreventRemove\([\s\S]*?\n  \}\);/)[0];
  assert.doesNotMatch(guard, /saveProgramStructure|save\(/);
  const save = builder.match(/async function save\(\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(
    save.indexOf('track("save_succeeded")') >
      save.indexOf("await app.saveProgramStructure"),
  );
  assert.match(save, /catch \(e\) \{[\s\S]*track\("save_failed"\)/);
  assert.doesNotMatch(save, /router\.replace/);
  // Navigation waits for the clean render so the guard is released.
  assert.match(
    builder,
    /if \(savedProgramId && !session\.dirty\)\s+router\.replace/,
  );
});

test("every edit marks the draft dirty, including the program name", () => {
  assert.match(
    builder,
    /function edit\(.*\) \{\s+setStructure[^;]+;\s+track\("edited"\);/,
  );
  assert.match(
    builder,
    /function commit\(next: StructureInput, path: DayPath\) \{\s+setStructure\(next\);\s+track\("edited"\);/,
  );
  assert.match(builder, /setName\(value\);\s+track\("edited"\);/);
  assert.doesNotMatch(builder, /setDirty/);
});
