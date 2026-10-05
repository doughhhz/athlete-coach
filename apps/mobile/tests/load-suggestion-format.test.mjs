import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { formatLoadSuggestion } from "../src/presentation/workouts/load-suggestion-format.ts";

const base = {
  version: "load-suggestion-v1",
  workoutExerciseId: "we",
  exerciseId: "e",
  kind: "from_history",
  workingLoadKg: 21,
  stepKg: 1,
  basis: {
    startedAt: "2026-10-02T12:00:00.000Z",
    value: 12,
    loadKg: 20,
    rir: 4,
    estimatedOneRepMaxKg: 30.67,
  },
  target: { reps: 12, rir: 2 },
  warmUp: { plan: "single", sets: [{ loadKg: 10, reps: 10, percent: 0.5 }] },
  reasons: ["isolation"],
};

test("from history: load, basis, target and warm-up checklist", () => {
  const text = formatLoadSuggestion(base);
  assert.equal(text.title, "Carga sugerida: 21 kg");
  assert.match(
    text.lines[0],
    /^Na última vez \(\d\d\/\d\d\) você fez 12 reps com 20 kg, sobrando 4\.$/,
  );
  assert.equal(
    text.lines[1],
    "Calculada para 12 reps sobrando 2 na 1ª série de hoje.",
  );
  assert.equal(text.warmUpTitle, "Aquecimento");
  assert.deepEqual(text.warmUp, ["10 kg × 10"]);
});

test("barbell ramp, decimals and context reasons", () => {
  const text = formatLoadSuggestion({
    ...base,
    workingLoadKg: 82.5,
    basis: { ...base.basis, loadKg: 80, rir: null, value: 8 },
    warmUp: {
      plan: "full",
      sets: [
        { loadKg: 20, reps: 10, percent: null },
        { loadKg: 47.5, reps: 5, percent: 0.6 },
        { loadKg: 66.25, reps: 3, percent: 0.8 },
      ],
    },
    reasons: ["long_break", "capped_increase", "heavy_week", "rir_assumed"],
  });
  assert.equal(text.title, "Carga sugerida: 82,5 kg");
  assert.match(text.lines[0], /você fez 8 reps com 80 kg\.$/);
  assert.deepEqual(text.warmUp, [
    "20 kg (barra vazia) × 10",
    "47,5 kg × 5",
    "66,25 kg × 3",
  ]);
  for (const start of [
    "Faz 14 dias",
    "Subida limitada",
    "Sua semana",
    "O plano não define RIR",
  ])
    assert.ok(
      text.lines.some((line) => line.startsWith(start)),
      start,
    );
});

test("prescribed, exploratory, group already warm, isolation and bodyweight", () => {
  assert.equal(
    formatLoadSuggestion({
      ...base,
      kind: "prescribed",
      basis: null,
      workingLoadKg: 60,
    }).title,
    "Carga do programa: 60 kg",
  );
  const exploratory = formatLoadSuggestion({
    ...base,
    kind: "exploratory",
    workingLoadKg: null,
    basis: null,
    warmUp: { plan: "none", sets: [] },
  });
  assert.equal(exploratory.title, "Primeira vez neste exercício");
  assert.match(exploratory.lines[0], /umas 20 vezes/);
  assert.equal(exploratory.warmUpTitle, null);
  assert.equal(
    formatLoadSuggestion({ ...base, reasons: ["group_already_warm"] })
      .warmUpTitle,
    "Aquecimento (grupo já aquecido no treino)",
  );
  assert.ok(
    formatLoadSuggestion({
      ...base,
      warmUp: { plan: "none", sets: [] },
    }).lines.includes("Sem aquecimento formal: faça a 1ª série com controle."),
  );
  assert.equal(formatLoadSuggestion({ ...base, kind: "bodyweight" }), null);
});

test("runner: suggestion card before the first set, prefilled load, no AI", async () => {
  const root = resolve(import.meta.dirname, "../src/presentation/workouts");
  const screen = await readFile(
    resolve(root, "workout-runner-screen.tsx"),
    "utf8",
  );
  const card = await readFile(
    resolve(root, "runner/load-suggestion-card.tsx"),
    "utf8",
  );
  assert.match(screen, /\.suggestWorkoutLoads\(/);
  assert.match(screen, /<LoadSuggestionCard/);
  assert.match(screen, /isExerciseUnstarted\(exercise\)/);
  assert.match(screen, /suggestedLoadKg/);
  assert.match(card, /formatLoadSuggestion\(/);
  assert.match(card, /accessibilityRole="checkbox"/);
  assert.doesNotMatch(card + screen, /analyzeWithCoach|gemini|nvidia/i);
  assert.doesNotMatch(card, /loadForRepsKg|estimateOneRepMax/);
});
