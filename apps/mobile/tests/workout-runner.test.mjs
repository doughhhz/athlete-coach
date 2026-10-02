import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
const root = resolve(import.meta.dirname, "..");
// The runner is split into the screen and its components (ADR-0122).
const runner =
  (await readFile(
    resolve(root, "src/presentation/workouts/workout-runner-screen.tsx"),
    "utf8",
  )) +
  (await readFile(
    resolve(root, "src/presentation/workouts/runner/runner-components.tsx"),
    "utf8",
  ));
const training = await readFile(
  resolve(root, "src/presentation/training/training-programs-screen.tsx"),
  "utf8",
);
const details = await readFile(
  resolve(root, "src/presentation/training/program-details-screen.tsx"),
  "utf8",
);
const summary = await readFile(
  resolve(root, "src/presentation/workouts/workout-summary-screen.tsx"),
  "utf8",
);
test("training tab exposes resume and factual history", () => {
  assert.match(training, /Continuar treino/);
  assert.match(training, /Histórico de treinos/);
});
test("active training day exposes start", () =>
  assert.match(details, /Iniciar treino/));
test("runner separates planned from observed", () => {
  assert.match(runner, /PLANEJADO/);
  assert.match(runner, /REALIZADO/);
});
test("runner provides retry-preserving save feedback and skip", () => {
  assert.match(runner, /valores digitados foram preservados/);
  assert.match(runner, /Pular série/);
});
test("runner exposes completion review signal and explicit abandon", () => {
  assert.match(runner, /pendentes/);
  assert.match(runner, /Encerrar sem concluir/);
});
test("rest timer is timestamp-based and dismissible", () => {
  assert.match(runner, /restStartedAt/);
  assert.match(runner, /Encerrar timer/);
});
test("historical summary is factual only", () => {
  assert.match(summary, /Resumo factual/);
  assert.doesNotMatch(
    summary,
    /score|recorde pessoal|volume total|ótimo treino/i,
  );
});
