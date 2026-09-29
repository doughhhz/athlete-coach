import {
  isReplaceExerciseAction,
  isSetCountAction,
  summarizeSetCountChanges,
  type CoachProposal,
  type CoachProposalAction,
} from "../coach/proposal.ts";
import { deriveChangeDirection } from "../response-memory/response-memory.ts";
import {
  prescriptionDimensionValue,
  proposedDimensionValue,
} from "../outcomes/outcomes.ts";
import type { PrescriptionSet, TrainingProgram } from "../training/training.ts";

/**
 * "The Coach may act proactively in preparing advice, but training state
 * changes remain governed by deterministic policy and human authority."
 * "Initiative does not imply authority."
 * "Review class is an operational governance classification, not a medical
 * or physiological risk score." (ADR-0074)
 */
export const COACH_GOVERNANCE_POLICY_VERSION = "coach-governance-v1" as const;

export const coachAutonomyModes = ["manual", "proactive"] as const;
export type CoachAutonomyMode = (typeof coachAutonomyModes)[number];
export const DEFAULT_COACH_AUTONOMY_MODE: CoachAutonomyMode = "manual";

export const coachProposalOrigins = ["manual", "proactive"] as const;
export type CoachProposalOrigin = (typeof coachProposalOrigins)[number];

/** Persisted review classes; `blocked` proposals are never persisted. */
export const persistedReviewClasses = [
  "standard_review",
  "elevated_review",
] as const;
export const coachReviewClasses = [
  ...persistedReviewClasses,
  "blocked",
] as const;
export type CoachReviewClass = (typeof coachReviewClasses)[number];
export type PersistedReviewClass = (typeof persistedReviewClasses)[number];

export const coachGovernanceReasons = [
  // blocked
  "safety_blocks_training_advice",
  "proposal_validation_failed",
  "unsupported_action",
  // elevated
  "exercise_replacement",
  "explicit_absolute_load_on_replacement",
  "target_change",
  "set_count_increase",
  "set_structure_change_without_count_change",
  "planned_rir_decrease",
  "planned_rest_decrease",
  "absolute_load_increase",
  "absolute_load_introduced",
  "direction_not_structurally_unambiguous",
  "multiple_actions",
  "multiple_prescriptions",
  "mixed_directions",
  // standard
  "planned_rir_increase",
  "planned_rest_increase",
  "absolute_load_decrease",
  "set_count_decrease",
] as const;
export type CoachGovernanceReason = (typeof coachGovernanceReasons)[number];

export type CoachGovernanceAssessment = Readonly<{
  policyVersion: typeof COACH_GOVERNANCE_POLICY_VERSION;
  reviewClass: CoachReviewClass;
  reasons: readonly CoachGovernanceReason[];
  proposalOrigin: CoachProposalOrigin;
  requiresHumanReview: true;
  /** Absolute boundary of Phase 15: never automatic. */
  allowsAutomaticMaterialization: false;
  allowsAutomaticActivation: false;
}>;

/** Governance envelope persisted with a runtime decision (not model output). */
export type CoachDecisionGovernance = Readonly<{
  policyVersion: string;
  reviewClass: PersistedReviewClass;
  reasons: readonly CoachGovernanceReason[];
}>;

const knownKinds = new Set<string>([
  "adjust_prescription_target",
  "adjust_prescription_rir",
  "adjust_prescription_rest",
  "adjust_absolute_load_target",
  "add_prescription_set",
  "remove_prescription_set",
  "replace_exercise",
]);

function sourceSet(
  program: TrainingProgram | null,
  action: Readonly<{
    trainingDayId: string;
    exercisePrescriptionId: string;
    prescriptionSetId: string;
  }>,
): PrescriptionSet | null {
  return (
    program?.blocks
      .flatMap((block) => block.weeks)
      .flatMap((week) => week.days)
      .find((day) => day.id === action.trainingDayId)
      ?.prescriptions.find((item) => item.id === action.exercisePrescriptionId)
      ?.sets.find((set) => set.id === action.prescriptionSetId) ?? null
  );
}

/**
 * Direction in training demand (not the numeric direction): more RIR or rest
 * is less demanding; more load or sets is more demanding.
 */
type DemandDirection = "less_demanding" | "more_demanding";
type ActionClass = Readonly<{
  elevated: boolean;
  direction: DemandDirection | null;
  reasons: readonly CoachGovernanceReason[];
}>;

/**
 * Semantic classification of one action by its structural direction against
 * the source program. No magnitude thresholds; anything not unambiguously
 * "less demanding by construction" is elevated.
 */
