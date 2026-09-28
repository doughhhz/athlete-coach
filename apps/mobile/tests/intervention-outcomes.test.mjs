import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const labels = await read("src/presentation/outcomes/outcome-labels.ts");
const screen = await read(
  "src/presentation/outcomes/intervention-outcome-screen.tsx",
);
const progress = await read("src/presentation/performance/progress-screen.tsx");
const personal = await read("app/(tabs)/personal.tsx");
const route = await read("app/coach-decisions/[id].tsx");

test("eligibility states use factual wording", () => {
  for (const text of [
    "Aguardando ativação",
    "Coletando dados após a alteração",
    "Poucos dados após a alteração",
    "Comparação antes/depois disponível",
    "Não ativada — não houve intervenção",
  ])
    assert.match(labels, new RegExp(text));
});

test("observed response shows before, after, difference, sample and limitations", () => {
  for (const text of [
    "Resposta observada",
    "ANTES",
    "DEPOIS",
    "DIFERENÇA",
    "AMOSTRA",
    "LIMITAÇÕES",
    "não prova de causa",
    "Aplicado:",
    "Proposto:",
  ])
    assert.match(screen, new RegExp(text));
  assert.match(labels, /formatDelta/);
  assert.match(labels, /p\.p\./);
  assert.match(route, /InterventionOutcomeScreen/);
});

test("outcome screen has loading, error, retry and empty states", () => {
  assert.match(screen, /ActivityIndicator/);
  assert.match(screen, /Tentar novamente/);
  assert.match(screen, /Ainda não há dados suficientes/);
  assert.match(screen, /Decisão não encontrada/);
});

test("Progress lists tracked changes with sample counts and an empty state", () => {
  assert.match(progress, /Alterações acompanhadas/);
  assert.match(progress, /Nenhuma revisão criada a partir de uma proposta/);
  assert.match(progress, /Sessões observadas/);
  assert.match(progress, /amostras/);
  assert.match(progress, /interventionHistory/);
});

test("Personal decision history links to the observed response only when data exists", () => {
  assert.match(personal, /Ver resposta observada/);
  assert.match(personal, /evaluable/);
  assert.match(personal, /limited_data/);
});

test("no success, failure or effectiveness wording in outcome UI", () => {
  for (const source of [labels, screen, progress, personal])
    assert.doesNotMatch(
      source,
      /Funcionou|Não funcionou|Sucesso|Fracasso|Efetividade|Resultado da estratégia|melhorou|piorou/i,
    );
});

test("outcome UI performs no program mutation", () => {
  for (const source of [screen, progress])
    assert.doesNotMatch(
      source,
      /activateProgram|saveProgramStructure|cloneProgram|materializeCoachProposal/,
    );
});
