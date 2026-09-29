import {
  isAdjustAction,
  isReplaceExerciseAction,
  isSetCountAction,
  materializeProposalPrescription,
  type CoachDecision,
  type CoachMaterializationOrigin,
} from "../coach/proposal.ts";
import type { CoachProposalOrigin } from "../coach-governance/governance.ts";
import type { EvidenceReference } from "../dossier/dossier.ts";
import {
  diffPrescription,
  flattenPrescriptions,
  prescriptionDimensionValue,
  prescriptionKey,
  samePrescriptionValue,
  type FidelityDifference,
  type LocatedPrescription,
  type PrescriptionDimensionValue,
  type PrescriptionPath,
} from "../outcomes/outcomes.ts";
import type {
  ExercisePrescription,
  ProgramStatus,
  TrainingProgram,
} from "../training/training.ts";

/**
 * Implementation Phase 17 (ADR-0087..0090). Derived, deterministic evidence
 * about what happened to a materialized draft during human review.
 * "Human review behavior is evidence about oversight, not proof that a
 * proposal was correct." "User acceptance does not validate a coaching
 * intervention physiologically." "Auto-draft authority may not expand itself
 * from review history."
 *
 * No score, rate, reward, correctness or trust label exists here, and this
 * module is never an input of the auto-draft policy.
 */
export const COACH_DRAFT_REVIEW_EVIDENCE_VERSION =
  "coach-draft-review-evidence-v1" as const;
export const COACH_DRAFT_REVIEW_HISTORY_VERSION =
  "coach-draft-review-history-v1" as const;
export const DRAFT_REVIEW_HISTORY_DEFAULT_LIMIT = 20;

export const draftReviewStatuses = [
  "awaiting_review",
  "activated_unchanged",
  "activated_with_edits",
  "archived_without_activation",
  "limited_data",
] as const;
export type DraftReviewStatus = (typeof draftReviewStatuses)[number];

export const draftReviewChangeCategories = [
  "exercise_changed",
  "set_added",
  "set_removed",
  "target_changed",
  "rir_changed",
  "rest_changed",
  "load_changed",
  "tempo_changed",
  "prescription_added",
  "prescription_removed",
  "program_structure_changed",
] as const;
export type DraftReviewChangeCategory =
  (typeof draftReviewChangeCategories)[number];

export const draftReviewLimitations = [
  "materialized_program_unavailable",
  "source_program_unavailable",
  "materialization_origin_not_recorded",
  // Always present: the ledger does not record who edited a draft.
  "editor_identity_not_recorded",
  // Always present: names, notes, instructions and cues are not compared.
  "names_and_notes_not_compared",
] as const;
export type DraftReviewLimitation = (typeof draftReviewLimitations)[number];

export type DraftReviewValue =
  | PrescriptionDimensionValue
  | Readonly<{ dimension: "set_count"; count: number }>
  | Readonly<{ dimension: "exercise"; exerciseId: string }>;

/** Per proposal action: proposal source → materialized expectation → reviewed draft. */
export type DraftReviewActionComparison = Readonly<{
  actionIndex: number;
  kind: string;
  path: Omit<PrescriptionPath, "setSequence"> | null;
  /** Set position in the expected draft; null for prescription-level values. */
  setSequence: number | null;
  sourceValue: DraftReviewValue | null;
  materializedValue: DraftReviewValue | null;
  reviewedValue: DraftReviewValue | null;
  /** `null` when the reviewed value could not be located. */
  reviewedDiffersFromMaterialized: boolean | null;
}>;

export type CoachDraftReviewEvidence = Readonly<{
  schemaVersion: typeof COACH_DRAFT_REVIEW_EVIDENCE_VERSION;
  decisionId: string;
  proposalOrigin: CoachProposalOrigin;
  materializationOrigin: CoachMaterializationOrigin | null;
  sourceProgram: Readonly<{ id: string; revision: number }>;
  materializedProgram: Readonly<{
    id: string;
    revision: number | null;
    status: ProgramStatus | null;
  }>;
  reviewStatus: DraftReviewStatus;
  materializedAt: string | null;
  activatedAt: string | null;
  archivedAt: string | null;
  /** Seconds between materialization and activation/archive (fixed facts). */
  timeUntilActivationSeconds: number | null;
  timeUntilArchiveSeconds: number | null;
  /**
   * The reviewed draft differs from the deterministic materialized
   * expectation. It does not identify who changed it. `null` = unknown.
   */
  reviewedDraftDiffers: boolean | null;
  actionComparisons: readonly DraftReviewActionComparison[];
  changedPrescriptionCount: number;
  changedSetCount: number;
  changedExerciseCount: number;
  changeCategories: readonly DraftReviewChangeCategory[];
  /** Differences in prescriptions the proposal did not touch. */
  changesOutsideProposal: boolean;
  limitations: readonly DraftReviewLimitation[];
  evidence: readonly EvidenceReference[];
}>;

