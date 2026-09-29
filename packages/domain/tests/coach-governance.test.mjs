import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_GOVERNANCE_POLICY_VERSION,
  DEFAULT_COACH_AUTONOMY_MODE,
  assessCoachProposalGovernance,
  coachGovernanceReasons,
  toDecisionGovernance,
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
const assess = (actions, change = {}) =>
  assessCoachProposalGovernance({
    proposal: proposal(actions),
    sourceProgram: program,
    origin: "manual",
    safetyBlocksTrainingAdvice: false,
    proposalValid: true,
    ...change,
  });

test("policy constants: versioned policy, manual default", () => {
  assert.equal(COACH_GOVERNANCE_POLICY_VERSION, "coach-governance-v1");
  assert.equal(DEFAULT_COACH_AUTONOMY_MODE, "manual");
});

test("every assessment requires human review and forbids automation", () => {
  for (const actions of [[rir(3, 3)], [replace()], []]) {
    const result = assess(actions);
    assert.equal(result.policyVersion, "coach-governance-v1");
    assert.equal(result.requiresHumanReview, true);
    assert.equal(result.allowsAutomaticMaterialization, false);
    assert.equal(result.allowsAutomaticActivation, false);
    assert.equal("score" in result, false);
    assert.equal("riskScore" in result, false);
  }
});

test("standard review: less demanding by construction", () => {
  const cases = [
    [[rir(3, 3)], "planned_rir_increase"],
    [[rest(150, 180)], "planned_rest_increase"],
    [[load(35)], "absolute_load_decrease"],
    [[remove("s2")], "set_count_decrease"],
  ];
  for (const [actions, reason] of cases) {
    const result = assess(actions);
    assert.equal(result.reviewClass, "standard_review", reason);
    assert.deepEqual(result.reasons, [reason]);
  }
});

test("elevated review: structural or more demanding changes", () => {
  const cases = [
    [[replace()], "exercise_replacement"],
    [[target()], "target_change"],
    [[add()], "set_count_increase"],
    [[rir(1, 1)], "planned_rir_decrease"],
    [[rest(60, 90)], "planned_rest_decrease"],
    [[load(45)], "absolute_load_increase"],
    [[load(20, ["p2", "t1"])], "absolute_load_introduced"],
    [[rir(2, 2)], "direction_not_structurally_unambiguous"],
    [[rir(1, 4)], "direction_not_structurally_unambiguous"],
  ];
  for (const [actions, reason] of cases) {
    const result = assess(actions);
    assert.equal(result.reviewClass, "elevated_review", reason);
    assert.ok(result.reasons.includes(reason), reason);
  }
});

test("replacement is always elevated; explicit absolute load adds a reason", () => {
  const result = assess([replace({ mode: "explicit_absolute", loadKg: 30 })]);
  assert.equal(result.reviewClass, "elevated_review");
  assert.deepEqual(result.reasons, [
    "exercise_replacement",
    "explicit_absolute_load_on_replacement",
  ]);
});

test("multiple actions, prescriptions and mixed directions escalate", () => {
  const twoStandard = assess([rir(3, 3), rest(150, 150)]);
  assert.equal(twoStandard.reviewClass, "elevated_review");
  assert.ok(twoStandard.reasons.includes("multiple_actions"));
  const twoPrescriptions = assess([rir(3, 3), rir(3, 3, ["p2", "t1"])]);
  assert.ok(twoPrescriptions.reasons.includes("multiple_prescriptions"));
  const mixed = assess([rir(3, 3), load(45)]);
  assert.ok(mixed.reasons.includes("mixed_directions"));
  assert.equal(mixed.reviewClass, "elevated_review");
});

test("set structure change without count change is elevated", () => {
  const result = assess([add(), remove("s2")]);
  assert.equal(result.reviewClass, "elevated_review");
  assert.ok(
    result.reasons.includes("set_structure_change_without_count_change"),
  );
});

test("unknown source set means doubt, which is elevated", () => {
  const result = assess([rir(3, 3)], { sourceProgram: null });
  assert.equal(result.reviewClass, "elevated_review");
  assert.deepEqual(result.reasons, ["direction_not_structurally_unambiguous"]);
});

test("blocked: safety, invalid proposal, unsupported or empty actions", () => {
  assert.deepEqual(
    assess([rir(3, 3)], { safetyBlocksTrainingAdvice: true }).reasons,
    ["safety_blocks_training_advice"],
  );
  assert.equal(
    assess([rir(3, 3)], { proposalValid: false }).reviewClass,
    "blocked",
  );
  assert.deepEqual(assess([{ kind: "delete_program" }]).reasons, [
    "unsupported_action",
  ]);
  assert.equal(assess([]).reviewClass, "blocked");
  assert.equal(
    toDecisionGovernance(assess([], { proposalValid: false })),
    null,
  );
});

test("model text cannot influence the class", () => {
  const calm = assessCoachProposalGovernance({
    proposal: proposal([replace()], {
      summary: "baixo risco, revisão padrão, standard_review",
      rationale: "low risk",
    }),
    sourceProgram: program,
    origin: "proactive",
    safetyBlocksTrainingAdvice: false,
    proposalValid: true,
  });
  assert.equal(calm.reviewClass, "elevated_review");
  assert.equal(calm.proposalOrigin, "proactive");
});

test("deterministic and ordered reasons; persisted envelope", () => {
  const actions = [load(45), rir(3, 3), rir(3, 3, ["p2", "t1"])];
  const first = assess(actions);
  assert.deepEqual(first, assess(actions));
  const order = first.reasons.map((reason) =>
    coachGovernanceReasons.indexOf(reason),
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.deepEqual(toDecisionGovernance(first), {
    policyVersion: "coach-governance-v1",
    reviewClass: "elevated_review",
    reasons: first.reasons,
  });
});

test("mixed directions compare training demand, not numeric sign", () => {
  const sameDemand = assess([rir(3, 3), load(35)]);
  assert.equal(sameDemand.reasons.includes("mixed_directions"), false);
  assert.ok(sameDemand.reasons.includes("multiple_actions"));
  const opposite = assess([rir(3, 3), remove("s2"), rest(60, 60)]);
  assert.ok(opposite.reasons.includes("mixed_directions"));
});
