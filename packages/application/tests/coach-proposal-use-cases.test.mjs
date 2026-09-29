import assert from "node:assert/strict";
import test from "node:test";
import { analysisRecord } from "./fixtures/analysis-record.mjs";
import {
  GenerateCoachProposal,
  CoachProposalValidationError,
  RejectCoachProposal,
  ApproveCoachProposal,
} from "../src/index.ts";

const ids = {
  athlete: "00000000-0000-4000-8000-000000000001",
  program: "00000000-0000-4000-8000-000000000002",
  day: "00000000-0000-4000-8000-000000000003",
  prescription: "00000000-0000-4000-8000-000000000004",
  set: "00000000-0000-4000-8000-000000000005",
  proposal: "00000000-0000-4000-8000-000000000006",
  analysis: "00000000-0000-4000-8000-000000000007",
};
const evidence = { kind: "training_program", id: ids.program, version: "1" };
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
                  sets: [
                    {
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
                    },
                  ],
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
  schemaVersion: "athlete-training-dossier-v1",
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
    promptVersion: "coach-system-v1",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v1",
  },
};
const proposal = {
  schemaVersion: "coach-proposal-v1",
  id: ids.proposal,
  analysisId: ids.analysis,
  sourceProgramId: ids.program,
  sourceProgramRevision: 1,
  createdAt: "2026-09-27T12:00:00Z",
  summary: "Ajuste",
  rationale: "Racional suficiente",
  evidenceReferences: [evidence],
  actions: [
    {
      kind: "adjust_prescription_rir",
      trainingDayId: ids.day,
      exercisePrescriptionId: ids.prescription,
      prescriptionSetId: ids.set,
      rirMin: 2,
      rirMax: 3,
      rationale: "Monitorar esforço",
      evidence: [evidence],
    },
  ],
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "Análise",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-system-v1",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v1",
  },
};
function dependencies(output = proposal) {
  const saved = [];
  return {
    saved,
    useCase: new GenerateCoachProposal(
      { execute: async () => dossier },
      { getActive: async () => program },
      { generate: async () => output },
      {
        create: async (value) => {
          saved.push(value);
          return { id: "decision", proposal: value };
        },
        findByAnalysisRequestId: async () => null,
      },
      () => "request",
    ),
  };
}

test("generates, validates and persists a structured proposal", async () => {
  const { useCase, saved } = dependencies();
  const result = await useCase.execute(analysisRecord(analysis, program));
  assert.equal(result.id, "decision");
  assert.equal(saved.length, 1);
});
test("accepts a provider no-change result without persistence", async () => {
  const { useCase, saved } = dependencies(null);
  assert.equal(await useCase.execute(analysisRecord(analysis, program)), null);
  assert.equal(saved.length, 0);
});
test("rejects dangling IDs before persistence", async () => {
  const { useCase, saved } = dependencies({
    ...proposal,
    actions: [
      {
        ...proposal.actions[0],
        prescriptionSetId: "00000000-0000-4000-8000-000000000099",
      },
    ],
  });
  await assert.rejects(
    () => useCase.execute(analysisRecord(analysis, program)),
    CoachProposalValidationError,
  );
  assert.equal(saved.length, 0);
});
test("blocks proposal generation for safety-sensitive analysis", async () => {
  const { useCase } = dependencies();
  await assert.rejects(
    () =>
      useCase.execute(
        analysisRecord(
          { ...analysis, safetyFlags: [{ blocksTrainingAdvice: true }] },
          program,
        ),
      ),
    CoachProposalValidationError,
  );
});
test("decision commands delegate validated human intent", async () => {
  const repository = {
    reject: async (_id, reason) => ({
      status: "rejected",
      rejectionReason: reason,
    }),
    get: async () => ({
      proposal,
      proposalOrigin: "manual",
      governance: null,
    }),
    materialize: async () => ({ status: "materialized" }),
  };
  assert.equal(
    (
      await new RejectCoachProposal(repository).execute("d", {
        reason: "not_now",
      })
    ).status,
    "rejected",
  );
  assert.equal(
    (
      await new ApproveCoachProposal(repository, {
        get: async () => program,
      }).execute("d")
    ).status,
    "materialized",
  );
});
