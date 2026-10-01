// Manual Coach PROPOSAL evaluation (ADR-0118). Production path for the
// proposal step: AnalyzeAthleteWithCoach (analysis model) then
// GenerateCoachProposal (deterministic validation + coach-governance-v1) with
// each proposal model, against a SYNTHETIC athlete whose recorded sets are
// clearly easier than planned at the prescribed 40 kg (12 reps @ RIR 4 vs
// 8-10 @ RIR 2).
// Prints outcomes only (no model text, no key). Ledger is in memory.
//
// Usage (PowerShell, key typed at runtime, only in this session):
//   $env:GEMINI_API_KEY = Read-Host "GEMINI_API_KEY"
//   node scripts/eval-coach-proposals.mjs [--rounds 2] [--models a,b] [--analysis-model m]
//   Remove-Item Env:GEMINI_API_KEY
import {
  AnalyzeAthleteWithCoach,
  CoachProposalBlockedError,
  CoachProviderError,
  GenerateCoachProposal,
} from "../packages/application/src/index.ts";
import {
  DeterministicCoachSafetyPolicy,
  GeminiHttpCoachModelProvider,
  GeminiHttpCoachProposalProvider,
} from "../packages/ai/src/index.ts";
import { buildAthleteTrainingDossier } from "../packages/domain/src/index.ts";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("Defina GEMINI_API_KEY nesta sessao (veja o topo do arquivo).");
  process.exit(1);
}
const models = argument(
  "models",
  "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.8-flash",
).split(",");
const analysisModel = argument("analysis-model", "gemini-3.5-flash-lite");
const rounds = Number(argument("rounds", "2"));
// --schema off: diagnostic only, sends the proposal request without
// responseJsonSchema (JSON mode stays on); validation is unchanged.
const proposalSchema = argument("schema", "on");
const withoutSchema = async (url, init) => {
  const body = JSON.parse(init.body);
  delete body.generationConfig.responseJsonSchema;
  return fetch(url, { ...init, body: JSON.stringify(body) });
};
const config = (model) => ({
  apiKey,
  model,
  temperature: 0.2,
  timeoutMs: 60_000,
  maxOutputTokens: 8192,
});