function classifyAdjust(
  action: CoachProposalAction,
  program: TrainingProgram | null,
): ActionClass {
  if (action.kind === "adjust_prescription_target")
    return { elevated: true, direction: null, reasons: ["target_change"] };
  if (isSetCountAction(action) || isReplaceExerciseAction(action))
    return { elevated: true, direction: null, reasons: [] };
  const set = sourceSet(program, action);
  if (!set)
    return {
      elevated: true,
      direction: null,
      reasons: ["direction_not_structurally_unambiguous"],
    };
  if (
    action.kind === "adjust_absolute_load_target" &&
    set.loadKind !== "absolute"
  )
    return {
      elevated: true,
      direction: null,
      reasons: ["absolute_load_introduced"],
    };
  const dimension =
    action.kind === "adjust_prescription_rir"
      ? "planned_rir"
      : action.kind === "adjust_prescription_rest"
        ? "planned_rest"
        : "absolute_load";
  const direction = deriveChangeDirection(
    prescriptionDimensionValue(set, dimension),
    proposedDimensionValue(action),
  );
  if (action.kind === "adjust_prescription_rir")
    return direction === "increase"
      ? {
          elevated: false,
          direction: "less_demanding",
          reasons: ["planned_rir_increase"],
        }
      : direction === "decrease"
        ? {
            elevated: true,
            direction: "more_demanding",
            reasons: ["planned_rir_decrease"],
          }
        : {
            elevated: true,
            direction: null,
            reasons: ["direction_not_structurally_unambiguous"],
          };
  if (action.kind === "adjust_prescription_rest")
    return direction === "increase"
      ? {
          elevated: false,
          direction: "less_demanding",
          reasons: ["planned_rest_increase"],
        }
      : direction === "decrease"
        ? {
            elevated: true,
            direction: "more_demanding",
            reasons: ["planned_rest_decrease"],
          }
        : {
            elevated: true,
            direction: null,
            reasons: ["direction_not_structurally_unambiguous"],
          };
  return direction === "decrease"
    ? {
        elevated: false,
        direction: "less_demanding",
        reasons: ["absolute_load_decrease"],
      }
    : direction === "increase"
      ? {
          elevated: true,
          direction: "more_demanding",
          reasons: ["absolute_load_increase"],
        }
      : {
          elevated: true,
          direction: null,
          reasons: ["direction_not_structurally_unambiguous"],
        };
}

export type AssessCoachProposalGovernanceInput = Readonly<{
  proposal: CoachProposal;
  sourceProgram: TrainingProgram | null;
  origin: CoachProposalOrigin;
  /** From the deterministic safety policy of the originating analysis. */
  safetyBlocksTrainingAdvice: boolean;
  /** Result of the deterministic proposal validator. */
  proposalValid: boolean;
}>;

/**
 * coach-governance-v1: pure, deterministic, never delegated to the model.
 * Model text such as "low risk" has no effect.
 */
export function assessCoachProposalGovernance(
  input: AssessCoachProposalGovernanceInput,
): CoachGovernanceAssessment {
  const blocked: CoachGovernanceReason[] = [];
  if (input.safetyBlocksTrainingAdvice)
    blocked.push("safety_blocks_training_advice");
  if (!input.proposalValid) blocked.push("proposal_validation_failed");
  if (
    !input.proposal.actions.length ||
    input.proposal.actions.some((action) => !knownKinds.has(action.kind))
  )
    blocked.push("unsupported_action");
  const base = {
    policyVersion: COACH_GOVERNANCE_POLICY_VERSION,
    proposalOrigin: input.origin,
    requiresHumanReview: true as const,
    allowsAutomaticMaterialization: false as const,
    allowsAutomaticActivation: false as const,
  };
  if (blocked.length)
    return { ...base, reviewClass: "blocked", reasons: blocked };

  const reasons = new Set<CoachGovernanceReason>();
  let elevated = false;
  const directions = new Set<DemandDirection>();
  for (const action of input.proposal.actions) {
    if (isReplaceExerciseAction(action)) {
      elevated = true;
      reasons.add("exercise_replacement");
      if (action.loadTransition.mode === "explicit_absolute")
        reasons.add("explicit_absolute_load_on_replacement");
      continue;
    }
    if (isSetCountAction(action)) continue;
    const result = classifyAdjust(action, input.sourceProgram);
    elevated ||= result.elevated;
    result.reasons.forEach((reason) => reasons.add(reason));
    if (result.direction) directions.add(result.direction);
  }
  for (const change of summarizeSetCountChanges(
    input.proposal,
    input.sourceProgram,
  )) {
    const hasAdds = change.addedSets.length > 0;
    if (change.absoluteDelta < 0 && !hasAdds) {
      reasons.add("set_count_decrease");
      directions.add("less_demanding");
    } else {
      elevated = true;
      reasons.add(
        change.absoluteDelta > 0
          ? "set_count_increase"
          : "set_structure_change_without_count_change",
      );
      if (change.absoluteDelta > 0) directions.add("more_demanding");
    }
  }
  if (
    input.proposal.actions.some(isSetCountAction) &&
    !summarizeSetCountChanges(input.proposal, input.sourceProgram).length
  ) {
    elevated = true;
    reasons.add("direction_not_structurally_unambiguous");
  }
  if (input.proposal.actions.length > 1) {
    elevated = true;
    reasons.add("multiple_actions");
  }
  const prescriptions = new Set(
    input.proposal.actions.map((action) => action.exercisePrescriptionId),
  );
  if (prescriptions.size > 1) {
    elevated = true;
    reasons.add("multiple_prescriptions");
  }
  if (directions.has("less_demanding") && directions.has("more_demanding")) {
    elevated = true;
    reasons.add("mixed_directions");
  }
  return {
    ...base,
    reviewClass: elevated ? "elevated_review" : "standard_review",
    reasons: coachGovernanceReasons.filter((reason) => reasons.has(reason)),
  };
}

export function toDecisionGovernance(
  assessment: CoachGovernanceAssessment,
): CoachDecisionGovernance | null {
  return assessment.reviewClass === "blocked"
    ? null
    : {
        policyVersion: assessment.policyVersion,
        reviewClass: assessment.reviewClass,
        reasons: assessment.reasons,
      };
}
