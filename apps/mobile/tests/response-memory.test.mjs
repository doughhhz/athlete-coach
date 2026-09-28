import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const screen = await read(
  "src/presentation/outcomes/response-memory-screen.tsx",
);
const labels = await read("src/presentation/outcomes/outcome-labels.ts");
const progress = await read("src/presentation/performance/progress-screen.tsx");
const outcome = await read(
  "src/presentation/outcomes/intervention-outcome-screen.tsx",
);
const route = await read("app/response-memory/[key].tsx");

test("Progress shows the response memory with empty state and truncation", () => {
  assert.match(progress, /Memória de resposta/);
  assert.match(progress, /Ainda não há intervenções ativadas/);
  assert.match(progress, /responseMemory/);
  assert.match(progress, /Mostrando/);
  assert.match(progress, /intervenção\(ões\) registrada\(s\)/);
  assert.match(progress, /comparável\(is\)/);
  assert.match(progress, /com mudanças simultâneas/);
  assert.match(progress, /variação\(ões\)\s+positiva\(s\)/);
  assert.match(progress, /Observações em direções diferentes/);
});

test("detail shows interventions, factual change, before/after, delta, sample and limitations", () => {
  for (const text of [
    "Histórico observado",
    "Alteração ativada",
    "Antes",
    "Depois",
    "Variação numérica",
    "Amostra",
    "Limitações",
    "Intervenção comparável",
    "Apenas contexto",
    "não são experimentos controlados",
    "apontaram em direções diferentes",
    "revisão",
  ])
    assert.match(screen, new RegExp(text));
  assert.match(route, /ResponseMemoryScreen/);
});

test("detail has loading, error, retry and empty states", () => {
  assert.match(screen, /ActivityIndicator/);
  assert.match(screen, /Tentar novamente/);
  assert.match(screen, /Ainda não há histórico observado/);
});

test("signs are arithmetic and direction labels are structural", () => {
  assert.match(labels, /depois − antes > 0/);
  assert.match(labels, /variações em direções diferentes/);
  assert.match(labels, /faixa alterada nos dois sentidos/);
});

test("outcome detail links to the related history", () => {
  assert.match(outcome, /Ver histórico relacionado/);
  assert.match(outcome, /responseMemoryGroupKeyForAction/);
});

test("no causal, optimal or responder wording and no teach-the-AI action", () => {
  for (const source of [screen, labels, progress])
    assert.doesNotMatch(
      source,
      /Aprendeu que|Funciona|Não funciona|Ideal|Ótimo|Resposta superior|O que funciona para você|Melhor estratégia|responder|Ensinar ao Personal/i,
    );
  assert.doesNotMatch(
    screen,
    /activateProgram|materializeCoachProposal|saveProgramStructure/,
  );
});
