import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
const root = resolve(import.meta.dirname, "..");
const progress = await readFile(
  resolve(root, "src/presentation/performance/progress-screen.tsx"),
  "utf8",
);
const summary = await readFile(
  resolve(root, "src/presentation/workouts/workout-summary-screen.tsx"),
  "utf8",
);
test("Progress has loading error retry and honest empty states", () => {
  assert.match(progress, /ActivityIndicator/);
  assert.match(progress, /Tentar novamente/);
  assert.match(progress, /Ainda não há carga registrada/);
});
test("overview labels historical facts without a composite score", () => {
  assert.match(progress, /RESUMO FACTUAL · HISTÓRICO TOTAL/);
  assert.match(progress, /Treinos concluídos/);
  assert.match(progress, /Séries puladas/);
  assert.doesNotMatch(
    progress,
    /performance score|strength score|aderência score/i,
  );
});
test("exercise selection and history preserve provenance", () => {
  assert.match(progress, /setSelected/);
  assert.match(progress, /programName/);
  assert.match(progress, /dayName/);
  assert.match(progress, /Sessão abandonada · performance preservada/);
});
test("load and estimated 1RM use precise labels", () => {
  assert.match(progress, /Maior carga registrada/);
  assert.match(progress, /Melhor 1RM estimado/);
  assert.match(progress, /não é uma medição de 1RM/);
});
test("baseline is not presented as a fake new record", () => {
  assert.match(progress, /isNewEstimatedOneRepMax/);
  assert.doesNotMatch(progress, /primeira.*novo|baseline.*novo/i);
});
test("workout summary includes factual derived metrics", () => {
  assert.match(summary, /Reps registradas/);
  assert.match(summary, /dentro do alvo/);
  assert.match(summary, /1RM estimado/);
});
test("Progress renders longitudinal facts without qualitative interpretation", () => {
  assert.match(progress, /Últimos 28 dias/);
  assert.match(progress, /período anterior/);
  assert.match(progress, /Comparação factual/);
  assert.match(progress, /amostras/);
  assert.match(progress, /Dados registrados/);
  assert.doesNotMatch(progress, /melhorou|piorou|excelente|precisa progredir/i);
});
