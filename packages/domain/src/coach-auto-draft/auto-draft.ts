import type { CoachProposal } from "../coach/proposal.ts";
import type {
  CoachAutonomyMode,
  CoachGovernanceAssessment,
  CoachGovernanceReason,
  CoachProposalOrigin,
} from "../coach-governance/governance.ts";

/**
 * "Automatic draft creation is limited authority over an inactive revision,
 * never authority over the active training program."
 * "Standard review is necessary but not sufficient for automatic draft
 * eligibility." (ADR-0082, ADR-0083)
 */
export const COACH_AUTO_DRAFT_POLICY_VERSION = "coach-auto-draft-v1" as const;

export const coachDraftAuthorityModes = [
  "manual_draft",
  "standard_auto_draft",
] as const;
export type CoachDraftAuthorityMode = (typeof coachDraftAuthorityModes)[number];
export const DEFAULT_COACH_DRAFT_AUTHORITY_MODE: CoachDraftAuthorityMode =
  "manual_draft";

export const coachAutoDraftEligibilities = [
  "eligible",
  "ineligible",
  "blocked",
] as const;
export type CoachAutoDraftEligibility =
  (typeof coachAutoDraftEligibilities)[number];

export const coachAutoDraftReasons = [
  // blocked
  "safety_blocks_training_advice",
  "proposal_validation_failed",
  "unsupported_action",
  // ineligible
  "not_proactive_origin",
  "review_not_standard",
  "multiple_actions",
  "multiple_prescriptions",
  "structural_set_change",
  "exercise_replacement",
  "target_change",
  "absolute_load_introduced",
  "direction_not_less_demanding",
  // eligible (the only three directions in v1)
  "planned_rir_increase",
  "planned_rest_increase",
  "absolute_load_decrease",
] as const;
export type CoachAutoDraftReason = (typeof coachAutoDraftReasons)[number];

export type CoachAutoDraftAssessment = Readonly<{
  policyVersion: typeof COACH_AUTO_DRAFT_POLICY_VERSION;
  eligibility: CoachAutoDraftEligibility;
  reasons: readonly CoachAutoDraftReason[];
  /** The draft may only be created against the unchanged active baseline. */
  requiresActiveProgramUnchanged: true;
  allowsAutomaticDraftCreation: boolean;
  /** Absolute boundary: activation is always a human action. */
  allowsAutomaticActivation: false;
}>;

/** Persisted with a decision; `null` when not assessed (manual origin, legacy). */
export type CoachDecisionAutoDraft = Readonly<{
  policyVersion: string;
  eligibility: CoachAutoDraftEligibility;
  reasons: readonly CoachAutoDraftReason[];
}>;

/**
 * Auto-draft is operational only in proactive mode with the explicit
 * conservative opt-in; otherwise the stored preference has no effect.
 */
export function isAutoDraftAuthorityEnabled(
  preferences: Readonly<{
    autonomyMode: CoachAutonomyMode;
    draftAuthorityMode: CoachDraftAuthorityMode;
  }>,
): boolean {
  return (
    preferences.autonomyMode === "proactive" &&
    preferences.draftAuthorityMode === "standard_auto_draft"
  );
}

const eligibleByKind: Readonly<Record<string, CoachGovernanceReason>> = {
  adjust_prescription_rir: "planned_rir_increase",
  adjust_prescription_rest: "planned_rest_increase",
  adjust_absolute_load_target: "absolute_load_decrease",
};
const ineligibleByGovernance: readonly (readonly [
  CoachGovernanceReason,
  CoachAutoDraftReason,
])[] = [
  ["exercise_replacement", "exercise_replacement"],
  ["explicit_absolute_load_on_replacement", "exercise_replacement"],
  ["target_change", "target_change"],
  ["set_count_increase", "structural_set_change"],
  ["set_count_decrease", "structural_set_change"],
  ["set_structure_change_without_count_change", "structural_set_change"],
  ["multiple_actions", "multiple_actions"],
  ["multiple_prescriptions", "multiple_prescriptions"],
  ["absolute_load_introduced", "absolute_load_introduced"],
  ["planned_rir_decrease", "direction_not_less_demanding"],
  ["planned_rest_decrease", "direction_not_less_demanding"],
  ["absolute_load_increase", "direction_not_less_demanding"],
  ["direction_not_structurally_unambiguous", "direction_not_less_demanding"],
  ["mixed_directions", "direction_not_less_demanding"],
];

