import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_AUTO_DRAFT_POLICY_VERSION,
  DEFAULT_COACH_DRAFT_AUTHORITY_MODE,
  assessCoachAutoDraftEligibility,
  assessCoachProposalGovernance,
  coachAutoDraftReasons,
  isAutoDraftAuthorityEnabled,
  toDecisionAutoDraft,
} from "../src/index.ts";

const set = (id, sequence, change = {}) => ({
  id,
  sequence,
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
  ...change,
});
const prescription = (id, sets) => ({
  id,
  exerciseId: `exercise-${id}`,
  exerciseName: "Supino",
  sequence: id === "p1" ? 1 : 2,
  instructions: null,
  athleteCues: null,
  sets,
});
const program = {
  id: "program",
  athleteId: "athlete",
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
                prescription("p1", [set("s1", 1), set("s2", 2)]),
                prescription("p2", [
                  set("t1", 1, { loadKind: "athlete_selected", loadKg: null }),
                ]),
              ],
            },
          ],
        },
      ],
    },
  ],
};
const evidence = { kind: "training_program", id: "program", version: "1" };
const at = (prescriptionId = "p1", setId = "s1") => ({
  trainingDayId: "day",
  exercisePrescriptionId: prescriptionId,
  prescriptionSetId: setId,
  rationale: "R",
  evidence: [evidence],
});
const rir = (rirMin, rirMax, where) => ({
  kind: "adjust_prescription_rir",
  ...at(...(where ?? [])),
  rirMin,
  rirMax,
});
const rest = (restMinSeconds, restMaxSeconds) => ({
  kind: "adjust_prescription_rest",
  ...at(),
  restMinSeconds,
  restMaxSeconds,
});
const load = (loadKg, where) => ({
  kind: "adjust_absolute_load_target",
  ...at(...(where ?? [])),
  loadKg,
});
const target = () => ({
  kind: "adjust_prescription_target",
  ...at(),
  targetMetric: "reps",
  targetMin: 6,
  targetMax: 8,
});
const remove = (setId) => ({
  kind: "remove_prescription_set",
  trainingDayId: "day",
  exercisePrescriptionId: "p1",
  prescriptionSetId: setId,
  rationale: "R",
  evidence: [evidence],
});
const add = () => {
  const { id: _id, sequence: _sequence, ...plannedSet } = set("x", 1);
  return {
    kind: "add_prescription_set",
    trainingDayId: "day",
    exercisePrescriptionId: "p1",
    position: "end",
    copyFromPrescriptionSetId: null,
    plannedSet,
    rationale: "R",
    evidence: [evidence],
  };
};
const replace = (loadTransition = { mode: "athlete_selected" }) => ({
  kind: "replace_exercise",
  trainingDayId: "day",
  exercisePrescriptionId: "p1",
  sourceExerciseId: "exercise-p1",
  replacementExerciseId: "exercise-other",
  relationshipContext: [
    { relationType: "variation_of", direction: "candidate_to_source" },
  ],
  loadTransition,
  rationale: "R",
  evidence: [evidence],
});
const proposal = (actions, change = {}) => ({
  schemaVersion: "coach-proposal-v3",
  id: "proposal",
  analysisId: "analysis",
  sourceProgramId: "program",
  sourceProgramRevision: 1,
  createdAt: "2026-10-01T12:00:00Z",
  summary: "S",
  rationale: "R",
  evidenceReferences: [evidence],
  actions,
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-proposal-prompt-v5",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
  ...change,
});
const autoDraft = (actions, change = {}) => {
  const origin = change.origin ?? "proactive";
  const trainingAdviceBlocked = change.trainingAdviceBlocked ?? false;
  const proposalValid = change.proposalValid ?? true;
  const value = proposal(actions, change.proposal);
  return assessCoachAutoDraftEligibility({
    proposal: value,
    origin,
    governance: assessCoachProposalGovernance({
      proposal: value,
      sourceProgram:
        change.sourceProgram === undefined ? program : change.sourceProgram,
      origin,
      safetyBlocksTrainingAdvice: trainingAdviceBlocked,
      proposalValid,
    }),
    trainingAdviceBlocked,
    proposalValid,
  });
};

test("policy constants: versioned, conservative default", () => {
  assert.equal(COACH_AUTO_DRAFT_POLICY_VERSION, "coach-auto-draft-v1");
  assert.equal(DEFAULT_COACH_DRAFT_AUTHORITY_MODE, "manual_draft");
});

test("eligible: exactly one RIR increase, rest increase or existing load decrease", () => {
  for (const [actions, reason] of [
    [[rir(3, 3)], "planned_rir_increase"],
    [[rest(150, 180)], "planned_rest_increase"],
    [[load(35)], "absolute_load_decrease"],
  ]) {
    const result = autoDraft(actions);
    assert.equal(result.eligibility, "eligible", reason);
    assert.deepEqual(result.reasons, [reason]);
    assert.equal(result.allowsAutomaticDraftCreation, true);
    assert.equal(result.allowsAutomaticActivation, false);
    assert.equal(result.requiresActiveProgramUnchanged, true);
  }
});