// Synthetic active program: 1 day, 1 exercise, 3 sets of 8-10 reps @ RIR 2 with
// a PRESCRIBED absolute load of 40 kg (a program-level change is then
// justified when the athlete keeps exceeding it; with athlete-selected load
// the right answer is athlete guidance, not a program change).
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const generatedAt = "2026-09-28T12:00:00.000Z";
const ids = {
  athlete: uuid(1),
  program: uuid(2),
  block: uuid(3),
  week: uuid(4),
  day: uuid(5),
  prescription: uuid(6),
  exercise: uuid(7),
  sets: [uuid(8), uuid(9), uuid(10)],
};
const program = {
  id: ids.program,
  lineageTracked: true,
  athleteId: ids.athlete,
  athleteGoalId: null,
  name: "Programa sintetico",
  description: null,
  status: "active",
  revision: 1,
  supersedesProgramId: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  activatedAt: "2026-09-01T12:00:00.000Z",
  completedAt: null,
  archivedAt: null,
  blocks: [
    {
      id: ids.block,
      lineageId: uuid(103),
      sequence: 1,
      name: "Base",
      description: null,
      weeks: [
        {
          id: ids.week,
          lineageId: uuid(104),
          sequence: 1,
          name: "Semana 1",
          notes: null,
          days: [
            {
              id: ids.day,
              lineageId: uuid(105),
              sequence: 1,
              name: "Treino A",
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                {
                  id: ids.prescription,
                  lineageId: uuid(106),
                  exerciseId: ids.exercise,
                  exerciseName: "Supino reto",
                  sequence: 1,
                  instructions: null,
                  athleteCues: null,
                  sets: ids.sets.map((id, index) => ({
                    id,
                    lineageId: uuid(200 + index),
                    sequence: index + 1,
                    targetMetric: "reps",
                    targetMin: 8,
                    targetMax: 10,
                    rirMin: 2,
                    rirMax: 2,
                    restMinSeconds: 120,
                    restMaxSeconds: 120,
                    tempo: null,
                    loadKind: "absolute",
                    loadKg: 40,
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
// 6 sessions over 3 weeks, every set clearly easy: 12 reps x 40 kg @ RIR 4.
const sessions = Array.from({ length: 6 }, (_, index) => {
  const startedAt = new Date(
    Date.parse(generatedAt) - (20 - index * 3.5) * 86_400_000,
  ).toISOString();
  const id = uuid(300 + index);
  return {
    id,
    athleteId: ids.athlete,
    sourceTrainingDayId: ids.day,
    programName: program.name,
    dayName: "Treino A",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      {
        id: uuid(400 + index),
        sourceExercisePrescriptionId: ids.prescription,
        exerciseId: ids.exercise,
        sequence: 1,
        exerciseName: "Supino reto",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: ids.sets.map((setId, setIndex) => ({
          id: uuid(500 + index * 10 + setIndex),
          sourcePrescriptionSetId: setId,
          sequence: setIndex + 1,
          status: "completed",
          plannedMetric: "reps",
          plannedTargetMin: 8,
          plannedTargetMax: 10,
          plannedRirMin: 2,
          plannedRirMax: 2,
          plannedRestMinSeconds: 120,
          plannedRestMaxSeconds: 120,
          plannedTempo: null,
          plannedLoadKind: "absolute",
          plannedLoadKg: 40,
          actualValue: 12,
          actualLoadKg: 40,
          actualRir: 4,
          performedAt: startedAt,
          restStartedAt: startedAt,
          restEndedAt: startedAt,
        })),
      },
    ],
  };
});
const dossier = buildAthleteTrainingDossier({
  snapshot: {
    athlete: {
      id: ids.athlete,
      userId: uuid(11),
      onboardingCompletedAt: "2026-08-01T00:00:00Z",
    },
    profile: {
      athleteId: ids.athlete,
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
  activeProgram: program,
  sessions,
  generatedAt,
});
// Deterministic progression signals (dossier v8): expected above_plan, 41-42 kg.
for (const signal of dossier.progressionSignals)
  console.log(
    `sinal ${signal.exerciseName}: ${signal.direction} ${signal.recommendation} faixas [${signal.sets
      .map((set) =>
        set.suggestedLoadKg
          ? `${set.suggestedLoadKg.min}-${set.suggestedLoadKg.max} kg`
          : "-",
      )
      .join(", ")}]`,
  );
const question =
  "Os ultimos treinos ficaram faceis: com os 40 kg prescritos fiz 12 repeticoes com RIR 4 em todas as series, e o plano era 8 a 10 repeticoes com RIR 2. Sugira um ajuste concreto no meu programa ativo.";

const describe = (error) => {
  if (error instanceof CoachProposalBlockedError)
    return `BLOQUEADA ${error.reasons.join(",")} (${error.issues.length} issue(s))`;
  if (error instanceof CoachProviderError) {
    const d = error.diagnostics ?? {};
    return `PROVIDER ${error.code} ${[d.stage, d.status, d.finishReason, d.issuePaths?.slice(0, 3).join("|")].filter(Boolean).join(" ")}`;
  }
  return `INVALIDA ${error?.name ?? "Error"}: ${String(error?.message ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 120)}`;
};
const results = [];
for (let round = 1; round <= rounds; round += 1) {
  let analysis;
  try {
    analysis = await new AnalyzeAthleteWithCoach(
      { execute: async () => dossier },
      new GeminiHttpCoachModelProvider(config(analysisModel)),
      new DeterministicCoachSafetyPolicy(),
    ).execute({ userRequest: question, analysisMode: "question" });
  } catch (error) {
    console.log(`r${round} analise FALHOU: ${describe(error)}`);
    continue;
  }
  const categories =
    analysis.recommendations.map((item) => item.category).join(",") || "-";
  console.log(
    `r${round} analise (${analysisModel}): recomendacoes [${categories}]`,
  );
  for (const model of models) {
    const started = Date.now();
    const ledger = {
      findByAnalysisRequestId: async () => null,
      create: async (proposal, envelope) => ({
        id: uuid(999),
        status: "proposed",
        proposal,
        governance: envelope.governance,
      }),
    };
    const generate = new GenerateCoachProposal(
      { execute: async () => dossier },
      { getActive: async () => program },
      new GeminiHttpCoachProposalProvider(
        config(model),
        proposalSchema === "off" ? withoutSchema : fetch,
      ),
      ledger,
    );
    let outcome;
    try {
      const decision = await generate.execute({
        analysisRequestId: crypto.randomUUID(),
        analysis,
        trainingAdviceBlocked: false,
        sourceProgram: { id: program.id, revision: program.revision },
        createdAt: generatedAt,
        requestFingerprint: null,
      });
      outcome = decision
        ? `PROPOSTA ${decision.proposal.actions.length} acao(oes) [${decision.proposal.actions.map((a) => a.kind).join(",")}] revisao=${decision.governance?.reviewClass ?? "?"}`
        : "SEM AJUSTE (proposal null)";
    } catch (error) {
      outcome = describe(error);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    results.push({ model, outcome });
    console.log(`  ${model.padEnd(24)} ${seconds.padStart(5)}s  ${outcome}`);
  }
}
console.log(`\nResumo por modelo (proposta, schema ${proposalSchema}):`);
for (const model of models) {
  const rows = results.filter((row) => row.model === model);
  const count = (prefix) =>
    rows.filter((row) => row.outcome.startsWith(prefix)).length;
  console.log(
    `${model.padEnd(24)} proposta ${count("PROPOSTA")}/${rows.length}  sem ajuste ${count("SEM AJUSTE")}  bloqueada ${count("BLOQUEADA")}  invalida ${count("INVALIDA")}  provider ${count("PROVIDER")}`,
  );
}
