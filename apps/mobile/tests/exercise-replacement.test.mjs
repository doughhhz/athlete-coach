import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const review = await read("app/coach-proposals/[id].tsx");
const labels = await read("src/presentation/outcomes/outcome-labels.ts");
const builder = await read(
  "src/presentation/training/program-builder-screen.tsx",
);
const outcome = await read(
  "src/presentation/outcomes/intervention-outcome-screen.tsx",
);
const memory = await read(
  "src/presentation/outcomes/response-memory-screen.tsx",
);
const progress = await read("src/presentation/performance/progress-screen.tsx");

test("proposal review shows the factual replacement diff, relations and load transition", () => {
  for (const text of [
    "Troca de exercício",
    "Antes:",
    "Proposto:",
    "Relações conhecidas:",
    "Carga planejada anterior:",
    "Carga após troca:",
    "Históricos de carga e 1RM",
    "summarizeReplacementChanges",
    "isAdjustAction",
  ])
    assert.match(review, new RegExp(text));
  assert.match(labels, /não significam equivalência de carga ou resultado/);
  assert.match(labels, /selecionada pelo atleta/);
  assert.match(labels, /não é conversão/);
  assert.match(labels, /variação de/);
});

test("builder lets the athlete swap the exercise while keeping sets", () => {
  assert.match(builder, /Trocar exercício/);
  assert.match(builder, /Cancelar troca/);
  assert.match(builder, /As séries são\s+mantidas/);
  assert.match(builder, /não é convertida entre\s+exercícios/);
});

test("observed response shows before/after exercises side by side without deltas", () => {
  for (const text of [
    "ANTES:",
    "DEPOIS:",
    "Exposições antes",
    "Exposições\\s+depois",
    "lado a lado",
    "CROSS_EXERCISE_WARNING",
  ])
    assert.match(outcome, new RegExp(text));
  assert.match(
    labels,
    /Carga e 1RM estimado não são diretamente comparáveis entre exercícios diferentes/,
  );
  const pairSection = outcome.slice(
    outcome.indexOf("crossExercisePairs.map"),
    outcome.indexOf("dataCoverage.exercises"),
  );
  assert.doesNotMatch(pairSection, /formatDelta|absoluteDelta|DIFERENÇA/);
});

test("memory shows directed replacement groups with counts only", () => {
  assert.match(memory, /replacementExerciseName/);
  assert.match(memory, /→/);
  assert.match(memory, /Exposições após as trocas/);
  assert.match(memory, /Relações registradas observadas/);
  assert.match(progress, /replacementExerciseName/);
});

test("no ranking, best-exercise or effectiveness wording", () => {
  for (const source of [review, labels, builder, outcome, memory, progress])
    assert.doesNotMatch(
      source,
      /melhor exercício|best exercise|exercício ideal|mais eficaz|funcion(a|ou) melhor|superior|ranking de exerc/i,
    );
});