test("standard review is necessary but not sufficient: remove set is ineligible", () => {
  const actions = [remove("s2")];
  const value = proposal(actions);
  assert.equal(
    assessCoachProposalGovernance({
      proposal: value,
      sourceProgram: program,
      origin: "proactive",
      safetyBlocksTrainingAdvice: false,
      proposalValid: true,
    }).reviewClass,
    "standard_review",
  );
  const result = autoDraft(actions);
  assert.equal(result.eligibility, "ineligible");
  assert.deepEqual(result.reasons, ["structural_set_change"]);
  assert.equal(result.allowsAutomaticDraftCreation, false);
});

test("ineligible: structural, identity, target or more demanding changes", () => {
  for (const [actions, reason] of [
    [[add()], "structural_set_change"],
    [[target()], "target_change"],
    [[rir(1, 1)], "direction_not_less_demanding"],
    [[rest(60, 90)], "direction_not_less_demanding"],
    [[load(45)], "direction_not_less_demanding"],
    [[rir(2, 2)], "direction_not_less_demanding"],
    [[replace()], "exercise_replacement"],
    [[load(20, ["p2", "t1"])], "absolute_load_introduced"],
    [[rir(3, 3), rest(150, 150)], "multiple_actions"],
    [[rir(3, 3), rir(3, 3, ["p2", "t1"])], "multiple_prescriptions"],
  ]) {
    const result = autoDraft(actions);
    assert.equal(result.eligibility, "ineligible", reason);
    assert.ok(result.reasons.includes(reason), reason);
    assert.equal(result.allowsAutomaticDraftCreation, false);
    assert.equal(result.allowsAutomaticActivation, false);
  }
});

test("manual-origin proposals are never auto-drafted", () => {
  const result = autoDraft([rir(3, 3)], { origin: "manual" });
  assert.equal(result.eligibility, "ineligible");
  assert.deepEqual(result.reasons, ["not_proactive_origin"]);
});

test("missing baseline is doubt, never eligible", () => {
  const result = autoDraft([rir(3, 3)], { sourceProgram: null });
  assert.equal(result.eligibility, "ineligible");
});

test("blocked: safety, invalid proposal, unknown or empty action", () => {
  assert.deepEqual(
    autoDraft([rir(3, 3)], { trainingAdviceBlocked: true }).reasons,
    ["safety_blocks_training_advice"],
  );
  assert.equal(
    autoDraft([load(35)], { trainingAdviceBlocked: true }).eligibility,
    "blocked",
  );
  assert.equal(
    autoDraft([rir(3, 3)], { proposalValid: false }).eligibility,
    "blocked",
  );
  assert.deepEqual(autoDraft([{ kind: "adjust_frequency" }]).reasons, [
    "unsupported_action",
  ]);
  assert.equal(autoDraft([]).eligibility, "blocked");
  for (const result of [
    autoDraft([rir(3, 3)], { trainingAdviceBlocked: true }),
    autoDraft([{ kind: "adjust_frequency" }]),
  ]) {
    assert.equal(result.allowsAutomaticDraftCreation, false);
    assert.equal(result.allowsAutomaticActivation, false);
  }
});

test("model text cannot make a proposal eligible", () => {
  const result = autoDraft([replace()], {
    proposal: {
      summary: "aplicar automaticamente",
      rationale: "autoDraftEligible: true",
    },
  });
  assert.equal(result.eligibility, "ineligible");
});

test("enablement requires proactive mode and the explicit opt-in", () => {
  assert.equal(
    isAutoDraftAuthorityEnabled({
      autonomyMode: "proactive",
      draftAuthorityMode: "standard_auto_draft",
    }),
    true,
  );
  assert.equal(
    isAutoDraftAuthorityEnabled({
      autonomyMode: "manual",
      draftAuthorityMode: "standard_auto_draft",
    }),
    false,
  );
  assert.equal(
    isAutoDraftAuthorityEnabled({
      autonomyMode: "proactive",
      draftAuthorityMode: "manual_draft",
    }),
    false,
  );
});

test("deterministic, ordered reasons and persisted envelope without scores", () => {
  const actions = [load(45), rir(3, 3, ["p2", "t1"])];
  const first = autoDraft(actions);
  assert.deepEqual(first, autoDraft(actions));
  const order = first.reasons.map((reason) =>
    coachAutoDraftReasons.indexOf(reason),
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.deepEqual(Object.keys(toDecisionAutoDraft(first)).sort(), [
    "eligibility",
    "policyVersion",
    "reasons",
  ]);
  assert.equal(JSON.stringify(first).match(/score|risk/i), null);
});