export type AssessCoachAutoDraftInput = Readonly<{
  proposal: CoachProposal;
  origin: CoachProposalOrigin;
  /** coach-governance-v1 recomputed server-side for the same proposal. */
  governance: CoachGovernanceAssessment;
  trainingAdviceBlocked: boolean;
  proposalValid: boolean;
}>;

/**
 * coach-auto-draft-v1: pure and deterministic, never delegated to the model.
 * Eligible only for a single RIR increase, rest increase or existing
 * absolute-load decrease on one prescription. No magnitude thresholds.
 */
export function assessCoachAutoDraftEligibility(
  input: AssessCoachAutoDraftInput,
): CoachAutoDraftAssessment {
  const result = (
    eligibility: CoachAutoDraftEligibility,
    reasons: readonly CoachAutoDraftReason[],
  ): CoachAutoDraftAssessment => ({
    policyVersion: COACH_AUTO_DRAFT_POLICY_VERSION,
    eligibility,
    reasons: coachAutoDraftReasons.filter((reason) => reasons.includes(reason)),
    requiresActiveProgramUnchanged: true,
    allowsAutomaticDraftCreation: eligibility === "eligible",
    allowsAutomaticActivation: false,
  });
  const blocked: CoachAutoDraftReason[] = [];
  if (
    input.trainingAdviceBlocked ||
    input.governance.reasons.includes("safety_blocks_training_advice")
  )
    blocked.push("safety_blocks_training_advice");
  if (
    !input.proposalValid ||
    input.governance.reasons.includes("proposal_validation_failed")
  )
    blocked.push("proposal_validation_failed");
  if (
    !input.proposal.actions.length ||
    input.proposal.actions.some(
      (action) =>
        !(action.kind in eligibleByKind) &&
        ![
          "adjust_prescription_target",
          "add_prescription_set",
          "remove_prescription_set",
          "replace_exercise",
        ].includes(action.kind),
    ) ||
    input.governance.reasons.includes("unsupported_action")
  )
    blocked.push("unsupported_action");
  if (blocked.length || input.governance.reviewClass === "blocked")
    return result("blocked", blocked.length ? blocked : ["unsupported_action"]);

  const ineligible = new Set<CoachAutoDraftReason>();
  if (input.origin !== "proactive") ineligible.add("not_proactive_origin");
  if (input.governance.reviewClass !== "standard_review")
    ineligible.add("review_not_standard");
  for (const [governanceReason, reason] of ineligibleByGovernance)
    if (input.governance.reasons.includes(governanceReason))
      ineligible.add(reason);
  if (input.proposal.actions.length > 1) ineligible.add("multiple_actions");
  const [action] = input.proposal.actions;
  const expected = action ? eligibleByKind[action.kind] : undefined;
  if (!expected) {
    if (action?.kind === "replace_exercise")
      ineligible.add("exercise_replacement");
    else if (action?.kind === "adjust_prescription_target")
      ineligible.add("target_change");
    else ineligible.add("structural_set_change");
  } else if (
    input.proposal.actions.length === 1 &&
    !(
      input.governance.reasons.length === 1 &&
      input.governance.reasons[0] === expected
    )
  )
    ineligible.add("direction_not_less_demanding");
  if (ineligible.size) return result("ineligible", [...ineligible]);
  return result("eligible", [expected as CoachAutoDraftReason]);
}

export function toDecisionAutoDraft(
  assessment: CoachAutoDraftAssessment,
): CoachDecisionAutoDraft {
  return {
    policyVersion: assessment.policyVersion,
    eligibility: assessment.eligibility,
    reasons: assessment.reasons,
  };
}
