import type { EvidenceReference } from "../dossier/dossier.ts";
import {
  assertPrescriptionSet,
  type PrescriptionSet,
  type TrainingProgram,
} from "../training/training.ts";

export const COACH_PROPOSAL_SCHEMA_VERSION = "coach-proposal-v1" as const;
export const coachProposalStatuses = [
  "proposed",
  "rejected",
  "stale",
  "materialized",
] as const;
export const coachProposalActionKinds = [
  "adjust_prescription_target",
  "adjust_prescription_rir",
  "adjust_prescription_rest",
  "adjust_absolute_load_target",
] as const;
export const coachRejectionReasons = [
  "not_now",
  "disagree",
  "prefer_current_program",
  "other",
] as const;
export type CoachProposalStatus = (typeof coachProposalStatuses)[number];
export type CoachRejectionReason = (typeof coachRejectionReasons)[number];

type ActionBase = Readonly<{
  rationale: string;
  evidence: readonly EvidenceReference[];
}>;
type ActionTarget = Readonly<{
  trainingDayId: string;
  exercisePrescriptionId: string;
  prescriptionSetId: string;
}>;
export type CoachProposalAction =
  | (ActionBase &
      ActionTarget &
      Readonly<{
        kind: "adjust_prescription_target";
        targetMetric: PrescriptionSet["targetMetric"];
        targetMin: number;
        targetMax: number;
      }>)
  | (ActionBase &
      ActionTarget &
      Readonly<{
        kind: "adjust_prescription_rir";
        rirMin: number | null;
        rirMax: number | null;
      }>)
  | (ActionBase &
      ActionTarget &
      Readonly<{
        kind: "adjust_prescription_rest";
        restMinSeconds: number | null;
        restMaxSeconds: number | null;
      }>)
  | (ActionBase &
      ActionTarget &
      Readonly<{ kind: "adjust_absolute_load_target"; loadKg: number }>);

export type CoachProposal = Readonly<{
  schemaVersion: typeof COACH_PROPOSAL_SCHEMA_VERSION;
  id: string;
  analysisId: string;
  sourceProgramId: string;
  sourceProgramRevision: number;
  createdAt: string;
  summary: string;
  rationale: string;
  evidenceReferences: readonly EvidenceReference[];
  actions: readonly CoachProposalAction[];
  limitations: readonly string[];
  requiresHumanApproval: true;
  analysisSnapshot: Readonly<{
    summary: string;
    provider: string;
    model: string;
    promptVersion: string;
    policyVersion: string;
    dossierSchemaVersion: string;
  }>;
}>;
export type CoachDecision = Readonly<{
  id: string;
  athleteId: string;
  status: CoachProposalStatus;
  proposal: CoachProposal;
  rejectionReason: CoachRejectionReason | null;
  rejectionNotes: string | null;
  proposedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  staleAt: string | null;
  materializedAt: string | null;
  materializedProgramId: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type ProposalValidationIssue = Readonly<{
  code:
    | "wrong_athlete"
    | "wrong_source_program"
    | "stale_revision"
    | "invalid_evidence"
    | "missing_entity"
    | "invalid_action"
    | "invalid_structure";
  message: string;
}>;
export type ProposalValidationResult = Readonly<{
  valid: boolean;
  issues: readonly ProposalValidationIssue[];
}>;

function allEvidence(proposal: CoachProposal): readonly EvidenceReference[] {
  return [
    ...proposal.evidenceReferences,
    ...proposal.actions.flatMap((action) => action.evidence),
  ];
}

export function validateCoachProposal(
  proposal: CoachProposal,
  context: Readonly<{
    athleteId: string;
    sourceProgram: TrainingProgram;
    activeProgramId: string | null;
    evidenceIds: ReadonlySet<string>;
  }>,
): ProposalValidationResult {
  const issues: ProposalValidationIssue[] = [];
  if (context.sourceProgram.athleteId !== context.athleteId)
    issues.push({
      code: "wrong_athlete",
      message: "O programa pertence a outro atleta.",
    });
  if (proposal.sourceProgramId !== context.sourceProgram.id)
    issues.push({
      code: "wrong_source_program",
      message: "O programa de origem não corresponde à proposta.",
    });
  if (
    proposal.sourceProgramRevision !== context.sourceProgram.revision ||
    context.activeProgramId !== context.sourceProgram.id
  )
    issues.push({
      code: "stale_revision",
      message: "A proposta não usa mais o programa ativo esperado.",
    });
  if (
    allEvidence(proposal).some(
      (reference) =>
        !context.evidenceIds.has(`${reference.kind}:${reference.id}`),
    )
  )
    issues.push({
      code: "invalid_evidence",
      message: "A proposta contém evidência ausente.",
    });
  if (!proposal.actions.length)
    issues.push({
      code: "invalid_action",
      message: "A proposta precisa conter pelo menos uma ação suportada.",
    });

  const days = context.sourceProgram.blocks.flatMap((block) =>
    block.weeks.flatMap((week) => week.days),
  );
  const targetedSets = new Set<string>();
  for (const action of proposal.actions) {
    if (targetedSets.has(action.prescriptionSetId)) {
      issues.push({
        code: "invalid_action",
        message: "Uma proposta não pode alterar o mesmo set mais de uma vez.",
      });
      continue;
    }
    targetedSets.add(action.prescriptionSetId);
    const day = days.find((item) => item.id === action.trainingDayId);
    const prescription = day?.prescriptions.find(
      (item) => item.id === action.exercisePrescriptionId,
    );
    const set = prescription?.sets.find(
      (item) => item.id === action.prescriptionSetId,
    );
    if (!day || !prescription || !set) {
      issues.push({
        code: "missing_entity",
        message: "Uma action referencia entidade inexistente.",
      });
      continue;
    }
    try {
      const candidate =
        action.kind === "adjust_prescription_target"
          ? {
              ...set,
              targetMetric: action.targetMetric,
              targetMin: action.targetMin,
              targetMax: action.targetMax,
            }
          : action.kind === "adjust_prescription_rir"
            ? { ...set, rirMin: action.rirMin, rirMax: action.rirMax }
            : action.kind === "adjust_prescription_rest"
              ? {
                  ...set,
                  restMinSeconds: action.restMinSeconds,
                  restMaxSeconds: action.restMaxSeconds,
                }
              : {
                  ...set,
                  loadKind: "absolute" as const,
                  loadKg: action.loadKg,
                };
      assertPrescriptionSet(candidate);
      if (
        action.kind === "adjust_prescription_target" &&
        action.targetMetric !== set.targetMetric
      )
        throw new Error("A métrica de target não pode mudar nesta fase.");
    } catch (error) {
      issues.push({
        code: "invalid_structure",
        message:
          error instanceof Error
            ? error.message
            : "A action viola invariantes de treino.",
      });
    }
  }
  return { valid: issues.length === 0, issues };
}
