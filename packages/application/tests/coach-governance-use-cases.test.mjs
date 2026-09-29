import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalyzeAthleteWithCoachAndGovernance,
  ApproveCoachProposal,
  CoachProviderError,
  ElevatedReviewConfirmationRequiredError,
  GenerateCoachProposal,
  GetCoachAutonomyMode,
  SetCoachAutonomyMode,
  memoizeDossier,
} from "../src/index.ts";

const ids = {
  athlete: "00000000-0000-4000-8000-000000000001",
  program: "00000000-0000-4000-8000-000000000002",
  day: "00000000-0000-4000-8000-000000000003",
  prescription: "00000000-0000-4000-8000-000000000004",
  set: "00000000-0000-4000-8000-000000000005",
  proposal: "00000000-0000-4000-8000-000000000006",
  analysis: "00000000-0000-4000-8000-000000000007",
  request: "00000000-0000-4000-8000-0000000000aa",
};
const evidence = { kind: "training_program", id: ids.program, version: "1" };
const baseSet = {
  id: ids.set,
  sequence: 1,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 1,
  rirMax: 2,
  restMinSeconds: 90,
  restMaxSeconds: 120,
  tempo: null,
  loadKind: "absolute",
  loadKg: 40,
};
const program = {
  id: ids.program,
  athleteId: ids.athlete,
  athleteGoalId: null,
  name: "P",
  description: null,
  status: "active",
  revision: 1,
  supersedesProgramId: null,
  createdAt: "",
  updatedAt: "",
  activatedAt: "",
  completedAt: null,
  archivedAt: null,
  blocks: [
    {
      id: "b",
      sequence: 1,
      name: "B",
      description: null,
      weeks: [
        {
          id: "w",
          sequence: 1,
          name: null,
          notes: null,
          days: [
            {
              id: ids.day,
              sequence: 1,
              name: "D",
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                {
                  id: ids.prescription,
                  exerciseId: "x",
                  exerciseName: "E",
                  sequence: 1,
                  instructions: null,
                  athleteCues: null,
                  sets: [baseSet],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const dossier = {
  schemaVersion: "athlete-training-dossier-v5",
  activeProgram: { id: ids.program },
  evidence: [evidence],
  last28DaysExerciseExposure: [],
  personalBests: [],
  windows: [],
  recentSessions: { items: [] },
  exerciseSignals: [],
};
const analysis = {
  analysisId: ids.analysis,
  summary: "Análise",
  safetyFlags: [],
  metadata: {
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-system-v5",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
};
const action = (change = {}) => ({
  kind: "adjust_prescription_rir",
  trainingDayId: ids.day,
  exercisePrescriptionId: ids.prescription,
  prescriptionSetId: ids.set,
  rirMin: 2,
  rirMax: 3,
  rationale: "Monitorar esforço",
  evidence: [evidence],
  ...change,
});
const proposal = (actions = [action()]) => ({
  schemaVersion: "coach-proposal-v1",
  id: ids.proposal,
  analysisId: ids.analysis,
  sourceProgramId: ids.program,
  sourceProgramRevision: 1,
  createdAt: "2026-10-01T12:00:00Z",
  summary: "Ajuste",
  rationale: "Racional suficiente",
  evidenceReferences: [evidence],
  actions,
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "Análise",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-system-v5",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
});

function ledger() {
  const rows = [];
  return {
    rows,
    create: async (value, envelope) => {
      const existing = rows.find(
        (row) =>
          envelope.analysisRequestId &&
          row.analysisRequestId === envelope.analysisRequestId,
      );
      if (existing) return existing;
      const row = {
        id: `decision-${rows.length + 1}`,
        proposal: value,
        ...envelope,
      };
      rows.push(row);
      return row;
    },
    findByAnalysisRequestId: async (id) =>
      rows.find((row) => row.analysisRequestId === id) ?? null,
  };
}
function generator(output = proposal(), fail = null) {
  const decisions = ledger();
  const calls = { provider: 0 };
  const useCase = new GenerateCoachProposal(
    { execute: async () => dossier },
    { getActive: async () => program },
    {
      generate: async () => {
        calls.provider += 1;
        if (fail) throw fail;
        return output;
      },
    },
    decisions,
    () => "request",
  );
  return { useCase, decisions, calls };
}
const preferences = (mode) => ({
  getAutonomyMode: async () => {
    if (mode instanceof Error) throw mode;
    return mode;
  },
  setAutonomyMode: async (value) => value,
});
function orchestrator(
  mode,
  { output, fail, analysisValue = analysis, budget } = {},
) {
  const generated = generator(output, fail);
  const analyzeCalls = [];
  return {
    ...generated,
    analyzeCalls,
    useCase: new AnalyzeAthleteWithCoachAndGovernance(
      {
        execute: async (input) => {
          analyzeCalls.push(input);
          return analysisValue;
        },
      },
      generated.useCase,
      preferences(mode),
      budget,
      () => ids.request,
    ),
  };
}
const input = {
  userRequest: "Como estou?",
  analysisMode: "question",
  analysisRequestId: ids.request,
};

test("manual generation persists a backend-computed governance envelope", async () => {
  const { useCase, decisions } = generator();
  const decision = await useCase.execute(analysis);
  assert.equal(decision.proposalOrigin, "manual");
  assert.equal(decision.analysisRequestId, null);
  assert.deepEqual(decision.governance, {
    policyVersion: "coach-governance-v1",
    reviewClass: "standard_review",
    reasons: ["planned_rir_increase"],
  });
  assert.equal(decisions.rows.length, 1);
});

test("manual retry of the same analysis reuses the decision without the provider", async () => {
  const { useCase, calls, decisions } = generator();
  const options = { analysisRequestId: ids.request };
  const first = await useCase.execute(analysis, options);
  const second = await useCase.execute(analysis, options);
  assert.equal(first.id, second.id);
  assert.equal(calls.provider, 1);
  assert.equal(decisions.rows.length, 1);
});

test("invalid idempotency keys are rejected before any provider call", async () => {
  const { useCase, calls } = generator();
  await assert.rejects(() =>
    useCase.execute(analysis, { analysisRequestId: "not-a-uuid" }),
  );
  assert.equal(calls.provider, 0);
});

test("manual mode never makes the second call", async () => {
  const { useCase, calls, decisions } = orchestrator("manual");
  const result = await useCase.execute(input);
  assert.equal(result.analysis, analysis);
  assert.equal(result.proactiveProposal.status, "not_enabled");
  assert.equal(calls.provider, 0);
  assert.equal(decisions.rows.length, 0);
});

test("proactive mode prepares a persisted proposal for review only", async () => {
  const { useCase, decisions } = orchestrator("proactive");
  const result = await useCase.execute(input);
  assert.equal(result.proactiveProposal.status, "prepared");
  const decision = result.proactiveProposal.decision;
  assert.equal(decision.proposalOrigin, "proactive");
  assert.equal(decision.autonomyModeAtCreation, "proactive");
  assert.equal(decision.analysisRequestId, ids.request);
  assert.equal(decisions.rows.length, 1);
  assert.equal("materialize" in decisions, false);
});

test("proactive retry with the same request is idempotent", async () => {
  const { useCase, calls, decisions } = orchestrator("proactive");
  const first = await useCase.execute(input);
  const second = await useCase.execute(input);
  assert.equal(
    first.proactiveProposal.decision.id,
    second.proactiveProposal.decision.id,
  );
  assert.equal(calls.provider, 1);
  assert.equal(decisions.rows.length, 1);
});

test("proactive no-change creates no decision", async () => {
  const { useCase, decisions } = orchestrator("proactive", { output: null });
  const result = await useCase.execute(input);
  assert.equal(result.proactiveProposal.status, "no_change");
  assert.equal(result.proactiveProposal.decision, null);
  assert.equal(decisions.rows.length, 0);
});

test("invalid proactive proposal keeps the analysis and persists nothing", async () => {
  const { useCase, decisions } = orchestrator("proactive", {
    output: proposal([
      action({ prescriptionSetId: "00000000-0000-4000-8000-000000000099" }),
    ]),
  });
  const result = await useCase.execute(input);
  assert.equal(result.analysis, analysis);
  assert.equal(result.proactiveProposal.status, "invalid");
  assert.equal(decisions.rows.length, 0);
});

test("provider failure is isolated from the analysis", async () => {
  const { useCase } = orchestrator("proactive", {
    fail: new CoachProviderError("timeout", "slow"),
  });
  const result = await useCase.execute(input);
  assert.equal(result.analysis, analysis);
  assert.equal(result.proactiveProposal.status, "unavailable");
  assert.equal(
    result.proactiveProposal.unavailableReason,
    "provider_unavailable",
  );
});

test("safety block prevents the proposal provider call", async () => {
  const { useCase, calls, decisions } = orchestrator("proactive", {
    analysisValue: {
      ...analysis,
      safetyFlags: [{ blocksTrainingAdvice: true }],
    },
  });
  const result = await useCase.execute(input);
  assert.equal(result.proactiveProposal.status, "blocked");
  assert.deepEqual(result.proactiveProposal.reasons, [
    "safety_blocks_training_advice",
  ]);
  assert.equal(calls.provider, 0);
  assert.equal(decisions.rows.length, 0);
});

test("the proactive call consumes rate-limit budget", async () => {
  const { useCase, calls } = orchestrator("proactive", {
    budget: { tryConsume: () => false },
  });
  const result = await useCase.execute(input);
  assert.equal(result.proactiveProposal.unavailableReason, "rate_limited");
  assert.equal(calls.provider, 0);
});

test("preference failure never hides the analysis", async () => {
  const { useCase, calls } = orchestrator(new Error("db"));
  const result = await useCase.execute(input);
  assert.equal(result.analysis, analysis);
  assert.equal(result.proactiveProposal.status, "unavailable");
  assert.equal(calls.provider, 0);
});

test("a server key is generated when the client sends none", async () => {
  const { useCase } = orchestrator("manual");
  const result = await useCase.execute({ ...input, analysisRequestId: null });
  assert.equal(result.analysisRequestId, ids.request);
});

test("autonomy preference: explicit, validated mode", async () => {
  const repository = preferences("manual");
  assert.equal(await new GetCoachAutonomyMode(repository).execute(), "manual");
  assert.equal(
    await new SetCoachAutonomyMode(repository).execute("proactive"),
    "proactive",
  );
  await assert.rejects(() =>
    new SetCoachAutonomyMode(repository).execute("autonomous"),
  );
});

test("dossier is built once per orchestrated request", async () => {
  let builds = 0;
  const memo = memoizeDossier({
    execute: async () => {
      builds += 1;
      return dossier;
    },
  });
  await Promise.all([memo.execute(), memo.execute()]);
  assert.equal(builds, 1);
});

function approval(decision, source = program) {
  const materialized = [];
  return {
    materialized,
    useCase: new ApproveCoachProposal(
      {
        get: async () => decision,
        materialize: async (id) => {
          materialized.push(id);
          return { ...decision, status: "materialized" };
        },
      },
      { get: async () => source },
    ),
  };
}
const decisionWith = (actions, governance = null) => ({
  id: "d",
  proposal: proposal(actions),
  proposalOrigin: "manual",
  governance,
});

test("elevated review requires explicit confirmation before materialization", async () => {
  const elevated = decisionWith([action({ rirMin: 0, rirMax: 1 })]);
  const { useCase, materialized } = approval(elevated);
  await assert.rejects(
    () => useCase.execute("d"),
    ElevatedReviewConfirmationRequiredError,
  );
  assert.equal(materialized.length, 0);
  await useCase.execute("d", { confirmElevatedReview: true });
  assert.deepEqual(materialized, ["d"]);
});

test("standard review keeps the one-step draft creation", async () => {
  const { useCase, materialized } = approval(decisionWith([action()]));
  await useCase.execute("d");
  assert.deepEqual(materialized, ["d"]);
});

test("persisted elevated class is never downgraded by recomputation", async () => {
  const { useCase } = approval(
    decisionWith([action()], {
      policyVersion: "coach-governance-v1",
      reviewClass: "elevated_review",
      reasons: ["multiple_actions"],
    }),
  );
  await assert.rejects(
    () => useCase.execute("d", { reviewClass: "standard_review" }),
    ElevatedReviewConfirmationRequiredError,
  );
});

test("a changed source revision is doubt, hence elevated", async () => {
  const { useCase } = approval(decisionWith([action()]), {
    ...program,
    revision: 2,
  });
  await assert.rejects(
    () => useCase.execute("d"),
    ElevatedReviewConfirmationRequiredError,
  );
});
