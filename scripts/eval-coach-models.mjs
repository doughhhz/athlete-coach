// Manual Coach model evaluation (ADR-0112). Runs the production analysis path
// (AnalyzeAthleteWithCoach + Gemini provider with structured output + Zod +
// grounding + Safety Gate) against a SYNTHETIC dossier, for several models.
// Prints metrics only: never model output or the key. Non-provider error
// messages are printed because the dossier is synthetic (no real data).
//
// Usage (PowerShell, key typed at runtime, only in this session):
//   $env:GEMINI_API_KEY = Read-Host "GEMINI_API_KEY"
//   node scripts/eval-coach-models.mjs [--rounds 3] [--models a,b,c]
//   Remove-Item Env:GEMINI_API_KEY
import {
  AnalyzeAthleteWithCoach,
  CoachProviderError,
} from "../packages/application/src/index.ts";
import {
  DeterministicCoachSafetyPolicy,
  GeminiHttpCoachModelProvider,
} from "../packages/ai/src/index.ts";
import { buildAthleteTrainingDossier } from "../packages/domain/src/index.ts";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("Defina GEMINI_API_KEY nesta sessão (veja o topo do arquivo).");
  process.exit(1);
}
const models = argument(
  "models",
  "gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.1-pro-preview,gemini-pro-latest,gemini-2.5-pro",
).split(",");
const rounds = Number(argument("rounds", "3"));
const questions = [
  {
    label: "progresso",
    text: "Como está minha evolução no supino e no agachamento nas últimas semanas?",
  },
  {
    label: "ajuste",
    text: "Meu treino precisa de algum ajuste? Estou sentindo o agachamento pesado.",
  },
];

// Synthetic athlete: 3 weeks, 2 sessions/week, 2 exercises (no real data).
const generatedAt = "2026-09-28T12:00:00.000Z";
const set = (
  id,
  sequence,
  actualValue,
  actualLoadKg,
  actualRir,
  performedAt,
) => ({
  id,
  sourcePrescriptionSetId: `ps-${sequence}`,
  sequence,
  status: "completed",
  plannedMetric: "reps",
  plannedTargetMin: 6,
  plannedTargetMax: 8,
  plannedRirMin: 2,
  plannedRirMax: 2,
  plannedRestMinSeconds: 120,
  plannedRestMaxSeconds: 180,
  plannedTempo: null,
  plannedLoadKind: "athlete_selected",
  plannedLoadKg: null,
  actualValue,
  actualLoadKg,
  actualRir,
  performedAt,
  restStartedAt: performedAt,
  restEndedAt: performedAt,
});
const sessions = Array.from({ length: 6 }, (_, index) => {
  const day = new Date(
    Date.parse(generatedAt) - (20 - index * 3.5) * 86_400_000,
  );
  const startedAt = day.toISOString();
  const id = `synthetic-session-${index + 1}`;
  const exercise = (key, name, baseLoad, rir) => ({
    id: `${id}-${key}`,
    sourceExercisePrescriptionId: `ep-${key}`,
    exerciseId: `exercise-${key}`,
    sequence: key === "bench" ? 1 : 2,
    exerciseName: name,
    plannedInstructions: null,
    plannedAthleteCues: null,
    sets: [1, 2, 3].map((sequence) =>
      set(
        `${id}-${key}-${sequence}`,
        sequence,
        8 - (sequence - 1),
        baseLoad + index * 2.5,
        rir(sequence),
        startedAt,
      ),
    ),
  });
  return {
    id,
    athleteId: "synthetic-athlete",
    sourceTrainingDayId: `day-${index % 2}`,
    programName: "Programa sintético",
    dayName: index % 2 ? "Treino B" : "Treino A",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      exercise("bench", "Supino reto", 60, () => 2),
      exercise("squat", "Agachamento livre", 80, (sequence) =>
        index > 3 ? 0 : 3 - sequence,
      ),
    ],
  };
});
const dossier = buildAthleteTrainingDossier({
  snapshot: {
    athlete: {
      id: "synthetic-athlete",
      userId: "synthetic-user",
      onboardingCompletedAt: "2026-08-01T00:00:00Z",
    },
    profile: {
      athleteId: "synthetic-athlete",
      birthDate: "1993-05-10",
      heightCm: 178,
      preferredName: "Atleta",
      timezone: "America/Sao_Paulo",
    },
    activeGoal: null,
    trainingContext: null,
    availableWeekdays: [1, 4],
    latestWeight: null,
  },
  activeProgram: null,
  sessions,
  generatedAt,
});

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const results = [];
for (const model of models) {
  for (let round = 1; round <= rounds; round += 1) {
    for (const question of questions) {
      const statuses = [];
      const fetcher = async (url, init) => {
        const response = await fetch(url, init);
        statuses.push(response.status);
        return response;
      };
      const provider = new GeminiHttpCoachModelProvider(
        {
          apiKey,
          model,
          temperature: 0.2,
          timeoutMs: 60_000,
          maxOutputTokens: 8192,
        },
        fetcher,
      );
      const analyze = new AnalyzeAthleteWithCoach(
        { execute: async () => dossier },
        provider,
        new DeterministicCoachSafetyPolicy(),
      );
      const started = Date.now();
      const row = { model, round, question: question.label };
      try {
        const analysis = await analyze.execute({
          userRequest: question.text,
          analysisMode: "question",
        });
        Object.assign(row, {
          ok: true,
          detail: `obs=${analysis.observations.length} rec=${analysis.recommendations.length} unc=${analysis.uncertainties.length} out=${analysis.metadata.outputTokens ?? "?"}tok`,
        });
      } catch (error) {
        const diagnostics =
          error instanceof CoachProviderError ? error.diagnostics : undefined;
        Object.assign(row, {
          ok: false,
          detail:
            error instanceof CoachProviderError
              ? [
                  error.code,
                  diagnostics?.stage,
                  diagnostics?.status,
                  diagnostics?.finishReason,
                  diagnostics?.issuePaths?.slice(0, 3).join("|"),
                ]
                  .filter(Boolean)
                  .join(" ")
              : `${error?.name ?? "Error"}: ${String(error?.message ?? "")
                  .replace(/s+/g, " ")
                  .slice(0, 160)}`,
        });
      }
      Object.assign(row, {
        seconds: (Date.now() - started) / 1000,
        http: statuses.join(",") || "-",
      });
      results.push(row);
      console.log(
        `${row.ok ? "OK  " : "FAIL"} ${model.padEnd(24)} r${round} ${question.label.padEnd(9)} ${row.seconds.toFixed(1).padStart(5)}s  http=${row.http.padEnd(11)} ${row.detail}`,
      );
    }
  }
}
console.log("\nResumo por modelo:");
for (const model of models) {
  const rows = results.filter((row) => row.model === model);
  const ok = rows.filter((row) => row.ok);
  const transient = rows.reduce(
    (total, row) =>
      total +
      row.http
        .split(",")
        .filter((s) => ["500", "502", "503", "504"].includes(s)).length,
    0,
  );
  console.log(
    `${model.padEnd(24)} sucesso ${ok.length}/${rows.length}  mediana ${(median(ok.map((row) => row.seconds)) ?? 0).toFixed(1)}s  respostas 5xx ${transient}`,
  );
  // Failure reasons grouped, so the summary alone explains every FAIL.
  const reasons = new Map();
  for (const row of rows.filter((item) => !item.ok)) {
    const reason = row.detail.slice(0, 110);
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  for (const [reason, count] of reasons)
    console.log(`${"".padEnd(24)}   ${count}x ${reason}`);
}