const categoryOf: Readonly<
  Record<FidelityDifference["dimension"], DraftReviewChangeCategory | null>
> = {
  target: "target_changed",
  planned_rir: "rir_changed",
  planned_rest: "rest_changed",
  absolute_load: "load_changed",
  tempo: "tempo_changed",
  exercise: "exercise_changed",
  set_count: null,
};

function seconds(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000),
  );
}

/**
 * Expected materialized draft: the frozen source program with the immutable
 * proposal applied through the single materialization mirror.
 */
export function expectedMaterializedPrescriptions(
  decision: CoachDecision,
  sourceProgram: TrainingProgram,
): readonly LocatedPrescription[] {
  return flattenPrescriptions(sourceProgram).map((item) => ({
    path: item.path,
    prescription: materializeProposalPrescription(
      item.prescription,
      decision.proposal.actions,
    ),
  }));
}

function shape(program: TrainingProgram): string {
  return program.blocks
    .map(
      (block) =>
        `${block.sequence}:${block.weeks.map((week) => `${week.sequence}:${week.days.map((day) => day.sequence).join(",")}`).join(";")}`,
    )
    .join("|");
}

type Diff = Readonly<{
  categories: ReadonlySet<DraftReviewChangeCategory>;
  changedKeys: ReadonlySet<string>;
  changedSets: number;
  changedExercises: number;
}>;

function diffPrograms(
  expected: readonly LocatedPrescription[],
  reviewed: readonly LocatedPrescription[],
  structureChanged: boolean,
): Diff {
  const categories = new Set<DraftReviewChangeCategory>();
  const changedKeys = new Set<string>();
  let changedSets = 0;
  let changedExercises = 0;
  if (structureChanged) categories.add("program_structure_changed");
  const reviewedByKey = new Map(
    reviewed.map((item) => [prescriptionKey(item.path), item.prescription]),
  );
  const expectedKeys = new Set(
    expected.map((item) => prescriptionKey(item.path)),
  );
  for (const item of expected) {
    const key = prescriptionKey(item.path);
    const counterpart = reviewedByKey.get(key);
    if (!counterpart) {
      categories.add("prescription_removed");
      changedKeys.add(key);
      continue;
    }
    const differences = diffPrescription(item.prescription, counterpart);
    if (!differences.length) continue;
    changedKeys.add(key);
    const setPositions = new Set<number>();
    for (const difference of differences) {
      const category = categoryOf[difference.dimension];
      if (category) categories.add(category);
      if (difference.dimension === "exercise") changedExercises += 1;
      if (difference.setSequence !== null)
        setPositions.add(difference.setSequence);
    }
    const delta = counterpart.sets.length - item.prescription.sets.length;
    if (delta > 0) categories.add("set_added");
    if (delta < 0) categories.add("set_removed");
    changedSets += setPositions.size + Math.abs(delta);
  }
  for (const item of reviewed)
    if (!expectedKeys.has(prescriptionKey(item.path))) {
      categories.add("prescription_added");
      changedKeys.add(prescriptionKey(item.path));
    }
  return {
    categories: new Set(
      draftReviewChangeCategories.filter((category) =>
        categories.has(category),
      ),
    ),
    changedKeys,
    changedSets,
    changedExercises,
  };
}

function locate(
  items: readonly LocatedPrescription[],
  key: string | null,
): ExercisePrescription | null {
  if (!key) return null;
  return (
    items.find((item) => prescriptionKey(item.path) === key)?.prescription ??
    null
  );
}

