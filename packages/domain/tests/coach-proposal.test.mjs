import assert from "node:assert/strict";
import test from "node:test";
import { validateCoachProposal } from "../src/index.ts";

const set = {
  id: "set",
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
  id: "program",
  athleteId: "athlete",
  athleteGoalId: null,
  name: "P",
  description: null,
  status: "active",
  revision: 2,
  supersedesProgramId: null,
  createdAt: "",
  updatedAt: "",
  activatedAt: "",
  completedAt: null,
  archivedAt: null,
  blocks: [
    {
      id: "block",
      sequence: 1,
      name: "B",
      description: null,
      weeks: [
        {
          id: "week",
          sequence: 1,
          name: null,
          notes: null,
          days: [
            {
              id: "day",
              sequence: 1,
              name: "D",
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                {
                  id: "prescription",
                  exerciseId: "exercise",
                  exerciseName: "E",
                  sequence: 1,
                  instructions: null,
                  athleteCues: null,
                  sets: [set],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const evidence = { kind: "training_program", id: "program", version: "2" };
const proposal = {
  schemaVersion: "coach-proposal-v1",
  id: "proposal",
  analysisId: "analysis",
  sourceProgramId: "program",
  sourceProgramRevision: 2,
  createdAt: "2026-09-27T12:00:00Z",
  summary: "Ajustar faixa",
  rationale: "Resposta recente.",
  evidenceReferences: [evidence],
  actions: [
    {
      kind: "adjust_prescription_target",
      trainingDayId: "day",
      exercisePrescriptionId: "prescription",
      prescriptionSetId: "set",
      targetMetric: "reps",
      targetMin: 6,
      targetMax: 8,
      rationale: "Ajuste pequeno.",
      evidence: [evidence],
    },
  ],
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-system-v1",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v1",
  },
};
const context = {
  athleteId: "athlete",
  sourceProgram: program,
  activeProgramId: "program",
  evidenceIds: new Set(["training_program:program"]),
};

test("accepts a grounded action against the active revision", () =>
  assert.equal(validateCoachProposal(proposal, context).valid, true));
for (const [name, changed, expected] of [
  ["wrong athlete", { ...context, athleteId: "other" }, "wrong_athlete"],
  [
    "wrong source",
    { ...proposal, sourceProgramId: "other" },
    "wrong_source_program",
  ],
  [
    "stale revision",
    { ...proposal, sourceProgramRevision: 1 },
    "stale_revision",
  ],
  [
    "missing evidence",
    { ...proposal, evidenceReferences: [{ ...evidence, id: "missing" }] },
    "invalid_evidence",
  ],
  [
    "missing entity",
    {
      ...proposal,
      actions: [{ ...proposal.actions[0], prescriptionSetId: "missing" }],
    },
    "missing_entity",
  ],
  ["empty actions", { ...proposal, actions: [] }, "invalid_action"],
  [
    "duplicate target",
    { ...proposal, actions: [proposal.actions[0], proposal.actions[0]] },
    "invalid_action",
  ],
])
  test(`rejects ${name}`, () => {
    const result = validateCoachProposal(
      changed.sourceProgram ? proposal : changed,
      changed.sourceProgram ? changed : context,
    );
    assert.equal(
      result.issues.some((issue) => issue.code === expected),
      true,
    );
  });

for (const action of [
  { ...proposal.actions[0], targetMin: 12, targetMax: 8 },
  {
    ...proposal.actions[0],
    kind: "adjust_prescription_rir",
    rirMin: 11,
    rirMax: 11,
  },
  {
    ...proposal.actions[0],
    kind: "adjust_prescription_rest",
    restMinSeconds: 120,
    restMaxSeconds: 60,
  },
  { ...proposal.actions[0], kind: "adjust_absolute_load_target", loadKg: -1 },
  { ...proposal.actions[0], targetMetric: "seconds" },
])
  test(`rejects invalid ${action.kind}`, () =>
    assert.equal(
      validateCoachProposal(
        { ...proposal, actions: [action] },
        context,
      ).issues.some((issue) => issue.code === "invalid_structure"),
      true,
    ));
