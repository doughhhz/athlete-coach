import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { assessWorkoutSet } from "../../../packages/domain/src/index.ts";
import { formatSetAssessment } from "../src/presentation/workouts/set-assessment-format.ts";

const NOW = new Date("2026-10-05T15:00:00.000Z");
const daysAgo = (days) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();
const set = (sequence, value, load, rir, change = {}) => ({
  id: `set-${sequence}`,
  sourcePrescriptionSetId: `ps-${sequence}`,
  sequence,
  status: value === null ? "pending" : "completed",
  plannedMetric: "reps",
  plannedTargetMin: 10,
  plannedTargetMax: 15,
  plannedRirMin: 2,
  plannedRirMax: 3,
  plannedRestMinSeconds: 60,
  plannedRestMaxSeconds: 90,
  plannedTempo: null,
  plannedLoadKind: "athlete_selected",
  plannedLoadKg: null,
  actualValue: value,
  actualLoadKg: value === null ? null : load,
  actualRir: value === null ? null : rir,
  performedAt: value === null ? null : NOW.toISOString(),
  restStartedAt: null,
  restEndedAt: null,
  ...change,
});
const session = (id, startedAt, sets, status = "completed") => ({
  id,
  athleteId: "a",
  sourceTrainingDayId: "d",
  programName: "P",
  dayName: "A",
  status,
  athleteNotes: null,
  startedAt,
  completedAt: status === "completed" ? startedAt : null,
  abandonedAt: null,
  createdAt: startedAt,
  updatedAt: startedAt,
  exercises: [
    {
      id: `${id}-ex`,
      sourceExercisePrescriptionId: "p",
      exerciseId: "curl",
      sequence: 1,
      exerciseName: "Rosca",
      plannedInstructions: null,
      plannedAthleteCues: null,
      sets: sets.map((item) => ({ ...item, id: `${id}-${item.id}` })),
    },
  ],
});
const text = (current, setId, history = [], plannedPerWeek = 3) =>
  formatSetAssessment(
    assessWorkoutSet({
      session: current,
      workoutSetId: `today-${setId}`,
      history,
      plannedPerWeek,
      now: NOW,
    }),
  );

test("the approved example: below plan, last session, week load, reduce", () => {
  const result = text(
    session(
      "today",
      NOW.toISOString(),
      [set(1, 2, 2.5, 0), set(2, null)],
      "in_progress",
    ),
    "set-1",
    [
      session("w1", daysAgo(4), [set(1, 12, 2.5, 2)]),
      session("w2", daysAgo(3), [set(1, 12, 2.5, 2)]),
      session("w3", daysAgo(2), [set(1, 12, 2.5, 2)]),
    ],
  );
  assert.equal(result.tone, "below");
  assert.equal(result.title, "Abaixo do planejado");
  assert.equal(
    result.lines[0],
    "2 de 10–15 reps com 2,5 kg, e você chegou na falha (RIR 0, plano 2–3).",
  );
  assert.match(
    result.lines[1],
    /^Na última sessão \(\d\d\/\d\d\) você fez 12 reps com 2,5 kg nesta série; hoje caiu 83%\.$/,
  );
  assert.ok(
    result.lines.includes(
      "Você treinou 4 vezes nos últimos 7 dias (plano: 3 por semana), então pode ser cansaço acumulado.",
    ),
  );
  assert.equal(
    result.next,
    "Próxima série: reduza para 2 kg e mire 10 reps com 2 repetições de reserva.",
  );
  assert.equal(
    result.caution,
    "Queda grande. Se sentiu dor ou desconforto, interrompa o exercício.",
  );
});

test("within plan on the first record: honest about missing history", () => {
  const result = text(
    session("today", NOW.toISOString(), [set(1, 12, 20, 2)], "in_progress"),
    "set-1",
  );
  assert.equal(result.tone, "within");
  assert.equal(result.title, "Dentro do plano");
  assert.equal(
    result.lines[0],
    "12 de 10–15 reps com 20 kg, com o esforço planejado (RIR 2).",
  );
  assert.ok(result.lines.some((line) => line.startsWith("Primeiro registro")));
  assert.equal(
    result.next,
    "Próximo treino: mantenha 20 kg e mire 10–15 reps com 2–3 repetições de reserva.",
  );
  assert.equal(result.caution, null);
  assert.deepEqual(result.records, []);
});

test("above plan with records, today's previous set and increase", () => {
  const result = text(
    session(
      "today",
      NOW.toISOString(),
      [set(1, 16, 20, 4), set(2, 16, 22.5, 4), set(3, null)],
      "in_progress",
    ),
    "set-2",
    [session("w1", daysAgo(3), [set(1, 15, 20, 4), set(2, 15, 20, 4)])],
  );
  assert.equal(result.tone, "above");
  assert.equal(result.lines[1], "Mantendo o ritmo da série 1 (16 → 16 reps).");
  // 16 reps: no e1RM (Epley up to 12), so no strength comparison is invented.
  assert.match(result.lines[2], /você fez 15 reps com 20 kg nesta série\.$/);
  assert.deepEqual(result.records, ["Recorde: maior carga neste exercício!"]);
  assert.equal(
    result.next,
    "Próxima série: suba para 23,5 kg e mire 10–15 reps com 2–3 repetições de reserva.",
  );
});

test("bodyweight and no-RIR guidance never invent a load", () => {
  const result = text(
    session("today", NOW.toISOString(), [set(1, 6, null, null)], "in_progress"),
    "set-1",
  );
  assert.equal(result.lines[0], "6 de 10–15 reps.");
  assert.ok(
    result.lines.includes("Registre o RIR para uma orientação mais precisa."),
  );
  assert.equal(
    result.next,
    "Próximo treino: mantenha e mire 10–15 reps com 2–3 repetições de reserva.",
  );
});

test("runner shows the assessment card without AI or business rules", async () => {
  const root = resolve(import.meta.dirname, "../src/presentation/workouts");
  const screen = await readFile(
    resolve(root, "workout-runner-screen.tsx"),
    "utf8",
  );
  const card = await readFile(
    resolve(root, "runner/set-assessment-card.tsx"),
    "utf8",
  );
  assert.match(screen, /app\s*\.assessWorkoutSet\(/);
  assert.match(screen, /<SetAssessmentCard/);
  assert.match(card, /formatSetAssessment\(/);
  assert.match(card, /testID="set-assessment-title"/);
  assert.doesNotMatch(card + screen, /analyzeWithCoach|gemini|nvidia/i);
  assert.doesNotMatch(card, /suggestedLoad|plannedTargetMin/);
});