function compareActions(
  decision: CoachDecision,
  source: readonly LocatedPrescription[],
  expected: readonly LocatedPrescription[],
  reviewed: readonly LocatedPrescription[] | null,
): readonly DraftReviewActionComparison[] {
  return decision.proposal.actions.map((action, actionIndex) => {
    const located = source.find(
      (item) => item.prescription.id === action.exercisePrescriptionId,
    );
    const key = located ? prescriptionKey(located.path) : null;
    const sourcePrescription = located?.prescription ?? null;
    const expectedPrescription = locate(expected, key);
    const reviewedPrescription = reviewed ? locate(reviewed, key) : null;
    const base = {
      actionIndex,
      kind: action.kind,
      path: located?.path ?? null,
    };
    const differs = (
      materialized: DraftReviewValue | null,
      value: DraftReviewValue | null,
    ) =>
      !reviewed || !materialized
        ? null
        : !value
          ? true
          : JSON.stringify(materialized) !== JSON.stringify(value);
    if (isAdjustAction(action)) {
      const dimension =
        action.kind === "adjust_prescription_target"
          ? "target"
          : action.kind === "adjust_prescription_rir"
            ? "planned_rir"
            : action.kind === "adjust_prescription_rest"
              ? "planned_rest"
              : "absolute_load";
      const sourceSet =
        sourcePrescription?.sets.find(
          (set) => set.id === action.prescriptionSetId,
        ) ?? null;
      const expectedSet =
        expectedPrescription?.sets.find(
          (set) => set.id === action.prescriptionSetId,
        ) ?? null;
      const reviewedSet =
        expectedSet && reviewedPrescription
          ? (reviewedPrescription.sets.find(
              (set) => set.sequence === expectedSet.sequence,
            ) ?? null)
          : null;
      const materializedValue = expectedSet
        ? prescriptionDimensionValue(expectedSet, dimension)
        : null;
      const reviewedValue = reviewedSet
        ? prescriptionDimensionValue(reviewedSet, dimension)
        : null;
      return {
        ...base,
        setSequence: expectedSet?.sequence ?? null,
        sourceValue: sourceSet
          ? prescriptionDimensionValue(sourceSet, dimension)
          : null,
        materializedValue,
        reviewedValue,
        reviewedDiffersFromMaterialized:
          !reviewed || !materializedValue
            ? null
            : !reviewedValue
              ? true
              : !samePrescriptionValue(materializedValue, reviewedValue),
      };
    }
    if (isSetCountAction(action)) {
      const count = (prescription: ExercisePrescription | null) =>
        prescription
          ? { dimension: "set_count" as const, count: prescription.sets.length }
          : null;
      const materializedValue = count(expectedPrescription);
      const reviewedValue = count(reviewedPrescription);
      return {
        ...base,
        setSequence: null,
        sourceValue: count(sourcePrescription),
        materializedValue,
        reviewedValue,
        reviewedDiffersFromMaterialized: differs(
          materializedValue,
          reviewedValue,
        ),
      };
    }
    const exercise = (prescription: ExercisePrescription | null) =>
      prescription
        ? {
            dimension: "exercise" as const,
            exerciseId: prescription.exerciseId,
          }
        : null;
    const materializedValue = isReplaceExerciseAction(action)
      ? exercise(expectedPrescription)
      : null;
    const reviewedValue = exercise(reviewedPrescription);
    return {
      ...base,
      setSequence: null,
      sourceValue: exercise(sourcePrescription),
      materializedValue,
      reviewedValue,
      reviewedDiffersFromMaterialized: differs(
        materializedValue,
        reviewedValue,
      ),
    };
  });
}

/**
 * Pure projection; `null` when the decision was never materialized (a
 * rejected or stale proposal is a different fact and has no draft review).
 */
