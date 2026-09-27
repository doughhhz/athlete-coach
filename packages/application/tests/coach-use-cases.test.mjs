import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalyzeAthleteWithCoach,
  CoachProviderError,
  InvalidCoachEvidenceError,
  coachAnalysisSchema,
} from "../src/index.ts";

const dossier = {
  schemaVersion: "athlete-training-dossier-v1",
  generatedAt: "2026-09-26T12:00:00.000Z",
  athlete: {
    athleteId: "a",
    preferredName: null,
    timezone: "UTC",
    currentGoal: null,
    trainingContext: null,
    availableWeekdays: [],
    latestBodyWeight: null,
  },
  activeProgram: null,
  windows: [],
  last28DaysExerciseExposure: [],
  exerciseSignals: [],
  dataCoverageLast28Days: {
    completedSetsCount: 0,
    loadRecordedCount: 0,
    loadCoverageRate: null,
    rirEligibleCount: 0,
    rirRecordedCount: 0,
    rirCoverageRate: null,
    restEligibleCount: 0,
    restMeasuredCount: 0,
    restCoverageRate: null,
  },
  personalBests: [],
  recentSessions: {
    totalAvailable: 1,
    included: 1,
    hasMore: false,
    items: [
      {
        id: "session-1",
        status: "completed",
        startedAt: "2026-09-25T12:00:00Z",
        programName: "P",
        dayName: "D",
        sourceTrainingDayId: "day-1",
        sourceProgram: null,
        evidence: [{ kind: "workout_session", id: "session-1", version: null }],
      },
    ],
  },
  evidence: [],
};
const analysis = (evidence = []) => ({
  schemaVersion: "coach-analysis-v1",
  analysisId: "analysis-1",
  requestId: "request-1",
  createdAt: "2026-09-26T12:00:00.000Z",
  summary: "Há poucos dados para uma conclusão firme.",
  observations: [
    {
      id: "o1",
      statement: "Existe uma sessão recente.",
      evidence,
      confidence: "low",
      limitations: ["Janela curta."],
    },
  ],
  hypotheses: [],
  recommendations: [
    {
      id: "r1",
      statement: "Continue registrando.",
      evidence,
      confidence: "low",
      limitations: [],
      category: "ask_for_more_data",
      rationale: "Mais dados melhoram a comparação.",
      requiresHumanReview: true,
    },
  ],
  questions: [],
  uncertainties: [
    { id: "u1", statement: "Pouca cobertura.", relatedEvidence: [] },
  ],
  evidenceUsed: evidence,
  safetyFlags: [],
  metadata: {
    dossierSchemaVersion: "athlete-training-dossier-v1",
    promptVersion: "coach-system-v1",
    policyVersion: "coach-safety-v1",
    provider: "fixture",
    model: "deterministic",
    inputTokens: null,
    outputTokens: null,
  },
});
const safety = {
  evaluateInput: () => ({ flags: [], blockProvider: false }),
  evaluateOutput: (value) => value,
};
test("validates the structured response vocabulary and required human review", () => {
  assert.equal(
    coachAnalysisSchema.parse(analysis()).recommendations[0]
      .requiresHumanReview,
    true,
  );
  assert.equal(
    coachAnalysisSchema.safeParse({ ...analysis(), summary: "" }).success,
    false,
  );
  assert.equal(
    coachAnalysisSchema.safeParse({
      ...analysis(),
      observations: [{ ...analysis().observations[0], confidence: "87%" }],
    }).success,
    false,
  );
});
test("accepts only evidence present in the dossier", async () => {
  const provider = {
    analyze: async () => ({
      analysis: analysis([
        { kind: "workout_session", id: "session-1", version: null },
      ]),
      provider: "fixture",
      model: "deterministic",
      inputTokens: null,
      outputTokens: null,
    }),
  };
  const result = await new AnalyzeAthleteWithCoach(
    { execute: async () => dossier },
    provider,
    safety,
    () => "request-1",
  ).execute({
    userRequest: "Avalie meu treino",
    analysisMode: "general_review",
  });
  assert.equal(result.observations.length, 1);
});
test("rejects hallucinated evidence", async () => {
  const provider = {
    analyze: async () => ({
      analysis: analysis([
        { kind: "workout_session", id: "missing", version: null },
      ]),
      provider: "fixture",
      model: "deterministic",
      inputTokens: null,
      outputTokens: null,
    }),
  };
  await assert.rejects(
    () =>
      new AnalyzeAthleteWithCoach(
        { execute: async () => dossier },
        provider,
        safety,
        () => "request-1",
      ).execute({ userRequest: "Avalie", analysisMode: "workout_review" }),
    InvalidCoachEvidenceError,
  );
});
test("bounds conversation context", async () => {
  let seen;
  const provider = {
    analyze: async (request) => {
      seen = request;
      return {
        analysis: analysis(),
        provider: "fixture",
        model: "deterministic",
        inputTokens: null,
        outputTokens: null,
      };
    },
  };
  await new AnalyzeAthleteWithCoach(
    { execute: async () => dossier },
    provider,
    safety,
    () => "request-1",
  ).execute({
    userRequest: "Pergunta",
    analysisMode: "question",
    conversationContext: Array.from({ length: 9 }, (_, i) => ({
      role: "user",
      content: String(i),
    })),
  });
  assert.equal(seen.conversationContext.length, 6);
  assert.equal(seen.conversationContext[0].content, "3");
});
test("returns deterministic safety response without invoking provider", async () => {
  let calls = 0;
  const blocking = {
    evaluateInput: () => ({
      flags: [
        {
          kind: "acute_pain",
          message: "Pare e procure avaliação.",
          blocksTrainingAdvice: true,
        },
      ],
      blockProvider: true,
    }),
    evaluateOutput: (value) => value,
  };
  const result = await new AnalyzeAthleteWithCoach(
    { execute: async () => dossier },
    {
      analyze: async () => {
        calls++;
        throw new CoachProviderError("unavailable", "no");
      },
    },
    blocking,
    () => "request-1",
  ).execute({ userRequest: "Dor aguda", analysisMode: "question" });
  assert.equal(calls, 0);
  assert.equal(result.safetyFlags[0].kind, "acute_pain");
});
test("propagates normalized provider timeout and unavailable errors", async () => {
  for (const code of ["timeout", "unavailable"])
    await assert.rejects(
      () =>
        new AnalyzeAthleteWithCoach(
          { execute: async () => dossier },
          {
            analyze: async () => {
              throw new CoachProviderError(code, code);
            },
          },
          safety,
        ).execute({ userRequest: "Pergunta", analysisMode: "question" }),
      (error) => error.code === code,
    );
});
