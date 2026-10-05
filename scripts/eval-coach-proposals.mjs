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
//   $env:NVIDIA_API_KEY = Read-Host "NVIDIA_API_KEY"   (opcional, para modelos nvidia/...)
//   node scripts/eval-coach-proposals.mjs [--rounds 2] [--models a,b] [--analysis-model m]
//   Remove-Item Env:GEMINI_API_KEY
//   Remove-Item Env:NVIDIA_API_KEY
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
  createRoutingFetch,
} from "../packages/ai/src/index.ts";
import { easyTrainingFixture } from "./eval-fixtures.mjs";

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

const { program, sessions, dossier, question } = easyTrainingFixture();
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
      new GeminiHttpCoachModelProvider(config(analysisModel), aiFetch()),
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
        aiFetch(proposalSchema === "off" ? withoutSchema : fetch),
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
