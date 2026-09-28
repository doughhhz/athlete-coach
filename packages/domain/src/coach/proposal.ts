import type { EvidenceReference } from "../dossier/dossier.ts";
import {
  assertPrescriptionSet,
  type ExercisePrescription,
  type PrescriptionSet,
  type TrainingProgram,
} from "../training/training.ts";

/** Historical contract: adjust actions only (ADR-0043). */
export const COACH_PROPOSAL_V1_SCHEMA_VERSION = "coach-proposal-v1" as const;
/** Current contract: v1 actions plus set-count actions (ADR-0062). */
export const COACH_PROPOSAL_SCHEMA_VERSION = "coach-proposal-v2" as const;
export const coachProposalSchemaVersions = [
  COACH_PROPOSAL_V1_SCHEMA_VERSION,
  COACH_PROPOSAL_SCHEMA_VERSION,
] as const;
export type CoachProposalSchemaVersion =
  (typeof coachProposalSchemaVersions)[number];
export const coachProposalStatuses = [
  "proposed",
  "rejected",
  "stale",
  "materialized",
] as const;
export const coachProposalAdjustActionKinds = [
  "adjust_prescription_target",
  "adjust_prescription_rir",
  "adjust_prescription_rest",
  "adjust_absolute_load_target",
] as const;
export const coachProposalSetCountActionKinds = [
  "add_prescription_set",
  "remove_prescription_set",
] as const;
export const coachProposalActionKinds = [
  ...coachProposalAdjustActionKinds,
  ...coachProposalSetCountActionKinds,
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
export type CoachProposalAdjustAction =
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

/** Every field of a planned set except identity/sequence, always explicit. */
export type PlannedPrescriptionSet = Omit<PrescriptionSet, "id" | "sequence">;

/**
 * Appends one explicit set at the end of the prescription. The copy source is
 * provenance only: materialization uses `plannedSet`, never the source row.
 */
export type AddPrescriptionSetAction = ActionBase &
  Readonly<{
    kind: "add_prescription_set";
    trainingDayId: string;
    exercisePrescriptionId: string;
    position: "end";
    copyFromPrescriptionSetId: string | null;
    plannedSet: PlannedPrescriptionSet;
  }>;
export type RemovePrescriptionSetAction = ActionBase &
  ActionTarget &
  Readonly<{ kind: "remove_prescription_set" }>;
export type CoachProposalSetCountAction =
  AddPrescriptionSetAction | RemovePrescriptionSetAction;
export type CoachProposalAction =
  CoachProposalAdjustAction | CoachProposalSetCountAction;

export function isSetCountAction(
  action: CoachProposalAction,
): action is CoachProposalSetCountAction {
  return (
    action.kind === "add_prescription_set" ||
    action.kind === "remove_prescription_set"
  );
}

export type CoachProposal = Readonly<{
  schemaVersion: CoachProposalSchemaVersion;
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

function applyAdjust(
  set: PrescriptionSet,
  action: CoachProposalAdjustAction,
): PrescriptionSet {
  if (action.kind === "adjust_prescription_target")
    return {
      ...set,
      targetMetric: action.targetMetric,
      targetMin: action.targetMin,
      targetMax: action.targetMax,
    };
  if (action.kind === "adjust_prescription_rir")
    return { ...set, rirMin: action.rirMin, rirMax: action.rirMax };
  if (action.kind === "adjust_prescription_rest")
    return {
      ...set,
      restMinSeconds: action.restMinSeconds,
      restMaxSeconds: action.restMaxSeconds,
    };
  return { ...set, loadKind: "absolute", loadKg: action.loadKg };
}

/**
 * Pure mirror of `materialize_coach_decision` for one prescription: removed
 * sets disappear, survivors keep order and are renumbered 1..n, adjust
 * actions apply to their source set, added sets are appended in action order.
 * Added sets get a synthetic `proposed:<index>` id (real UUIDs only exist
 * after materialization).
 */
export function materializeProposalPrescription(
  prescription: ExercisePrescription,
  actions: readonly CoachProposalAction[],
): ExercisePrescription {
  const removed = new Set(
    actions
      .filter(
        (action): action is RemovePrescriptionSetAction =>
          action.kind === "remove_prescription_set" &&
          action.exercisePrescriptionId === prescription.id,
      )
      .map((action) => action.prescriptionSetId),
  );
  const survivors = [...prescription.sets]
    .sort((a, b) => a.sequence - b.sequence)
    .filter((set) => !removed.has(set.id))
    .map((set) => {
      const adjust = actions.find(
        (action): action is CoachProposalAdjustAction =>
          !isSetCountAction(action) && action.prescriptionSetId === set.id,
      );
      return adjust ? applyAdjust(set, adjust) : set;
    });
  const added = actions
    .map((action, index) => ({ action, index }))
    .filter(
      (item): item is { action: AddPrescriptionSetAction; index: number } =>
        item.action.kind === "add_prescription_set" &&
        item.action.exercisePrescriptionId === prescription.id,
    )
    .map(({ action, index }) => ({
      ...action.plannedSet,
      id: `proposed:${index}`,
      sequence: 0,
    }));
  return {
    ...prescription,
    sets: [...survivors, ...added].map((set, index) => ({
      ...set,
      sequence: index + 1,
    })),
  };
}

export type SetCountChangeSummary = Readonly<{
  trainingDayId: string;
  exercisePrescriptionId: string;
  exerciseId: string;
  exerciseName: string;
  beforeSetCount: number;
  afterSetCount: number;
  absoluteDelta: number;
  addedSets: readonly PlannedPrescriptionSet[];
  removedSets: readonly PrescriptionSet[];
}>;

/** Net planned set count per affected prescription (for review and outcome). */
export function summarizeSetCountChanges(
  proposal: CoachProposal,
  sourceProgram: TrainingProgram | null,
): readonly SetCountChangeSummary[] {
  const structural = proposal.actions.filter(isSetCountAction);
  const keys = [
    ...new Set(
      structural.map(
        (action) => `${action.trainingDayId}|${action.exercisePrescriptionId}`,
      ),
    ),
  ];
  const days =
    sourceProgram?.blocks.flatMap((block) =>
      block.weeks.flatMap((week) => week.days),
    ) ?? [];
  return keys.flatMap((key) => {
    const [dayId, prescriptionId] = key.split("|") as [string, string];
    const prescription = days
      .find((day) => day.id === dayId)
      ?.prescriptions.find((item) => item.id === prescriptionId);
    if (!prescription) return [];
    const after = materializeProposalPrescription(
      prescription,
      proposal.actions,
    );
    const removedIds = new Set(
      structural
        .filter(
          (action): action is RemovePrescriptionSetAction =>
            action.kind === "remove_prescription_set" &&
            action.exercisePrescriptionId === prescriptionId,
        )
        .map((action) => action.prescriptionSetId),
    );
    return [
      {
        trainingDayId: dayId,
        exercisePrescriptionId: prescriptionId,
        exerciseId: prescription.exerciseId,
        exerciseName: prescription.exerciseName,
        beforeSetCount: prescription.sets.length,
        afterSetCount: after.sets.length,
        absoluteDelta: after.sets.length - prescription.sets.length,
        addedSets: structural
          .filter(
            (action): action is AddPrescriptionSetAction =>
              action.kind === "add_prescription_set" &&
              action.exercisePrescriptionId === prescriptionId,
          )
          .map((action) => action.plannedSet),
        removedSets: prescription.sets.filter((set) => removedIds.has(set.id)),
      },
    ];
  });
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
  if (
    proposal.schemaVersion === COACH_PROPOSAL_V1_SCHEMA_VERSION &&
    proposal.actions.some(isSetCountAction)
  )
    issues.push({
      code: "invalid_action",
      message: "coach-proposal-v1 não aceita ações de quantidade de séries.",
    });

  const days = context.sourceProgram.blocks.flatMap((block) =>
    block.weeks.flatMap((week) => week.days),
  );
  const locate = (dayId: string, prescriptionId: string) =>
    days
      .find((item) => item.id === dayId)
      ?.prescriptions.find((item) => item.id === prescriptionId) ?? null;
  const targetedSets = new Set<string>();
  const removedSets = new Set(
    proposal.actions
      .filter(
        (action): action is RemovePrescriptionSetAction =>
          action.kind === "remove_prescription_set",
      )
      .map((action) => action.prescriptionSetId),
  );
  const touchedPrescriptions = new Map<string, ExercisePrescription>();
  for (const action of proposal.actions) {
    const prescription = locate(
      action.trainingDayId,
      action.exercisePrescriptionId,
    );
    if (!prescription) {
      issues.push({
        code: "missing_entity",
        message: "Uma action referencia entidade inexistente.",
      });
      continue;
    }
    if (action.kind === "add_prescription_set") {
      touchedPrescriptions.set(prescription.id, prescription);
      if (
        action.copyFromPrescriptionSetId !== null &&
        !prescription.sets.some(
          (set) => set.id === action.copyFromPrescriptionSetId,
        )
      ) {
        issues.push({
          code: "missing_entity",
          message: "A série de origem da cópia não pertence à prescrição.",
        });
        continue;
      }
      if (
        action.copyFromPrescriptionSetId !== null &&
        removedSets.has(action.copyFromPrescriptionSetId)
      ) {
        issues.push({
          code: "invalid_action",
          message:
            "Não é possível copiar uma série removida na mesma proposta.",
        });
        continue;
      }
      const metrics = new Set(prescription.sets.map((set) => set.targetMetric));
      try {
        assertPrescriptionSet({ ...action.plannedSet, sequence: 1 });
        if (metrics.size !== 1 || !metrics.has(action.plannedSet.targetMetric))
          throw new Error(
            "A nova série deve usar a mesma métrica das séries existentes.",
          );
      } catch (error) {
        issues.push({
          code: "invalid_structure",
          message:
            error instanceof Error
              ? error.message
              : "A série adicionada viola invariantes de treino.",
        });
      }
      continue;
    }
    if (targetedSets.has(action.prescriptionSetId)) {
      issues.push({
        code: "invalid_action",
        message:
          "Uma proposta não pode alterar ou remover o mesmo set mais de uma vez.",
      });
      continue;
    }
    targetedSets.add(action.prescriptionSetId);
    const set = prescription.sets.find(
      (item) => item.id === action.prescriptionSetId,
    );
    if (!set) {
      issues.push({
        code: "missing_entity",
        message: "Uma action referencia entidade inexistente.",
      });
      continue;
    }
    if (action.kind === "remove_prescription_set") {
      touchedPrescriptions.set(prescription.id, prescription);
      continue;
    }
    try {
      assertPrescriptionSet(applyAdjust(set, action));
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
  for (const prescription of touchedPrescriptions.values()) {
    const result = materializeProposalPrescription(
      prescription,
      proposal.actions,
    );
    if (!result.sets.length)
      issues.push({
        code: "invalid_structure",
        message: "Uma prescrição precisa manter pelo menos uma série.",
      });
  }
  return { valid: issues.length === 0, issues };
}
