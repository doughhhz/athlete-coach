// Manual evaluation of the Personal's INITIAL PROGRAM (ADR-0119). Production
// path: GenerateInitialProgram (Safety Gate, envelope, one repair attempt,
// deterministic validation) with the Gemini provider, against SYNTHETIC
// athletes and the seeded catalog (read from supabase/seed.sql). Program
// creation is in memory. Prints outcomes only (no model text, no key).
//
// Usage (PowerShell, key typed at runtime, only in this session):
//   $env:NODE_OPTIONS="--use-system-ca"
//   $env:GEMINI_API_KEY = Read-Host "GEMINI_API_KEY"
//   $env:NVIDIA_API_KEY = Read-Host "NVIDIA_API_KEY"   (opcional, para modelos nvidia/...)
//   node scripts/eval-initial-program.mjs [--rounds 1] [--models a,b] [--personas 1,2]
//   Remove-Item Env:GEMINI_API_KEY
//   Remove-Item Env:NVIDIA_API_KEY
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CoachProviderError,
  CreateTrainingProgramWithStructure,
  GenerateInitialProgram,
  InitialProgramBlockedError,
  InitialProgramInvalidError,
} from "../packages/application/src/index.ts";
import {
  DeterministicCoachSafetyPolicy,
  GeminiHttpInitialProgramProvider,
  createRoutingFetch,
} from "../packages/ai/src/index.ts";
import { estimateSessionMinutes } from "../packages/domain/src/index.ts";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
// Gemini and/or NVIDIA (ADR-0128): "nvidia/..." models go to NVIDIA.
const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
const nvidiaApiKey = process.env.NVIDIA_API_KEY?.trim();
if (!apiKey && !nvidiaApiKey) {
  console.error(
    "Defina GEMINI_API_KEY e/ou NVIDIA_API_KEY nesta sessao (veja o topo do arquivo).",
  );
  process.exit(1);
}
const aiFetch = (base = fetch) =>
  createRoutingFetch({ nvidiaApiKey, baseFetch: base });
const models = argument("models", "gemini-3.5-flash-lite").split(",");
const rounds = Number(argument("rounds", "1"));

// Seeded catalog: exercises (sequence -> deterministic id) and equipment.
const seed = await readFile(
  resolve(import.meta.dirname, "../supabase/seed.sql"),
  "utf8",
);
const exercisePattern =
  /\((\d+),'([a-z0-9-]+)','((?:[^']|'')*)','(?:[^']|'')*','(?:[^']|'')*','([a-z_]+)','([a-z]+)','([a-z]+)',(?:'([a-z]+)'|null)\)/g;
const equipmentBlock = seed.slice(
  seed.indexOf("with a(exercise_slug,equipment_slug,is_primary)"),
);
const equipmentBySlug = new Map();
for (const [, exercise, equipment] of equipmentBlock
  .slice(0, equipmentBlock.indexOf("insert into"))
  .matchAll(/\('([a-z0-9-]+)','([a-z0-9-]+)',(?:true|false)\)/g))
  equipmentBySlug.set(exercise, [
    ...(equipmentBySlug.get(exercise) ?? []),
    equipment,
  ]);
const catalog = [...seed.matchAll(exercisePattern)].map(
  ([
    ,
    sequence,
    slug,
    namePt,
    movementPattern,
    mechanics,
    laterality,
    difficulty,
  ]) => ({
    id: `50000000-0000-4000-8000-${sequence.padStart(12, "0")}`,
    slug,
    namePt: namePt.replaceAll("''", "'"),
    movementPattern,
    mechanics,
    laterality,
    difficulty: difficulty ?? null,
    equipmentSlugs: (equipmentBySlug.get(slug) ?? []).sort(),
  }),
);
if (catalog.length < 30)
  throw new Error(`Catalogo inesperado: ${catalog.length}`);