export function buildCoachDraftReviewEvidence(
  decision: CoachDecision,
  sourceProgram: TrainingProgram | null,
  materializedProgram: TrainingProgram | null,
): CoachDraftReviewEvidence | null {
  if (decision.status !== "materialized" || !decision.materializedProgramId)
    return null;
  const limitations = new Set<DraftReviewLimitation>([
    "editor_identity_not_recorded",
    "names_and_notes_not_compared",
  ]);
  if (!materializedProgram) limitations.add("materialized_program_unavailable");
  if (!sourceProgram) limitations.add("source_program_unavailable");
  if (!decision.materializationOrigin)
    limitations.add("materialization_origin_not_recorded");
  const activatedAt = materializedProgram?.activatedAt ?? null;
  const archivedAt = materializedProgram?.archivedAt ?? null;
  const comparable = Boolean(sourceProgram && materializedProgram);
  const source = sourceProgram ? flattenPrescriptions(sourceProgram) : [];
  const expected = sourceProgram
    ? expectedMaterializedPrescriptions(decision, sourceProgram)
    : [];
  const reviewed =
    comparable && materializedProgram
      ? flattenPrescriptions(materializedProgram)
      : null;
  const diff = reviewed
    ? diffPrograms(
        expected,
        reviewed,
        shape(sourceProgram as TrainingProgram) !==
          shape(materializedProgram as TrainingProgram),
      )
    : null;
  const affectedKeys = new Set(
    decision.proposal.actions
      .map(
        (action) =>
          source.find(
            (item) => item.prescription.id === action.exercisePrescriptionId,
          )?.path,
      )
      .filter((path) => path !== undefined)
      .map((path) => prescriptionKey(path)),
  );
  const reviewedDraftDiffers = diff
    ? diff.changedKeys.size > 0 || diff.categories.size > 0
    : null;
  const reviewStatus: DraftReviewStatus = !materializedProgram
    ? "limited_data"
    : activatedAt !== null
      ? reviewedDraftDiffers === null
        ? "limited_data"
        : reviewedDraftDiffers
          ? "activated_with_edits"
          : "activated_unchanged"
      : materializedProgram.status === "draft"
        ? "awaiting_review"
        : materializedProgram.status === "archived"
          ? "archived_without_activation"
          : "limited_data";
  return {
    schemaVersion: COACH_DRAFT_REVIEW_EVIDENCE_VERSION,
    decisionId: decision.id,
    proposalOrigin: decision.proposalOrigin,
    materializationOrigin: decision.materializationOrigin,
    sourceProgram: {
      id: decision.proposal.sourceProgramId,
      revision: decision.proposal.sourceProgramRevision,
    },
    materializedProgram: {
      id: decision.materializedProgramId,
      revision: materializedProgram?.revision ?? null,
      status: materializedProgram?.status ?? null,
    },
    reviewStatus,
    materializedAt: decision.materializedAt,
    activatedAt,
    archivedAt,
    timeUntilActivationSeconds: seconds(decision.materializedAt, activatedAt),
    timeUntilArchiveSeconds:
      activatedAt === null
        ? seconds(decision.materializedAt, archivedAt)
        : null,
    reviewedDraftDiffers,
    actionComparisons: sourceProgram
      ? compareActions(decision, source, expected, reviewed)
      : [],
    changedPrescriptionCount: diff?.changedKeys.size ?? 0,
    changedSetCount: diff?.changedSets ?? 0,
    changedExerciseCount: diff?.changedExercises ?? 0,
    changeCategories: diff ? [...diff.categories] : [],
    changesOutsideProposal: diff
      ? [...diff.changedKeys].some((key) => !affectedKeys.has(key)) ||
        diff.categories.has("program_structure_changed")
      : false,
    limitations: draftReviewLimitations.filter((item) => limitations.has(item)),
    evidence: [
      {
        kind: "coach_draft_review",
        id: decision.id,
        version: COACH_DRAFT_REVIEW_EVIDENCE_VERSION,
      },
    ],
  };
}

type StatusCounts = Readonly<Record<DraftReviewStatus, number>>;
const zeroCounts = (): Record<DraftReviewStatus, number> =>
  Object.fromEntries(
    draftReviewStatuses.map((status) => [status, 0]),
  ) as Record<DraftReviewStatus, number>;

export type CoachDraftReviewHistory = Readonly<{
  schemaVersion: typeof COACH_DRAFT_REVIEW_HISTORY_VERSION;
  /** Transparent counts only: no rates, scores or acceptance percentages. */
  counts: Readonly<{
    materializedDrafts: number;
    byMaterializationOrigin: Readonly<{
      human: number;
      auto_draft: number;
      not_recorded: number;
    }>;
    byStatus: StatusCounts;
    byOriginAndStatus: Readonly<{
      human: StatusCounts;
      auto_draft: StatusCounts;
    }>;
  }>;
  items: readonly CoachDraftReviewEvidence[];
  totalAvailable: number;
  included: number;
  hasMore: boolean;
}>;

/** Deterministic: newest materialization first, then decision id. */
export function buildCoachDraftReviewHistory(
  evidences: readonly CoachDraftReviewEvidence[],
  limit: number = DRAFT_REVIEW_HISTORY_DEFAULT_LIMIT,
): CoachDraftReviewHistory {
  const sorted = [...evidences].sort(
    (a, b) =>
      (b.materializedAt ?? "").localeCompare(a.materializedAt ?? "") ||
      a.decisionId.localeCompare(b.decisionId),
  );
  const byStatus = zeroCounts();
  const human = zeroCounts();
  const auto = zeroCounts();
  const byOrigin = { human: 0, auto_draft: 0, not_recorded: 0 };
  for (const item of sorted) {
    byStatus[item.reviewStatus] += 1;
    if (item.materializationOrigin === "human") {
      byOrigin.human += 1;
      human[item.reviewStatus] += 1;
    } else if (item.materializationOrigin === "auto_draft") {
      byOrigin.auto_draft += 1;
      auto[item.reviewStatus] += 1;
    } else byOrigin.not_recorded += 1;
  }
  const items = sorted.slice(0, Math.max(0, limit));
  return {
    schemaVersion: COACH_DRAFT_REVIEW_HISTORY_VERSION,
    counts: {
      materializedDrafts: sorted.length,
      byMaterializationOrigin: byOrigin,
      byStatus,
      byOriginAndStatus: { human, auto_draft: auto },
    },
    items,
    totalAvailable: sorted.length,
    included: items.length,
    hasMore: sorted.length > items.length,
  };
}
