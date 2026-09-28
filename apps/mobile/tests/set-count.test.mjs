import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const review = await read("app/coach-proposals/[id].tsx");
const builder = await read(
  "src/presentation/training/program-builder-screen.tsx",
);
const labels = await read("src/presentation/outcomes/outcome-labels.ts");
const outcome = await read(
  "src/presentation/outcomes/intervention-outcome-screen.tsx",
);
const memory = await read(
  "src/presentation/outcomes/response-memory-screen.tsx",
);
const progress = await read("src/presentation/performance/progress-screen.tsx");

test("proposal review shows factual add/remove set diffs from the domain summary", () => {
  assert.match(review, /summarizeSetCountChanges/);
  assert.match(review, /Séries planejadas:/);
  assert.match(review, /Nova série:/);
  assert.match(review, /Série removida: Série/);
  assert.match(review, /não representa\s+volume muscular/);
  assert.match(review, /Criar revisão em rascunho/);
  assert.doesNotMatch(review, /Aplicar automaticamente|activateProgram/);
});

test("planned set formatting shows reps, RIR, rest, tempo and load", () => {
  assert.match(labels, /export function formatPlannedSet/);
  for (const text of [
    "de descanso",
    "tempo",
    "carga escolhida pelo atleta",
    "RIR",
  ])
    assert.match(labels, new RegExp(text));
  assert.match(labels, /set_count: "Quantidade de séries planejadas"/);
  assert.match(labels, /séries/);
});

test("builder can add and remove individual sets but never the last one", () => {
  assert.match(builder, /\+ Adicionar série/);
  assert.match(builder, /Remover série/);
  assert.match(builder, /p\.sets\.length > 1/);
});

test("observed response distinguishes planned from completed sets", () => {
  assert.match(outcome, /Séries planejadas:/);
  assert.match(outcome, /séries\s+concluídas aparecem abaixo por sessão/);
  assert.match(labels, /Séries planejadas por sessão/);
  assert.match(labels, /Séries concluídas por sessão/);
});

test("memory detail renders set-count signatures through the shared formatter", () => {
  assert.match(memory, /formatPrescriptionValue\(change\.before\)/);
  assert.match(memory, /formatPrescriptionValue\(change\.after\)/);
  assert.match(labels, /Séries trocadas sem mudar a quantidade planejada/);
});

test("no optimal-volume, works or muscle-volume wording", () => {
  for (const source of [review, labels, outcome, memory, progress])
    assert.doesNotMatch(
      source,
      /volume ideal|Seu volume|mais volume funcionou|volume ótimo|séries ideais|Funcionou|séries efetivas|séries por músculo/i,
    );
});