const base = {
  athlete: {
    id: "athlete",
    userId: "user",
    onboardingCompletedAt: "2026-09-01T00:00:00Z",
  },
  profile: {
    athleteId: "athlete",
    birthDate: "1990-06-15",
    heightCm: 178,
    preferredName: "Atleta",
    timezone: "America/Sao_Paulo",
  },
  latestWeight: {
    athleteId: "athlete",
    id: "w",
    measuredAt: "2026-09-01T00:00:00Z",
    source: "manual",
    weightKg: 82,
  },
};
const goal = (goalType, notes = null) => ({
  athleteId: "athlete",
  goalType,
  id: "goal",
  notes,
  startedAt: "2026-09-01T00:00:00Z",
  targetWeightKg: null,
});
const context = (change) => ({
  athleteId: "athlete",
  averageSleepMinutes: 420,
  constraintsNotes: null,
  preferredSessionDurationMinutes: 60,
  preferencesNotes: null,
  recentTrainingConsistency: "consistent",
  resistanceTrainingMonths: 12,
  routineSummary: "Trabalho em escritorio, treino depois das 18h",
  trainingEnvironment: "commercial_gym",
  ...change,
});
const intake = (change = {}) => ({
  athleteId: "athlete",
  currentPainOrInjury: false,
  painOrInjuryNotes: null,
  medicalExerciseRestriction: false,
  preferredExercisesNotes: null,
  avoidedExercisesNotes: null,
  otherSportsNotes: null,
  availableEquipment: null,
  updatedAt: "2026-10-01T00:00:00Z",
  ...change,
});
const personas = [
  {
    name: "1 iniciante hipertrofia academia 3d/60min",
    snapshot: {
      ...base,
      activeGoal: goal("hypertrophy"),
      trainingContext: context({ resistanceTrainingMonths: 2 }),
      availableWeekdays: [1, 3, 5],
    },
    intake: intake({ preferredExercisesNotes: "Gosto de supino e remada" }),
  },
  {
    name: "2 recomecando emagrecimento casa 4d/45min joelho",
    snapshot: {
      ...base,
      activeGoal: goal("fat_loss"),
      trainingContext: context({
        resistanceTrainingMonths: 30,
        recentTrainingConsistency: "restarting",
        preferredSessionDurationMinutes: 45,
        trainingEnvironment: "home_gym",
      }),
      availableWeekdays: [1, 2, 4, 5],
    },
    intake: intake({
      currentPainOrInjury: true,
      painOrInjuryNotes:
        "Joelho direito sensivel em agachamento profundo, sem dor no dia a dia",
      otherSportsNotes: "Corrida leve aos domingos",
    }),
  },
  {
    name: "3 avancado forca academia 5d/90min futebol",
    snapshot: {
      ...base,
      activeGoal: goal("strength", "Quero melhorar agachamento e supino"),
      trainingContext: context({
        resistanceTrainingMonths: 60,
        preferredSessionDurationMinutes: 90,
      }),
      availableWeekdays: [1, 2, 3, 4, 5, 6],
    },
    intake: intake({
      avoidedExercisesNotes: "Leg press",
      otherSportsNotes: "Futebol aos sabados",
    }),
  },
  {
    name: "4 62 anos condicionamento 2d/30min",
    snapshot: {
      ...base,
      profile: { ...base.profile, birthDate: "1964-03-10" },
      activeGoal: goal("general_fitness"),
      trainingContext: context({
        resistanceTrainingMonths: 0,
        recentTrainingConsistency: "irregular",
        preferredSessionDurationMinutes: 30,
        averageSleepMinutes: 360,
      }),
      availableWeekdays: [2, 4],
    },
    intake: intake(),
  },
];
const selected = argument(
  "personas",
  personas.map((_, index) => index + 1).join(","),
)
  .split(",")
  .map((value) => personas[Number(value) - 1])
  .filter(Boolean);

const describe = (error) => {
  if (error instanceof InitialProgramBlockedError)
    return `BLOQUEADO ${error.reason}`;
  if (error instanceof InitialProgramInvalidError)
    return `INVALIDO apos reparo [${[...new Set(error.issues.map((issue) => issue.code))].join(",")}]`;
  if (error instanceof CoachProviderError) {
    const d = error.diagnostics ?? {};
    return `PROVIDER ${error.code} ${[d.stage, d.status, d.finishReason, d.issuePaths?.slice(0, 3).join("|")].filter(Boolean).join(" ")}`;
  }
  return `ERRO ${error?.name ?? "Error"}: ${String(error?.message ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 120)}`;
};
const results = [];
for (let round = 1; round <= rounds; round += 1)
  for (const persona of selected)
    for (const model of models) {
      let created = null;
      const generate = new GenerateInitialProgram({
        profile: { execute: async () => persona.snapshot },
        intakes: {
          getCurrent: async () => persona.intake,
          saveCurrent: async () => persona.intake,
        },
        catalog: { listForProgram: async () => catalog },
        provider: new GeminiHttpInitialProgramProvider(
          {
            apiKey,
            model,
            fallbackModels: [],
            temperature: 0.3,
            timeoutMs: 60_000,
            maxOutputTokens: 16_384,
          },
          aiFetch(),
        ),
        safety: new DeterministicCoachSafetyPolicy(),
        create: new CreateTrainingProgramWithStructure({
          createWithStructure: async (input) => {
            created = input;
            return { id: crypto.randomUUID() };
          },
        }),
        log: { record: async () => {} },
      });
      const started = Date.now();
      let outcome;
      try {
        const result = await generate.execute({
          mode: "personal",
          creationRequestId: crypto.randomUUID(),
        });
        if (result.status === "created") {
          const days = created.structure.blocks[0].weeks[0].days;
          const minutes = days.map((day) =>
            estimateSessionMinutes({
              exercises: day.prescriptions.map((item) => ({
                ...item.sets[0],
                sets: item.sets.length,
              })),
            }),
          );
          outcome = `PROGRAMA ${days.length} dia(s) [${days.map((day) => `${day.preferredWeekday}:${day.prescriptions.length}ex`).join(" ")}] ~${minutes.join("/")} min${result.repaired ? " (reparado)" : ""}`;
        } else outcome = "RECUSOU (cannot_build)";
      } catch (error) {
        outcome = describe(error);
      }
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      results.push({ model, outcome });
      console.log(
        `r${round} ${persona.name.padEnd(48)} ${model.padEnd(22)} ${seconds.padStart(5)}s  ${outcome}`,
      );
    }
console.log("\nResumo por modelo:");
for (const model of models) {
  const rows = results.filter((row) => row.model === model);
  const count = (prefix) =>
    rows.filter((row) => row.outcome.startsWith(prefix)).length;
  const repaired = rows.filter((row) =>
    row.outcome.includes("(reparado)"),
  ).length;
  console.log(
    `${model.padEnd(24)} programa ${count("PROGRAMA")}/${rows.length} (reparados ${repaired})  recusou ${count("RECUSOU")}  invalido ${count("INVALIDO")}  bloqueado ${count("BLOQUEADO")}  provider ${count("PROVIDER")}  erro ${count("ERRO")}`,
  );
}
