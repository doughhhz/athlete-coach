import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Design 2026-10-01 (ADR-0120): dark minimal neon, facts only.
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [theme, screen, components] = await Promise.all([
  read("src/presentation/theme/theme.ts"),
  read("src/presentation/training/training-programs-screen.tsx").then(
    async (text) =>
      text + (await read("src/presentation/training/programs-screen.tsx")),
  ),
  read("src/presentation/training/treino/treino-components.tsx"),
]);

test("theme carries the approved tokens and is dark only", () => {
  for (const token of [
    "#050B14",
    "#16C8FF",
    "#1EDCFF",
    "#1D5CFF",
    "#19E27A",
    "#FF4D67",
    "Inter_700Bold",
  ])
    assert.match(theme, new RegExp(token), token);
  assert.match(theme, /themes = \{ light: appTheme, dark: appTheme \}/);
});

test("the Treino screen shows facts, never invented claims", () => {
  // Honest replacements for the mock: availability, not "online"; the date,
  // not a promise; total sets, not an invented session level; no bell
  // without a notifications feature.
  const text = screen + components;
  assert.doesNotMatch(
    text,
    /Online agora|resultados sempre|Moderado|"notifications|bell_outline|"bell-outline"/i,
  );
  assert.match(components, /testID="training-open-programs"/);
  assert.match(screen, /estimateTrainingDayMinutes\(trainingDay\)/);
  assert.match(screen, /deriveWeekPlan\(/);
  assert.match(screen, /workoutExerciseProgress\(/);
});

test("E2E anchors survive the redesign", () => {
  for (const anchor of [
    "Programa ativo",
    'testID="training-active-program-name"',
    "Ver alvos planejados",
    "Continuar treino",
    'testID="training-create-program"',
    'testID="training-initial-program"',
    "Histórico de treinos",
    '"Concluído"',
  ])
    assert.ok(screen.includes(anchor), anchor);
});

test("only today's open workout replaces today's plan (ADR-0127)", async () => {
  const home = await read("src/presentation/home/home-screen.tsx");
  for (const source of [screen, home]) {
    assert.match(source, /startedToday\(openWorkout, new Date\(\), timeZone\)/);
    assert.match(source, /<OpenWorkoutNotice workout=\{staleWorkout\}/);
    assert.match(source, /Encerrar e iniciar/);
    assert.match(source, /app\.abandonWorkout\(staleWorkout\.id\)/);
  }
});
