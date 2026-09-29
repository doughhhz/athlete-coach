import type { BodyWeightEntry } from "../athlete/athlete.ts";
import {
  relationsBetween,
  type ExerciseRelationEdge,
  type ReplacementRelationContext,
} from "../exercise/replacement.ts";
import {
  isAdjustAction,
  isReplaceExerciseAction,
  isSetCountAction,
  materializeProposalPrescription,
  type ReplaceExerciseAction,
  type ReplacementLoadTransition,
  type AddPrescriptionSetAction,
  type CoachDecision,
  type CoachProposalAdjustAction,
  type CoachProposalStatus,
  type PlannedPrescriptionSet,
  type RemovePrescriptionSetAction,
} from "../coach/proposal.ts";
import type { EvidenceReference } from "../dossier/dossier.ts";
import {
  EPLEY_FORMULA_VERSION,
  actualRestSeconds,
  classifyRange,
  estimateOneRepMaxKg,
} from "../performance/performance.ts";
import type {
  ExercisePrescription,
  LoadPrescriptionKind,
  PrescriptionSet,
  ProgramStatus,
  TargetMetric,
  TrainingProgram,
} from "../training/training.ts";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "../workout/workout.ts";

export const INTERVENTION_OUTCOME_SCHEMA_VERSION =
  "intervention-outcome-v3" as const;
export const INDIVIDUAL_RESPONSE_EVIDENCE_SCHEMA_VERSION =
  "individual-response-evidence-v4" as const;
/** Maximum comparable exposures per side (baseline / post) and exercise. */
export const OUTCOME_EXPOSURE_WINDOW = 3;
export const INTERVENTION_HISTORY_LIMIT = 10;
export const OUTCOME_INTERPRETATION_NOTICE =
  "Post-intervention change is evidence, not proof of causation." as const;
export const INDIVIDUAL_RESPONSE_NOTICE =
  "Individual response is learned as accumulated evidence across comparable exposures, not as a single causal conclusion." as const;

/**
 * `set_count` (v2, ADR-0063) is the number of planned sets of one
 * ExercisePrescription. It is not muscle volume or training stimulus.
 */
export const interventionDimensions = [
  "target",
  "planned_rir",
  "planned_rest",
  "absolute_load",
  "set_count",
  "exercise_replacement",
] as const;
export const CROSS_EXERCISE_NOTICE =
  "Load and estimated 1RM are not directly comparable across different canonical Exercises." as const;
export type InterventionDimension = (typeof interventionDimensions)[number];
/** Dimensions that describe a single planned set. */
export const setLevelDimensions = [
  "target",
  "planned_rir",
  "planned_rest",
  "absolute_load",
] as const;
export type SetLevelDimension = (typeof setLevelDimensions)[number];

export const outcomeStatuses = [
  "not_materialized",
  "awaiting_activation",
  "never_activated",
  "awaiting_post_exposure",
  "limited_data",
  "evaluable",
] as const;
/**
 * Factual eligibility, never a judgement. `evaluable` means computable for
 * every affected exercise, not clinically reliable.
 */
export type OutcomeStatus = (typeof outcomeStatuses)[number];

export const outcomeLimitationCodes = [
  "multiple_variables_changed_concurrently",
  "multiple_exercises_changed_concurrently",
  "proposed_action_not_present_at_activation",
  "proposed_value_differs_at_activation",
  "exercise_identity_changed",
  "unproposed_changes_in_affected_prescription",
  "program_revision_changed_other_prescriptions",
  "no_baseline_exposures",
  "fewer_baseline_exposures_than_window",
  "no_post_exposures",
  "fewer_post_exposures_than_window",
  "unequal_exposure_counts",
  "post_window_open",
  "intervention_program_ended_before_window_filled",
  "baseline_includes_other_programs",
  "baseline_includes_prior_intervention",
  "rir_observations_missing",
  "rir_observations_partial",
  "rest_observations_missing",
  "rest_observations_partial",
  "load_observations_missing",
  "set_structure_changed_without_count_change",
  "replacement_relation_missing",
  "body_weight_unavailable",
  "body_weight_changed",
] as const;
export type OutcomeLimitationCode = (typeof outcomeLimitationCodes)[number];
export type OutcomeLimitation = Readonly<{
  code: OutcomeLimitationCode;
  exerciseId: string | null;
}>;

export type PrescriptionDimensionValue =
  | Readonly<{
      dimension: "target";
      metric: TargetMetric;
      min: number;
      max: number;
    }>
  | Readonly<{
      dimension: "planned_rir";
      min: number | null;
      max: number | null;
    }>
  | Readonly<{
      dimension: "planned_rest";
      minSeconds: number | null;
      maxSeconds: number | null;
    }>
  | Readonly<{
      dimension: "absolute_load";
      loadKind: LoadPrescriptionKind;
      loadKg: number | null;
    }>
  | Readonly<{ dimension: "set_count"; count: number }>
  | Readonly<{
      dimension: "exercise_replacement";
      exerciseId: string;
      exerciseName: string | null;
    }>;

export type PrescriptionPath = Readonly<{
  blockSequence: number;
  weekSequence: number;
  daySequence: number;
  prescriptionSequence: number;
  /** `null` for prescription-level (set_count) snapshots. */
  setSequence: number | null;
}>;

/**
 * Replacement context: relations proposed for A → B versus the stored
 * relations of the ACTIVATED pair A → C (rebuilt, never inherited).
 */
export type ReplacementSnapshot = Readonly<{
  proposedReplacementExerciseId: string;
  proposedRelationshipContext: readonly ReplacementRelationContext[];
  actualRelationshipContext: readonly ReplacementRelationContext[];
  loadTransition: ReplacementLoadTransition;
}>;

/** Set-count content: which sets the proposal added and removed. */
export type SetCountChangeSnapshot = Readonly<{
  addedSets: readonly PlannedPrescriptionSet[];
  removedSets: readonly PrescriptionSet[];
}>;

export type InterventionActionSnapshot = Readonly<{
  /** Position of this snapshot in the episode (adjust actions, then set_count). */
  actionIndex: number;
  /** Indexes of the proposal actions this snapshot represents. */
  proposalActionIndexes: readonly number[];
  kind:
    CoachProposalAdjustAction["kind"] | "set_count_change" | "replace_exercise";
  dimension: InterventionDimension;
  exerciseId: string | null;
  exerciseName: string | null;
  sourcePath: PrescriptionPath | null;
  sourcePrescriptionSetId: string | null;
  /** Source/implemented sets whose raw performance forms the changed-set scope. */
  sourceScopeSetIds: readonly string[];
  implementedScopeSetIds: readonly string[];
  setCountChange: SetCountChangeSnapshot | null;
  replacement: ReplacementSnapshot | null;
  sourceValue: PrescriptionDimensionValue | null;
  proposedValue: PrescriptionDimensionValue;
  /** materialize_coach_decision applies the action verbatim; no draft snapshot exists. */
  materializedValue: PrescriptionDimensionValue;
  materializedValueProvenance: "reconstructed_from_source_and_action";
  implementedPrescriptionSetId: string | null;
  implementedValue: PrescriptionDimensionValue | null;
  rationale: string;
  evidence: readonly EvidenceReference[];
}>;

export type ProgramReference = Readonly<{
  id: string;
  revision: number;
}>;
export type InterventionProgramReference = ProgramReference &
  Readonly<{
    status: ProgramStatus;
    activatedAt: string | null;
    completedAt: string | null;
    archivedAt: string | null;
  }>;

export type InterventionEpisode = Readonly<{
  decisionId: string;
  decisionStatus: CoachProposalStatus;
  proposalId: string;
  proposalSchemaVersion: string;
  proposalSummary: string;
  proposedAt: string;
  materializedAt: string | null;
  sourceProgram: ProgramReference;
  interventionProgram: InterventionProgramReference | null;
  activatedAt: string | null;
  actions: readonly InterventionActionSnapshot[];
  affectedExerciseIds: readonly string[];
  affectedDimensions: readonly InterventionDimension[];
  concurrentActionCount: number;
  motivatingEvidence: readonly EvidenceReference[];
  provenance: Readonly<{
    analysisId: string;
    provider: string;
    model: string;
    promptVersion: string;
    policyVersion: string;
    dossierSchemaVersion: string;
  }>;
}>;

export const fidelityDifferenceDimensions = [
  "target",
  "planned_rir",
  "planned_rest",
  "absolute_load",
  "tempo",
  "set_count",
  "exercise",
] as const;
export type FidelityDifference = Readonly<{
  setSequence: number | null;
  dimension: (typeof fidelityDifferenceDimensions)[number];
}>;
export type InterventionActionFidelity = Readonly<{
  actionIndex: number;
  locatedInImplementedProgram: boolean;
  exerciseIdentityPreserved: boolean | null;
  proposedValueImplemented: boolean | null;
  additionalChangesInAffectedPrescription: readonly FidelityDifference[];
}>;
/** Factual comparison proposal → materialized → implemented. No score. */
export type InterventionFidelity = Readonly<{
  implementedProgramState:
    | "activated"
    | "draft_not_activated"
    | "archived_without_activation"
    | "unavailable";
  actions: readonly InterventionActionFidelity[];
  unproposedChangedPrescriptionCount: number;
  structureChanged: boolean;
}>;

export type OutcomeExposure = Readonly<{
  workoutSessionId: string;
  sessionStatus: "completed" | "abandoned";
  startedAt: string;
  sourceProgramId: string | null;
  sourceProgramRevision: number | null;
}>;
export type ValueSummary = Readonly<{
  sampleCount: number;
  total: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}>;
export type RangeCounts = Readonly<{
  below: number;
  within: number;
  above: number;
}>;
export type PlannedValueObservation = Readonly<{
  value: PrescriptionDimensionValue;
  completedSetCount: number;
}>;
export type ObservedFacts = Readonly<{
  /**
   * Exposures that contain at least one set of this scope; the denominator of
   * per-exposure counts. `null` when facts are derived outside a window.
   */
  exposureCount: number | null;
  /** Every planned set snapshot in scope (completed, skipped or pending). */
  plannedSetCount: number;
  completedSetCount: number;
  pendingSetCount: number;
  skippedSetCount: number;
  actualReps: ValueSummary;
  actualSeconds: ValueSummary;
  actualMeters: ValueSummary;
  loadRecordedSetCount: number;
  bestLoggedLoadKg: number | null;
  e1rmEligibleSetCount: number;
  bestEstimatedOneRepMaxKg: number | null;
  target: RangeCounts & Readonly<{ eligible: number }>;
  rir: RangeCounts &
    Readonly<{
      plannedSetCount: number;
      measuredSetCount: number;
      actualRir: ValueSummary;
    }>;
  rest: RangeCounts &
    Readonly<{
      plannedSetCount: number;
      measuredSetCount: number;
      measuredRestSeconds: ValueSummary;
    }>;
  plannedValues: readonly PlannedValueObservation[];
}>;
export type ExerciseOutcomeWindow = Readonly<{
  exerciseId: string;
  exerciseName: string;
  exposureLimit: number;
  exposures: readonly OutcomeExposure[];
  exercise: ObservedFacts;
  affectedPrescriptionSets: ObservedFacts;
}>;
export type ExercisePostOutcomeWindow = ExerciseOutcomeWindow &
  Readonly<{
    closed: boolean;
    closeReason: "max_exposures_reached" | "intervention_program_ended" | null;
  }>;

export const outcomeMetrics = [
  "planned_sets_per_exposure",
  "completed_sets_per_exposure",
  "actual_reps_per_exposure",
  "mean_actual_reps_per_set",
  "mean_actual_seconds_per_set",
  "mean_actual_meters_per_set",
  "best_logged_load_kg",
  "best_estimated_one_rep_max_kg",
  "target_within_range_rate",
  "load_coverage_rate",
  "rir_coverage_rate",
  "rir_within_planned_rate",
  "mean_actual_rir",
  "rest_coverage_rate",
  "rest_within_planned_rate",
  "mean_measured_rest_seconds",
] as const;
export type OutcomeMetric = (typeof outcomeMetrics)[number];
export type OutcomeScopeKind = "exercise" | "affected_prescription_sets";
export type OutcomeComparison = Readonly<{
  metric: OutcomeMetric;
  unit: "sets" | "reps" | "seconds" | "meters" | "kg" | "ratio" | "rir";
  scope: Readonly<{ kind: OutcomeScopeKind; exerciseId: string }>;
  relevantDimensions: readonly InterventionDimension[];
  before: number | null;
  after: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  beforeSampleCount: number;
  afterSampleCount: number;
  evidence: readonly EvidenceReference[];
}>;

/** Metrics that may be shown side by side for different exercises (no delta). */
export const crossExerciseSideBySideMetrics = [
  "planned_sets_per_exposure",
  "completed_sets_per_exposure",
  "actual_reps_per_exposure",
  "target_within_range_rate",
  "rir_coverage_rate",
  "rest_coverage_rate",
] as const satisfies readonly OutcomeMetric[];
/** Never paired across exercises; each keeps its own history. */
export const crossExerciseNonComparableMetrics = [
  "best_logged_load_kg",
  "best_estimated_one_rep_max_kg",
] as const satisfies readonly OutcomeMetric[];

export type CrossExerciseSideBySideFact = Readonly<{
  metric: (typeof crossExerciseSideBySideMetrics)[number];
  unit: OutcomeComparison["unit"];
  before: number | null;
  after: number | null;
  beforeSampleCount: number;
  afterSampleCount: number;
}>;
export type CrossExerciseObservationPair = Readonly<{
  interpretationNotice: typeof CROSS_EXERCISE_NOTICE;
  beforeExerciseId: string;
  beforeExerciseName: string;
  afterExerciseId: string | null;
  afterExerciseName: string | null;
  proposedReplacementExerciseId: string;
  relationshipContext: readonly ReplacementRelationContext[];
  baseline: ExerciseOutcomeWindow;
  postIntervention: ExercisePostOutcomeWindow | null;
  /** Earlier exposures of the replacement exercise; never mixed into baseline. */
  replacementPriorHistory: Readonly<{
    available: boolean;
    window: ExerciseOutcomeWindow | null;
  }>;
  sideBySide: readonly CrossExerciseSideBySideFact[];
  nonComparableMetrics: readonly (typeof crossExerciseNonComparableMetrics)[number][];
}>;

export type BodyWeightObservation = Readonly<{
  entryId: string;
  measuredAt: string;
  weightKg: number;
}>;
export type BodyWeightContext = Readonly<{
  atActivation: BodyWeightObservation | null;
  latestInPostWindow: BodyWeightObservation | null;
  absoluteDeltaKg: number | null;
}>;

export type ExerciseDataCoverage = Readonly<{
  exerciseId: string;
  /** Set only for exercise replacement pairs (post exposures are of this exercise). */
  replacementExerciseId: string | null;
  baselineExposureCount: number;
  postExposureCount: number;
  comparable: boolean;
}>;

export type InterventionOutcomeEvaluation = Readonly<{
  schemaVersion: typeof INTERVENTION_OUTCOME_SCHEMA_VERSION;
  interpretationNotice: typeof OUTCOME_INTERPRETATION_NOTICE;
  decisionId: string;
  sourceProgram: ProgramReference;
  interventionProgram: InterventionProgramReference | null;
  activatedAt: string | null;
  status: OutcomeStatus;
  episode: InterventionEpisode;
  interventionFidelity: InterventionFidelity;
  baseline: readonly ExerciseOutcomeWindow[];
  postIntervention: readonly ExercisePostOutcomeWindow[];
  comparisons: readonly OutcomeComparison[];
  /** Replacement episodes: side-by-side facts, never cross-exercise deltas. */
  crossExercisePairs: readonly CrossExerciseObservationPair[];
  dataCoverage: Readonly<{
    exposureLimit: number;
    exercises: readonly ExerciseDataCoverage[];
  }>;
  bodyWeightContext: BodyWeightContext;
  limitations: readonly OutcomeLimitation[];
  evidenceReferences: readonly EvidenceReference[];
  generatedAt: string;
}>;

// ---------------------------------------------------------------------------
// Prescription values

const dimensionByKind: Readonly<
  Record<CoachProposalAdjustAction["kind"], SetLevelDimension>
> = {
  adjust_prescription_target: "target",
  adjust_prescription_rir: "planned_rir",
  adjust_prescription_rest: "planned_rest",
  adjust_absolute_load_target: "absolute_load",
};

export function prescriptionDimensionValue(
  set: Pick<
    PrescriptionSet,
    | "targetMetric"
    | "targetMin"
    | "targetMax"
    | "rirMin"
    | "rirMax"
    | "restMinSeconds"
    | "restMaxSeconds"
    | "loadKind"
    | "loadKg"
  >,
  dimension: SetLevelDimension,
): PrescriptionDimensionValue {
  if (dimension === "target")
    return {
      dimension,
      metric: set.targetMetric,
      min: set.targetMin,
      max: set.targetMax,
    };
  if (dimension === "planned_rir")
    return { dimension, min: set.rirMin, max: set.rirMax };
  if (dimension === "planned_rest")
    return {
      dimension,
      minSeconds: set.restMinSeconds,
      maxSeconds: set.restMaxSeconds,
    };
  return { dimension, loadKind: set.loadKind, loadKg: set.loadKg };
}

export function proposedDimensionValue(
  action: CoachProposalAdjustAction,
): PrescriptionDimensionValue {
  if (action.kind === "adjust_prescription_target")
    return {
      dimension: "target",
      metric: action.targetMetric,
      min: action.targetMin,
      max: action.targetMax,
    };
  if (action.kind === "adjust_prescription_rir")
    return { dimension: "planned_rir", min: action.rirMin, max: action.rirMax };
  if (action.kind === "adjust_prescription_rest")
    return {
      dimension: "planned_rest",
      minSeconds: action.restMinSeconds,
      maxSeconds: action.restMaxSeconds,
    };
  return {
    dimension: "absolute_load",
    loadKind: "absolute",
    loadKg: action.loadKg,
  };
}

export function samePrescriptionValue(
  a: PrescriptionDimensionValue | null,
  b: PrescriptionDimensionValue | null,
): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Program structure navigation

type LocatedPrescription = Readonly<{
  path: Omit<PrescriptionPath, "setSequence">;
  prescription: ExercisePrescription;
}>;

function prescriptionKey(path: Omit<PrescriptionPath, "setSequence">): string {
  return `${path.blockSequence}.${path.weekSequence}.${path.daySequence}.${path.prescriptionSequence}`;
}
function dayKey(path: Omit<PrescriptionPath, "setSequence">): string {
  return `${path.blockSequence}.${path.weekSequence}.${path.daySequence}`;
}

function flattenPrescriptions(
  program: TrainingProgram,
): readonly LocatedPrescription[] {
  return program.blocks.flatMap((block) =>
    block.weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.prescriptions.map((prescription) => ({
          path: {
            blockSequence: block.sequence,
            weekSequence: week.sequence,
            daySequence: day.sequence,
            prescriptionSequence: prescription.sequence,
          },
          prescription,
        })),
      ),
    ),
  );
}

function locateSourcePrescription(
  program: TrainingProgram | null,
  trainingDayId: string,
  exercisePrescriptionId: string,
): LocatedPrescription | null {
  if (!program) return null;
  for (const block of program.blocks)
    for (const week of block.weeks)
      for (const day of week.days) {
        if (day.id !== trainingDayId) continue;
        const prescription = day.prescriptions.find(
          (item) => item.id === exercisePrescriptionId,
        );
        if (prescription)
          return {
            path: {
              blockSequence: block.sequence,
              weekSequence: week.sequence,
              daySequence: day.sequence,
              prescriptionSequence: prescription.sequence,
            },
            prescription,
          };
      }
  return null;
}

/**
 * Structural correspondence: clones preserve sequences, while draft edits
 * rewrite IDs. Prefer the same path with the same canonical exercise; fall back
 * to the only prescription of that exercise in the corresponding day.
 */
function locateCorrespondingPrescription(
  implemented: readonly LocatedPrescription[],
  source: LocatedPrescription,
  expectedExerciseId: string = source.prescription.exerciseId,
  acceptDifferentExercise = false,
): Readonly<{
  match: LocatedPrescription | null;
  exerciseIdentityPreserved: boolean | null;
}> {
  const samePath = implemented.find(
    (item) => prescriptionKey(item.path) === prescriptionKey(source.path),
  );
  if (samePath?.prescription.exerciseId === expectedExerciseId)
    return { match: samePath, exerciseIdentityPreserved: true };
  const sameExerciseInDay = implemented.filter(
    (item) =>
      dayKey(item.path) === dayKey(source.path) &&
      item.prescription.exerciseId === expectedExerciseId,
  );
  if (sameExerciseInDay.length === 1)
    return { match: sameExerciseInDay[0]!, exerciseIdentityPreserved: true };
  // A replaced prescription stays at its path even when the athlete picked
  // another exercise before activation: that exercise is the intervention.
  if (acceptDifferentExercise && samePath)
    return { match: samePath, exerciseIdentityPreserved: false };
  return {
    match: null,
    exerciseIdentityPreserved: samePath ? false : null,
  };
}

function diffPrescription(
  source: ExercisePrescription,
  implemented: ExercisePrescription,
): readonly FidelityDifference[] {
  const differences: FidelityDifference[] = [];
  if (source.exerciseId !== implemented.exerciseId)
    differences.push({ setSequence: null, dimension: "exercise" });
  if (source.sets.length !== implemented.sets.length)
    differences.push({ setSequence: null, dimension: "set_count" });
  for (const sourceSet of source.sets) {
    const implementedSet = implemented.sets.find(
      (item) => item.sequence === sourceSet.sequence,
    );
    if (!implementedSet) continue;
    for (const dimension of setLevelDimensions) {
      if (
        !samePrescriptionValue(
          prescriptionDimensionValue(sourceSet, dimension),
          prescriptionDimensionValue(implementedSet, dimension),
        )
      )
        differences.push({ setSequence: sourceSet.sequence, dimension });
    }
    if (sourceSet.tempo !== implementedSet.tempo)
      differences.push({ setSequence: sourceSet.sequence, dimension: "tempo" });
  }
  return differences;
}

function programReference(program: TrainingProgram): ProgramReference {
  return { id: program.id, revision: program.revision };
}
function interventionProgramReference(
  program: TrainingProgram,
): InterventionProgramReference {
  return {
    id: program.id,
    revision: program.revision,
    status: program.status,
    activatedAt: program.activatedAt,
    completedAt: program.completedAt,
    archivedAt: program.archivedAt,
  };
}

// ---------------------------------------------------------------------------
// Episode + fidelity

type ResolvedAction = Readonly<{
  snapshot: InterventionActionSnapshot;
  fidelity: InterventionActionFidelity;
  source: LocatedPrescription | null;
  implemented: LocatedPrescription | null;
  /** Structural edit that kept the planned set count (not a set-count change). */
  countUnchangedStructuralEdit: boolean;
}>;

function uniqueEvidence(
  references: readonly EvidenceReference[],
): readonly EvidenceReference[] {
  const seen = new Map<string, EvidenceReference>();
  for (const reference of references)
    if (!seen.has(`${reference.kind}:${reference.id}`))
      seen.set(`${reference.kind}:${reference.id}`, reference);
  return [...seen.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );
}

/**
 * Fidelity compares the ACTIVATED (or current draft) prescription with the
 * expected materialized prescription (pure mirror of the RPC). Differences
 * are manual edits or proposal values that were not kept.
 */
function resolveActions(
  decision: CoachDecision,
  sourceProgram: TrainingProgram | null,
  implementedProgram: TrainingProgram | null,
  relations: readonly ExerciseRelationEdge[] = [],
): readonly ResolvedAction[] {
  const actions = decision.proposal.actions;
  const implementedPrescriptions = implementedProgram
    ? flattenPrescriptions(implementedProgram)
    : [];
  const expectedFor = (source: LocatedPrescription) =>
    materializeProposalPrescription(source.prescription, actions);
  const correspondenceFor = (
    source: LocatedPrescription | null,
    acceptDifferentExercise = false,
  ) =>
    source
      ? locateCorrespondingPrescription(
          implementedPrescriptions,
          source,
          expectedFor(source).exerciseId,
          acceptDifferentExercise,
        )
      : { match: null, exerciseIdentityPreserved: null };
  const additionalFor = (
    source: LocatedPrescription | null,
    match: LocatedPrescription | null,
  ) =>
    source && match
      ? diffPrescription(expectedFor(source), match.prescription)
      : [];
  const resolved: Omit<ResolvedAction, "snapshot" | "fidelity">[] = [];
  const snapshots: InterventionActionSnapshot[] = [];
  const fidelities: InterventionActionFidelity[] = [];

  actions.forEach((action, proposalIndex) => {
    if (!isAdjustAction(action)) return;
    const source = locateSourcePrescription(
      sourceProgram,
      action.trainingDayId,
      action.exercisePrescriptionId,
    );
    const sourceSet =
      source?.prescription.sets.find(
        (item) => item.id === action.prescriptionSetId,
      ) ?? null;
    const located = sourceSet ? source : null;
    const correspondence = correspondenceFor(located);
    const expectedSet =
      located && sourceSet
        ? (expectedFor(located).sets.find((item) => item.id === sourceSet.id) ??
          null)
        : null;
    const implementedSet =
      expectedSet && correspondence.match
        ? (correspondence.match.prescription.sets.find(
            (item) => item.sequence === expectedSet.sequence,
          ) ?? null)
        : null;
    const dimension = dimensionByKind[action.kind];
    const proposedValue = proposedDimensionValue(action);
    const implementedValue = implementedSet
      ? prescriptionDimensionValue(implementedSet, dimension)
      : null;
    const actionIndex = snapshots.length;
    snapshots.push({
      actionIndex,
      proposalActionIndexes: [proposalIndex],
      kind: action.kind,
      dimension,
      exerciseId: located?.prescription.exerciseId ?? null,
      exerciseName: located?.prescription.exerciseName ?? null,
      sourcePath:
        located && sourceSet
          ? { ...located.path, setSequence: sourceSet.sequence }
          : null,
      sourcePrescriptionSetId: action.prescriptionSetId,
      sourceScopeSetIds: [action.prescriptionSetId],
      implementedScopeSetIds: implementedSet ? [implementedSet.id] : [],
      setCountChange: null,
      replacement: null,
      sourceValue: sourceSet
        ? prescriptionDimensionValue(sourceSet, dimension)
        : null,
      proposedValue,
      materializedValue: proposedValue,
      materializedValueProvenance: "reconstructed_from_source_and_action",
      implementedPrescriptionSetId: implementedSet?.id ?? null,
      implementedValue,
      rationale: action.rationale,
      evidence: action.evidence,
    });
    fidelities.push({
      actionIndex,
      locatedInImplementedProgram: implementedSet !== null,
      exerciseIdentityPreserved: implementedProgram
        ? correspondence.exerciseIdentityPreserved
        : null,
      proposedValueImplemented: implementedSet
        ? samePrescriptionValue(proposedValue, implementedValue)
        : implementedProgram
          ? false
          : null,
      additionalChangesInAffectedPrescription: additionalFor(
        located,
        correspondence.match,
      ),
    });
    resolved.push({
      source: located,
      implemented: correspondence.match,
      countUnchangedStructuralEdit: false,
    });
  });

  // One set_count snapshot per prescription touched by add/remove actions.
  const structural = actions
    .map((action, index) => ({ action, index }))
    .filter(
      (
        item,
      ): item is {
        action: AddPrescriptionSetAction | RemovePrescriptionSetAction;
        index: number;
      } => isSetCountAction(item.action),
    );
  const keys = [
    ...new Set(
      structural.map(
        ({ action }) =>
          `${action.trainingDayId}|${action.exercisePrescriptionId}`,
      ),
    ),
  ];
  for (const key of keys) {
    const [dayId, prescriptionId] = key.split("|") as [string, string];
    const items = structural.filter(
      ({ action }) =>
        action.trainingDayId === dayId &&
        action.exercisePrescriptionId === prescriptionId,
    );
    const source = locateSourcePrescription(
      sourceProgram,
      dayId,
      prescriptionId,
    );
    const correspondence = correspondenceFor(source);
    const expected = source ? expectedFor(source) : null;
    const implementedSets = correspondence.match?.prescription.sets ?? null;
    const sourceValue = source
      ? {
          dimension: "set_count" as const,
          count: source.prescription.sets.length,
        }
      : null;
    const proposedCount =
      expected?.sets.length ??
      items.filter(({ action }) => action.kind === "add_prescription_set")
        .length -
        items.filter(({ action }) => action.kind === "remove_prescription_set")
          .length;
    const proposedValue = {
      dimension: "set_count" as const,
      count: proposedCount,
    };
    const implementedValue = implementedSets
      ? { dimension: "set_count" as const, count: implementedSets.length }
      : null;
    const removedIds = new Set(
      items
        .map(({ action }) => action)
        .filter(
          (action): action is RemovePrescriptionSetAction =>
            action.kind === "remove_prescription_set",
        )
        .map((action) => action.prescriptionSetId),
    );
    const actionIndex = snapshots.length;
    snapshots.push({
      actionIndex,
      proposalActionIndexes: items.map(({ index }) => index),
      kind: "set_count_change",
      dimension: "set_count",
      exerciseId: source?.prescription.exerciseId ?? null,
      exerciseName: source?.prescription.exerciseName ?? null,
      sourcePath: source ? { ...source.path, setSequence: null } : null,
      sourcePrescriptionSetId: null,
      sourceScopeSetIds: source?.prescription.sets.map((set) => set.id) ?? [],
      implementedScopeSetIds: implementedSets?.map((set) => set.id) ?? [],
      replacement: null,
      setCountChange: {
        addedSets: items
          .map(({ action }) => action)
          .filter(
            (action): action is AddPrescriptionSetAction =>
              action.kind === "add_prescription_set",
          )
          .map((action) => action.plannedSet),
        removedSets:
          source?.prescription.sets.filter((set) => removedIds.has(set.id)) ??
          [],
      },
      sourceValue,
      proposedValue,
      materializedValue: proposedValue,
      materializedValueProvenance: "reconstructed_from_source_and_action",
      implementedPrescriptionSetId: null,
      implementedValue,
      rationale: items.map(({ action }) => action.rationale).join(" "),
      evidence: items.flatMap(({ action }) => action.evidence),
    });
    fidelities.push({
      actionIndex,
      locatedInImplementedProgram: implementedSets !== null,
      exerciseIdentityPreserved: implementedProgram
        ? correspondence.exerciseIdentityPreserved
        : null,
      proposedValueImplemented: implementedValue
        ? samePrescriptionValue(proposedValue, implementedValue)
        : implementedProgram
          ? false
          : null,
      additionalChangesInAffectedPrescription: additionalFor(
        source,
        correspondence.match,
      ),
    });
    resolved.push({
      source,
      implemented: correspondence.match,
      countUnchangedStructuralEdit:
        sourceValue !== null && sourceValue.count === proposedCount,
    });
  }
  // One exercise_replacement snapshot per replace action.
  actions.forEach((action, proposalIndex) => {
    if (!isReplaceExerciseAction(action)) return;
    const replace: ReplaceExerciseAction = action;
    const source = locateSourcePrescription(
      sourceProgram,
      replace.trainingDayId,
      replace.exercisePrescriptionId,
    );
    const correspondence = correspondenceFor(source, true);
    const implemented = correspondence.match?.prescription ?? null;
    const proposedValue = {
      dimension: "exercise_replacement" as const,
      exerciseId: replace.replacementExerciseId,
      exerciseName: null,
    };
    const implementedValue = implemented
      ? {
          dimension: "exercise_replacement" as const,
          exerciseId: implemented.exerciseId,
          exerciseName: implemented.exerciseName,
        }
      : null;
    const actionIndex = snapshots.length;
    snapshots.push({
      actionIndex,
      proposalActionIndexes: [proposalIndex],
      kind: "replace_exercise",
      dimension: "exercise_replacement",
      exerciseId: source?.prescription.exerciseId ?? null,
      exerciseName: source?.prescription.exerciseName ?? null,
      sourcePath: source ? { ...source.path, setSequence: null } : null,
      sourcePrescriptionSetId: null,
      sourceScopeSetIds: source?.prescription.sets.map((set) => set.id) ?? [],
      implementedScopeSetIds: implemented?.sets.map((set) => set.id) ?? [],
      setCountChange: null,
      replacement: {
        proposedReplacementExerciseId: replace.replacementExerciseId,
        proposedRelationshipContext: replace.relationshipContext,
        actualRelationshipContext:
          source && implemented
            ? relationsBetween(
                source.prescription.exerciseId,
                implemented.exerciseId,
                relations,
              )
            : [],
        loadTransition: replace.loadTransition,
      },
      sourceValue: source
        ? {
            dimension: "exercise_replacement",
            exerciseId: source.prescription.exerciseId,
            exerciseName: source.prescription.exerciseName,
          }
        : null,
      proposedValue,
      materializedValue: proposedValue,
      materializedValueProvenance: "reconstructed_from_source_and_action",
      implementedPrescriptionSetId: null,
      implementedValue,
      rationale: replace.rationale,
      evidence: replace.evidence,
    });
    fidelities.push({
      actionIndex,
      locatedInImplementedProgram: implemented !== null,
      exerciseIdentityPreserved: implementedProgram
        ? correspondence.exerciseIdentityPreserved
        : null,
      proposedValueImplemented: implemented
        ? implemented.exerciseId === replace.replacementExerciseId
        : implementedProgram
          ? false
          : null,
      additionalChangesInAffectedPrescription: additionalFor(
        source,
        correspondence.match,
      ),
    });
    resolved.push({
      source,
      implemented: correspondence.match,
      countUnchangedStructuralEdit: false,
    });
  });
  return resolved.map((item, index) => ({
    ...item,
    snapshot: snapshots[index]!,
    fidelity: fidelities[index]!,
  }));
}

function programWideChanges(
  sourceProgram: TrainingProgram | null,
  implementedProgram: TrainingProgram | null,
  resolved: readonly ResolvedAction[],
): Readonly<{
  unproposedChangedPrescriptionCount: number;
  structureChanged: boolean;
}> {
  if (!sourceProgram || !implementedProgram)
    return { unproposedChangedPrescriptionCount: 0, structureChanged: false };
  const source = flattenPrescriptions(sourceProgram);
  const implemented = flattenPrescriptions(implementedProgram);
  const affectedKeys = new Set(
    resolved
      .map((item) => item.source)
      .filter((item) => item !== null)
      .map((item) => prescriptionKey(item.path)),
  );
  const shape = (program: TrainingProgram) =>
    program.blocks
      .map(
        (block) =>
          `${block.sequence}:${block.weeks.map((week) => `${week.sequence}:${week.days.map((day) => day.sequence).join(",")}`).join(";")}`,
      )
      .join("|");
  let changed = 0;
  for (const item of source) {
    if (affectedKeys.has(prescriptionKey(item.path))) continue;
    const counterpart = implemented.find(
      (candidate) =>
        prescriptionKey(candidate.path) === prescriptionKey(item.path),
    );
    if (
      !counterpart ||
      diffPrescription(item.prescription, counterpart.prescription).length > 0
    )
      changed += 1;
  }
  const sourceKeys = new Set(source.map((item) => prescriptionKey(item.path)));
  changed += implemented.filter(
    (item) => !sourceKeys.has(prescriptionKey(item.path)),
  ).length;
  return {
    unproposedChangedPrescriptionCount: changed,
    structureChanged:
      shape(sourceProgram) !== shape(implementedProgram) ||
      source.length !== implemented.length,
  };
}

function implementedProgramState(
  program: TrainingProgram | null,
): InterventionFidelity["implementedProgramState"] {
  if (!program) return "unavailable";
  if (program.activatedAt !== null) return "activated";
  return program.status === "draft"
    ? "draft_not_activated"
    : "archived_without_activation";
}

export function buildInterventionEpisode(
  decision: CoachDecision,
  sourceProgram: TrainingProgram | null,
  interventionProgram: TrainingProgram | null,
): InterventionEpisode {
  const program =
    decision.status === "materialized" ? interventionProgram : null;
  const resolved = resolveActions(decision, sourceProgram, program);
  return episodeFrom(decision, program, resolved);
}

function episodeFrom(
  decision: CoachDecision,
  program: TrainingProgram | null,
  resolved: readonly ResolvedAction[],
): InterventionEpisode {
  const proposal = decision.proposal;
  const actions = resolved.map((item) => item.snapshot);
  return {
    decisionId: decision.id,
    decisionStatus: decision.status,
    proposalId: proposal.id,
    proposalSchemaVersion: proposal.schemaVersion,
    proposalSummary: proposal.summary,
    proposedAt: decision.proposedAt,
    materializedAt: decision.materializedAt,
    sourceProgram: {
      id: proposal.sourceProgramId,
      revision: proposal.sourceProgramRevision,
    },
    interventionProgram: program ? interventionProgramReference(program) : null,
    activatedAt: program?.activatedAt ?? null,
    actions,
    affectedExerciseIds: [
      ...new Set(
        actions
          .map((action) => action.exerciseId)
          .filter((id): id is string => id !== null),
      ),
    ].sort(),
    affectedDimensions: interventionDimensions.filter((dimension) =>
      actions.some((action) => action.dimension === dimension),
    ),
    concurrentActionCount: actions.length,
    motivatingEvidence: uniqueEvidence([
      ...proposal.evidenceReferences,
      ...proposal.actions.flatMap((action) => action.evidence),
    ]),
    provenance: {
      analysisId: proposal.analysisId,
      provider: proposal.analysisSnapshot.provider,
      model: proposal.analysisSnapshot.model,
      promptVersion: proposal.analysisSnapshot.promptVersion,
      policyVersion: proposal.analysisSnapshot.policyVersion,
      dossierSchemaVersion: proposal.analysisSnapshot.dossierSchemaVersion,
    },
  };
}

// ---------------------------------------------------------------------------
// Observed facts

function summarize(values: readonly number[]): ValueSummary {
  if (!values.length)
    return { sampleCount: 0, total: 0, min: null, max: null, mean: null };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: values.length,
    total,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: total / values.length,
  };
}

function rangeCounts(
  values: readonly ("below_range" | "within_range" | "above_range")[],
): RangeCounts {
  return {
    below: values.filter((value) => value === "below_range").length,
    within: values.filter((value) => value === "within_range").length,
    above: values.filter((value) => value === "above_range").length,
  };
}

function plannedWorkoutValue(
  set: WorkoutSet,
  dimension: SetLevelDimension,
): PrescriptionDimensionValue {
  return prescriptionDimensionValue(
    {
      targetMetric: set.plannedMetric,
      targetMin: set.plannedTargetMin,
      targetMax: set.plannedTargetMax,
      rirMin: set.plannedRirMin,
      rirMax: set.plannedRirMax,
      restMinSeconds: set.plannedRestMinSeconds,
      restMaxSeconds: set.plannedRestMaxSeconds,
      loadKind: set.plannedLoadKind,
      loadKg: set.plannedLoadKg,
    },
    dimension,
  );
}

export function deriveObservedFacts(
  sets: readonly WorkoutSet[],
  dimensions: readonly InterventionDimension[] = interventionDimensions,
): ObservedFacts {
  const completed = sets.filter(
    (set) => set.status === "completed" && set.actualValue !== null,
  );
  const values = (metric: TargetMetric) =>
    completed
      .filter((set) => set.plannedMetric === metric)
      .map((set) => set.actualValue!);
  const loads = completed
    .map((set) => set.actualLoadKg)
    .filter((value): value is number => value !== null);
  const e1rms = completed
    .map((set) =>
      estimateOneRepMaxKg({
        metric: set.plannedMetric,
        reps: set.actualValue,
        loadKg: set.actualLoadKg,
        status: set.status,
      }),
    )
    .filter((value): value is number => value !== null);
  const rirPlanned = completed.filter(
    (set) => set.plannedRirMin !== null && set.plannedRirMax !== null,
  );
  const rirMeasured = rirPlanned.filter((set) => set.actualRir !== null);
  const restPlanned = completed.filter(
    (set) =>
      set.plannedRestMinSeconds !== null && set.plannedRestMaxSeconds !== null,
  );
  const restMeasured = restPlanned
    .map((set) => ({ set, seconds: actualRestSeconds(set) }))
    .filter(
      (item): item is { set: WorkoutSet; seconds: number } =>
        item.seconds !== null,
    );
  const planned = new Map<string, PlannedValueObservation>();
  for (const set of completed)
    for (const dimension of setLevelDimensions.filter((item) =>
      dimensions.includes(item),
    )) {
      const value = plannedWorkoutValue(set, dimension);
      const key = JSON.stringify(value);
      planned.set(key, {
        value,
        completedSetCount: (planned.get(key)?.completedSetCount ?? 0) + 1,
      });
    }
  return {
    exposureCount: null,
    plannedSetCount: sets.length,
    completedSetCount: completed.length,
    pendingSetCount: sets.filter((set) => set.status === "pending").length,
    skippedSetCount: sets.filter((set) => set.status === "skipped").length,
    actualReps: summarize(values("reps")),
    actualSeconds: summarize(values("seconds")),
    actualMeters: summarize(values("meters")),
    loadRecordedSetCount: loads.length,
    bestLoggedLoadKg: loads.length ? Math.max(...loads) : null,
    e1rmEligibleSetCount: e1rms.length,
    bestEstimatedOneRepMaxKg: e1rms.length ? Math.max(...e1rms) : null,
    target: {
      eligible: completed.length,
      ...rangeCounts(
        completed.map((set) =>
          classifyRange(
            set.actualValue!,
            set.plannedTargetMin,
            set.plannedTargetMax,
          ),
        ),
      ),
    },
    rir: {
      plannedSetCount: rirPlanned.length,
      measuredSetCount: rirMeasured.length,
      actualRir: summarize(rirMeasured.map((set) => set.actualRir!)),
      ...rangeCounts(
        rirMeasured.map((set) =>
          classifyRange(set.actualRir!, set.plannedRirMin!, set.plannedRirMax!),
        ),
      ),
    },
    rest: {
      plannedSetCount: restPlanned.length,
      measuredSetCount: restMeasured.length,
      measuredRestSeconds: summarize(restMeasured.map((item) => item.seconds)),
      ...rangeCounts(
        restMeasured.map((item) =>
          classifyRange(
            item.seconds,
            item.set.plannedRestMinSeconds!,
            item.set.plannedRestMaxSeconds!,
          ),
        ),
      ),
    },
    plannedValues: [...planned.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
  };
}

// ---------------------------------------------------------------------------
// Exposure windows

type ExposureCandidate = Readonly<{
  session: WorkoutSession;
  exercises: readonly WorkoutExercise[];
}>;

function exposureCandidates(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
): readonly ExposureCandidate[] {
  return sessions
    .filter(
      (session) =>
        session.status === "completed" || session.status === "abandoned",
    )
    .map((session) => ({
      session,
      exercises: session.exercises.filter(
        (exercise) => exercise.exerciseId === exerciseId,
      ),
    }))
    .filter(({ exercises }) =>
      exercises.some((exercise) =>
        exercise.sets.some(
          (set) => set.status === "completed" && set.actualValue !== null,
        ),
      ),
    )
    .sort(
      (a, b) =>
        a.session.startedAt.localeCompare(b.session.startedAt) ||
        a.session.id.localeCompare(b.session.id),
    );
}

function toExposure(candidate: ExposureCandidate): OutcomeExposure {
  return {
    workoutSessionId: candidate.session.id,
    sessionStatus: candidate.session.status as "completed" | "abandoned",
    startedAt: candidate.session.startedAt,
    sourceProgramId: candidate.session.sourceProgram?.id ?? null,
    sourceProgramRevision: candidate.session.sourceProgram?.revision ?? null,
  };
}

function windowFacts(
  exerciseId: string,
  exerciseName: string,
  candidates: readonly ExposureCandidate[],
  affectedSetIds: ReadonlySet<string>,
  dimensions: readonly InterventionDimension[],
): ExerciseOutcomeWindow {
  const sets = candidates.flatMap((candidate) =>
    candidate.exercises.flatMap((exercise) => exercise.sets),
  );
  return {
    exerciseId,
    exerciseName,
    exposureLimit: OUTCOME_EXPOSURE_WINDOW,
    exposures: candidates.map(toExposure),
    exercise: {
      ...deriveObservedFacts(sets, dimensions),
      exposureCount: candidates.length,
    },
    affectedPrescriptionSets: {
      ...deriveObservedFacts(
        sets.filter((set) => affectedSetIds.has(set.sourcePrescriptionSetId)),
        dimensions,
      ),
      exposureCount: candidates.filter((candidate) =>
        candidate.exercises.some((exercise) =>
          exercise.sets.some((set) =>
            affectedSetIds.has(set.sourcePrescriptionSetId),
          ),
        ),
      ).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Comparisons

function delta(
  before: number | null,
  after: number | null,
): Readonly<{ absoluteDelta: number | null; relativeDelta: number | null }> {
  if (before === null || after === null)
    return { absoluteDelta: null, relativeDelta: null };
  return {
    absoluteDelta: after - before,
    relativeDelta: before === 0 ? null : (after - before) / Math.abs(before),
  };
}
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Which intervention dimensions each outcome metric is directly relevant to. */
export const outcomeMetricDimensions: Readonly<
  Record<OutcomeMetric, readonly InterventionDimension[]>
> = {
  planned_sets_per_exposure: ["set_count"],
  completed_sets_per_exposure: ["set_count"],
  actual_reps_per_exposure: ["set_count"],
  mean_actual_reps_per_set: ["target", "absolute_load"],
  mean_actual_seconds_per_set: ["target"],
  mean_actual_meters_per_set: ["target"],
  best_logged_load_kg: ["target", "absolute_load", "set_count"],
  best_estimated_one_rep_max_kg: ["target", "absolute_load", "set_count"],
  target_within_range_rate: ["target", "absolute_load", "set_count"],
  load_coverage_rate: ["absolute_load"],
  rir_coverage_rate: ["planned_rir", "set_count"],
  rir_within_planned_rate: ["planned_rir", "set_count"],
  mean_actual_rir: ["planned_rir", "absolute_load"],
  rest_coverage_rate: ["planned_rest", "set_count"],
  rest_within_planned_rate: ["planned_rest", "set_count"],
  mean_measured_rest_seconds: ["planned_rest"],
};

type MetricReading = Readonly<{
  unit: OutcomeComparison["unit"];
  value: number | null;
  sampleCount: number;
}>;
function readMetric(
  metric: OutcomeMetric,
  facts: ObservedFacts,
  exposureCount: number,
): MetricReading {
  switch (metric) {
    case "planned_sets_per_exposure":
      return {
        unit: "sets",
        value: ratio(facts.plannedSetCount, exposureCount),
        sampleCount: exposureCount,
      };
    case "actual_reps_per_exposure":
      return {
        unit: "reps",
        value: ratio(facts.actualReps.total, exposureCount),
        sampleCount: exposureCount,
      };
    case "completed_sets_per_exposure":
      return {
        unit: "sets",
        value: ratio(facts.completedSetCount, exposureCount),
        sampleCount: exposureCount,
      };
    case "mean_actual_reps_per_set":
      return {
        unit: "reps",
        value: facts.actualReps.mean,
        sampleCount: facts.actualReps.sampleCount,
      };
    case "mean_actual_seconds_per_set":
      return {
        unit: "seconds",
        value: facts.actualSeconds.mean,
        sampleCount: facts.actualSeconds.sampleCount,
      };
    case "mean_actual_meters_per_set":
      return {
        unit: "meters",
        value: facts.actualMeters.mean,
        sampleCount: facts.actualMeters.sampleCount,
      };
    case "best_logged_load_kg":
      return {
        unit: "kg",
        value: facts.bestLoggedLoadKg,
        sampleCount: facts.loadRecordedSetCount,
      };
    case "best_estimated_one_rep_max_kg":
      return {
        unit: "kg",
        value: facts.bestEstimatedOneRepMaxKg,
        sampleCount: facts.e1rmEligibleSetCount,
      };
    case "target_within_range_rate":
      return {
        unit: "ratio",
        value: ratio(facts.target.within, facts.target.eligible),
        sampleCount: facts.target.eligible,
      };
    case "load_coverage_rate":
      return {
        unit: "ratio",
        value: ratio(facts.loadRecordedSetCount, facts.completedSetCount),
        sampleCount: facts.completedSetCount,
      };
    case "rir_coverage_rate":
      return {
        unit: "ratio",
        value: ratio(facts.rir.measuredSetCount, facts.rir.plannedSetCount),
        sampleCount: facts.rir.plannedSetCount,
      };
    case "rir_within_planned_rate":
      return {
        unit: "ratio",
        value: ratio(facts.rir.within, facts.rir.measuredSetCount),
        sampleCount: facts.rir.measuredSetCount,
      };
    case "mean_actual_rir":
      return {
        unit: "rir",
        value: facts.rir.actualRir.mean,
        sampleCount: facts.rir.actualRir.sampleCount,
      };
    case "rest_coverage_rate":
      return {
        unit: "ratio",
        value: ratio(facts.rest.measuredSetCount, facts.rest.plannedSetCount),
        sampleCount: facts.rest.plannedSetCount,
      };
    case "rest_within_planned_rate":
      return {
        unit: "ratio",
        value: ratio(facts.rest.within, facts.rest.measuredSetCount),
        sampleCount: facts.rest.measuredSetCount,
      };
    case "mean_measured_rest_seconds":
      return {
        unit: "seconds",
        value: facts.rest.measuredRestSeconds.mean,
        sampleCount: facts.rest.measuredRestSeconds.sampleCount,
      };
  }
}

/** Per-session counts only make sense for the changed-set scope of set_count. */
const perExposureMetrics: ReadonlySet<OutcomeMetric> = new Set([
  "planned_sets_per_exposure",
  "completed_sets_per_exposure",
  "actual_reps_per_exposure",
]);

function compareWindows(
  baseline: ExerciseOutcomeWindow,
  post: ExerciseOutcomeWindow,
  exerciseDimensions: readonly InterventionDimension[],
): readonly OutcomeComparison[] {
  const sessionEvidence = [...baseline.exposures, ...post.exposures].map(
    (exposure) => ({
      kind: "workout_session" as const,
      id: exposure.workoutSessionId,
      version: null,
    }),
  );
  const scopes: readonly [OutcomeScopeKind, ObservedFacts, ObservedFacts][] = [
    ["exercise", baseline.exercise, post.exercise],
    [
      "affected_prescription_sets",
      baseline.affectedPrescriptionSets,
      post.affectedPrescriptionSets,
    ],
  ];
  return scopes.flatMap(([kind, before, after]) =>
    outcomeMetrics
      .filter(
        (metric) =>
          kind === "exercise" ||
          !perExposureMetrics.has(metric) ||
          exerciseDimensions.includes("set_count"),
      )
      .map((metric) => {
        const a = readMetric(
          metric,
          before,
          before.exposureCount ?? baseline.exposures.length,
        );
        const b = readMetric(
          metric,
          after,
          after.exposureCount ?? post.exposures.length,
        );
        return { metric, a, b };
      })
      .filter(({ a, b }) => a.value !== null || b.value !== null)
      .map(({ metric, a, b }) => ({
        metric,
        unit: a.unit,
        scope: { kind, exerciseId: baseline.exerciseId },
        relevantDimensions: outcomeMetricDimensions[metric].filter(
          (dimension) => exerciseDimensions.includes(dimension),
        ),
        before: a.value,
        after: b.value,
        ...delta(a.value, b.value),
        beforeSampleCount: a.sampleCount,
        afterSampleCount: b.sampleCount,
        evidence: uniqueEvidence([
          ...sessionEvidence,
          { kind: "exercise", id: baseline.exerciseId, version: null },
          ...(metric === "best_estimated_one_rep_max_kg"
            ? [
                {
                  kind: "derived_calculation" as const,
                  id: "estimated_one_rep_max",
                  version: EPLEY_FORMULA_VERSION,
                },
              ]
            : []),
        ]),
      })),
  );
}

// ---------------------------------------------------------------------------
// Body weight

function weightObservation(entry: BodyWeightEntry): BodyWeightObservation {
  return {
    entryId: entry.id,
    measuredAt: entry.measuredAt,
    weightKg: entry.weightKg,
  };
}
function latestEntry(
  entries: readonly BodyWeightEntry[],
  after: string | null,
  atOrBefore: string,
): BodyWeightEntry | null {
  const candidates = entries
    .filter(
      (entry) =>
        Date.parse(entry.measuredAt) <= Date.parse(atOrBefore) &&
        (after === null || Date.parse(entry.measuredAt) > Date.parse(after)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.measuredAt) - Date.parse(a.measuredAt) ||
        a.id.localeCompare(b.id),
    );
  return candidates[0] ?? null;
}
export function deriveBodyWeightContext(
  entries: readonly BodyWeightEntry[],
  activatedAt: string | null,
  lastPostExposureStartedAt: string | null,
): BodyWeightContext {
  if (activatedAt === null)
    return {
      atActivation: null,
      latestInPostWindow: null,
      absoluteDeltaKg: null,
    };
  const atActivation = latestEntry(entries, null, activatedAt);
  const latestInPostWindow =
    lastPostExposureStartedAt === null
      ? null
      : latestEntry(entries, activatedAt, lastPostExposureStartedAt);
  return {
    atActivation: atActivation ? weightObservation(atActivation) : null,
    latestInPostWindow: latestInPostWindow
      ? weightObservation(latestInPostWindow)
      : null,
    absoluteDeltaKg:
      atActivation && latestInPostWindow
        ? latestInPostWindow.weightKg - atActivation.weightKg
        : null,
  };
}

// ---------------------------------------------------------------------------
// Evaluation

export type BuildInterventionOutcomeInput = Readonly<{
  decision: CoachDecision;
  sourceProgram: TrainingProgram | null;
  interventionProgram: TrainingProgram | null;
  sessions: readonly WorkoutSession[];
  bodyWeights: readonly BodyWeightEntry[];
  /** Materialized program IDs of every decision, to flag overlapping episodes. */
  interventionProgramIds?: ReadonlySet<string>;
  /** Stored exercise relations, to rebuild the activated replacement context. */
  exerciseRelations?: readonly ExerciseRelationEdge[];
  generatedAt: string;
}>;

function coverageLimitations(
  exerciseId: string,
  facts: ObservedFacts,
  dimensions: readonly InterventionDimension[],
): readonly OutcomeLimitation[] {
  const result: OutcomeLimitation[] = [];
  const check = (
    planned: number,
    measured: number,
    missing: OutcomeLimitationCode,
    partial: OutcomeLimitationCode,
  ) => {
    if (planned === 0) return;
    if (measured === 0) result.push({ code: missing, exerciseId });
    else if (measured < planned) result.push({ code: partial, exerciseId });
  };
  if (dimensions.includes("planned_rir"))
    check(
      facts.rir.plannedSetCount,
      facts.rir.measuredSetCount,
      "rir_observations_missing",
      "rir_observations_partial",
    );
  if (dimensions.includes("planned_rest"))
    check(
      facts.rest.plannedSetCount,
      facts.rest.measuredSetCount,
      "rest_observations_missing",
      "rest_observations_partial",
    );
  if (
    dimensions.includes("absolute_load") &&
    facts.completedSetCount > 0 &&
    facts.loadRecordedSetCount === 0
  )
    result.push({ code: "load_observations_missing", exerciseId });
  return result;
}

function sortLimitations(
  limitations: readonly OutcomeLimitation[],
): readonly OutcomeLimitation[] {
  const unique = new Map<string, OutcomeLimitation>();
  for (const item of limitations)
    unique.set(`${item.exerciseId ?? ""}|${item.code}`, item);
  return [...unique.values()].sort(
    (a, b) =>
      (a.exerciseId ?? "").localeCompare(b.exerciseId ?? "") ||
      outcomeLimitationCodes.indexOf(a.code) -
        outcomeLimitationCodes.indexOf(b.code),
  );
}

export function buildInterventionOutcome(
  input: BuildInterventionOutcomeInput,
): InterventionOutcomeEvaluation {
  const { decision } = input;
  // Defense in depth on top of RLS: never mix another athlete's data.
  const owned = (program: TrainingProgram | null) =>
    program && program.athleteId === decision.athleteId ? program : null;
  const sourceProgram = owned(input.sourceProgram);
  const program =
    decision.status === "materialized"
      ? owned(input.interventionProgram)
      : null;
  const sessions = input.sessions.filter(
    (session) => session.athleteId === decision.athleteId,
  );
  const bodyWeights = input.bodyWeights.filter(
    (entry) => entry.athleteId === decision.athleteId,
  );
  const resolved = resolveActions(
    decision,
    sourceProgram,
    program,
    input.exerciseRelations ?? [],
  );
  const episode = episodeFrom(decision, program, resolved);
  const wide = programWideChanges(sourceProgram, program, resolved);
  const fidelity: InterventionFidelity = {
    implementedProgramState: implementedProgramState(program),
    actions: resolved.map((item) => item.fidelity),
    unproposedChangedPrescriptionCount: wide.unproposedChangedPrescriptionCount,
    structureChanged: wide.structureChanged,
  };
  const base = {
    schemaVersion: INTERVENTION_OUTCOME_SCHEMA_VERSION,
    interpretationNotice: OUTCOME_INTERPRETATION_NOTICE,
    decisionId: decision.id,
    sourceProgram: sourceProgram
      ? programReference(sourceProgram)
      : episode.sourceProgram,
    interventionProgram: episode.interventionProgram,
    activatedAt: episode.activatedAt,
    episode,
    interventionFidelity: fidelity,
    generatedAt: new Date(input.generatedAt).toISOString(),
  };
  const decisionEvidence: EvidenceReference = {
    kind: "coach_decision",
    id: decision.id,
    version: decision.proposal.schemaVersion,
  };
  const programEvidence: EvidenceReference[] = [
    {
      kind: "training_program",
      id: episode.sourceProgram.id,
      version: String(episode.sourceProgram.revision),
    },
    ...(program
      ? [
          {
            kind: "training_program" as const,
            id: program.id,
            version: String(program.revision),
          },
        ]
      : []),
  ];
  const activatedAt = program?.activatedAt ?? null;
  if (!program || activatedAt === null) {
    return {
      ...base,
      status: !program
        ? "not_materialized"
        : program.status === "draft"
          ? "awaiting_activation"
          : "never_activated",
      baseline: [],
      postIntervention: [],
      comparisons: [],
      crossExercisePairs: [],
      dataCoverage: { exposureLimit: OUTCOME_EXPOSURE_WINDOW, exercises: [] },
      bodyWeightContext: deriveBodyWeightContext([], null, null),
      limitations: [],
      evidenceReferences: uniqueEvidence([
        decisionEvidence,
        ...programEvidence,
      ]),
    };
  }

  const activation = Date.parse(activatedAt);
  const limitations: OutcomeLimitation[] = [];
  if (
    episode.concurrentActionCount > 1 ||
    resolved.some(
      (item) =>
        item.fidelity.additionalChangesInAffectedPrescription.length > 0,
    )
  )
    limitations.push({
      code: "multiple_variables_changed_concurrently",
      exerciseId: null,
    });
  if (episode.affectedExerciseIds.length > 1)
    limitations.push({
      code: "multiple_exercises_changed_concurrently",
      exerciseId: null,
    });
  if (
    fidelity.unproposedChangedPrescriptionCount > 0 ||
    fidelity.structureChanged
  )
    limitations.push({
      code: "program_revision_changed_other_prescriptions",
      exerciseId: null,
    });
  for (const item of resolved) {
    const exerciseId = item.snapshot.exerciseId;
    if (!item.fidelity.locatedInImplementedProgram)
      limitations.push({
        code: "proposed_action_not_present_at_activation",
        exerciseId,
      });
    else if (item.fidelity.proposedValueImplemented === false)
      limitations.push({
        code: "proposed_value_differs_at_activation",
        exerciseId,
      });
    if (item.fidelity.exerciseIdentityPreserved === false)
      limitations.push({ code: "exercise_identity_changed", exerciseId });
    if (item.countUnchangedStructuralEdit)
      limitations.push({
        code: "set_structure_changed_without_count_change",
        exerciseId,
      });
    if (item.fidelity.additionalChangesInAffectedPrescription.length > 0)
      limitations.push({
        code: "unproposed_changes_in_affected_prescription",
        exerciseId,
      });
  }

  // Prescriptions whose exercise is replaced leave the same-exercise loop:
  // their before/after is a cross-exercise pair (ADR-0070).
  const replacedKeys = new Set(
    resolved
      .filter(
        (item) =>
          item.snapshot.dimension === "exercise_replacement" &&
          item.source !== null,
      )
      .map((item) => prescriptionKey(item.source!.path)),
  );
  const exercises = episode.affectedExerciseIds.flatMap((exerciseId) => {
    const items = resolved.filter(
      (item) =>
        item.snapshot.exerciseId === exerciseId &&
        item.snapshot.dimension !== "exercise_replacement" &&
        !(item.source && replacedKeys.has(prescriptionKey(item.source.path))),
    );
    if (!items.length) return [];
    return [
      {
        exerciseId,
        exerciseName: items[0]!.snapshot.exerciseName ?? exerciseId,
        dimensions: interventionDimensions.filter((dimension) =>
          items.some((item) => item.snapshot.dimension === dimension),
        ),
        sourceSetIds: new Set(
          items.flatMap((item) => item.snapshot.sourceScopeSetIds),
        ),
        implementedSetIds: new Set(
          items.flatMap((item) => item.snapshot.implementedScopeSetIds),
        ),
      },
    ];
  });

  const baseline: ExerciseOutcomeWindow[] = [];
  const postIntervention: ExercisePostOutcomeWindow[] = [];
  const comparisons: OutcomeComparison[] = [];
  const coverage: ExerciseDataCoverage[] = [];
  const programEnded = program.status !== "active";
  for (const exercise of exercises) {
    const candidates = exposureCandidates(sessions, exercise.exerciseId);
    const before = candidates
      .filter(({ session }) => Date.parse(session.startedAt) < activation)
      .slice(-OUTCOME_EXPOSURE_WINDOW);
    const after = candidates
      .filter(
        ({ session }) =>
          Date.parse(session.startedAt) >= activation &&
          session.sourceProgram?.id === program.id,
      )
      .slice(0, OUTCOME_EXPOSURE_WINDOW);
    const baselineWindow = windowFacts(
      exercise.exerciseId,
      exercise.exerciseName,
      before,
      exercise.sourceSetIds,
      exercise.dimensions,
    );
    const postFacts = windowFacts(
      exercise.exerciseId,
      exercise.exerciseName,
      after,
      exercise.implementedSetIds,
      exercise.dimensions,
    );
    const filled = after.length >= OUTCOME_EXPOSURE_WINDOW;
    const postWindow: ExercisePostOutcomeWindow = {
      ...postFacts,
      closed: filled || programEnded,
      closeReason: filled
        ? "max_exposures_reached"
        : programEnded
          ? "intervention_program_ended"
          : null,
    };
    baseline.push(baselineWindow);
    postIntervention.push(postWindow);
    const comparable = before.length > 0 && after.length > 0;
    coverage.push({
      exerciseId: exercise.exerciseId,
      replacementExerciseId: null,
      baselineExposureCount: before.length,
      postExposureCount: after.length,
      comparable,
    });
    if (comparable)
      comparisons.push(
        ...compareWindows(baselineWindow, postWindow, exercise.dimensions),
      );

    const id = exercise.exerciseId;
    if (!before.length)
      limitations.push({ code: "no_baseline_exposures", exerciseId: id });
    else if (before.length < OUTCOME_EXPOSURE_WINDOW)
      limitations.push({
        code: "fewer_baseline_exposures_than_window",
        exerciseId: id,
      });
    if (!after.length)
      limitations.push({ code: "no_post_exposures", exerciseId: id });
    else if (after.length < OUTCOME_EXPOSURE_WINDOW)
      limitations.push({
        code: "fewer_post_exposures_than_window",
        exerciseId: id,
      });
    if (comparable && before.length !== after.length)
      limitations.push({ code: "unequal_exposure_counts", exerciseId: id });
    if (!postWindow.closed)
      limitations.push({ code: "post_window_open", exerciseId: id });
    else if (postWindow.closeReason === "intervention_program_ended")
      limitations.push({
        code: "intervention_program_ended_before_window_filled",
        exerciseId: id,
      });
    const baselinePrograms = baselineWindow.exposures.map(
      (exposure) => exposure.sourceProgramId,
    );
    if (
      baselinePrograms.some(
        (programId) => programId !== episode.sourceProgram.id,
      )
    )
      limitations.push({
        code: "baseline_includes_other_programs",
        exerciseId: id,
      });
    if (
      baselinePrograms.some(
        (programId) =>
          programId !== null &&
          programId !== program.id &&
          (input.interventionProgramIds?.has(programId) ?? false),
      )
    )
      limitations.push({
        code: "baseline_includes_prior_intervention",
        exerciseId: id,
      });
    if (comparable)
      for (const facts of [
        baselineWindow.affectedPrescriptionSets,
        postWindow.affectedPrescriptionSets,
      ])
        limitations.push(
          ...coverageLimitations(id, facts, exercise.dimensions),
        );
  }

  const crossExercisePairs: CrossExerciseObservationPair[] = [];
  for (const item of resolved.filter(
    (candidate) => candidate.snapshot.dimension === "exercise_replacement",
  )) {
    const snapshot = item.snapshot;
    const sourceId = snapshot.exerciseId;
    if (!sourceId || !snapshot.replacement) continue;
    const afterValue = snapshot.implementedValue;
    const replacementId =
      afterValue?.dimension === "exercise_replacement"
        ? afterValue.exerciseId
        : null;
    const replacementName =
      afterValue?.dimension === "exercise_replacement"
        ? afterValue.exerciseName
        : null;
    const before = exposureCandidates(sessions, sourceId)
      .filter(({ session }) => Date.parse(session.startedAt) < activation)
      .slice(-OUTCOME_EXPOSURE_WINDOW);
    const baselineWindow = windowFacts(
      sourceId,
      snapshot.exerciseName ?? sourceId,
      before,
      new Set(snapshot.sourceScopeSetIds),
      [],
    );
    const replacementCandidates = replacementId
      ? exposureCandidates(sessions, replacementId)
      : [];
    const after = replacementCandidates
      .filter(
        ({ session }) =>
          Date.parse(session.startedAt) >= activation &&
          session.sourceProgram?.id === program.id,
      )
      .slice(0, OUTCOME_EXPOSURE_WINDOW);
    const prior = replacementCandidates
      .filter(({ session }) => Date.parse(session.startedAt) < activation)
      .slice(-OUTCOME_EXPOSURE_WINDOW);
    const filled = after.length >= OUTCOME_EXPOSURE_WINDOW;
    const postWindow: ExercisePostOutcomeWindow | null = replacementId
      ? {
          ...windowFacts(
            replacementId,
            replacementName ?? replacementId,
            after,
            new Set(snapshot.implementedScopeSetIds),
            [],
          ),
          closed: filled || programEnded,
          closeReason: filled
            ? "max_exposures_reached"
            : programEnded
              ? "intervention_program_ended"
              : null,
        }
      : null;
    const priorWindow =
      replacementId && prior.length
        ? windowFacts(
            replacementId,
            replacementName ?? replacementId,
            prior,
            new Set(),
            [],
          )
        : null;
    const sideBySide = crossExerciseSideBySideMetrics.flatMap((metric) => {
      const a = readMetric(
        metric,
        baselineWindow.affectedPrescriptionSets,
        baselineWindow.affectedPrescriptionSets.exposureCount ?? before.length,
      );
      const b = postWindow
        ? readMetric(
            metric,
            postWindow.affectedPrescriptionSets,
            postWindow.affectedPrescriptionSets.exposureCount ?? after.length,
          )
        : null;
      return a.value === null && (b?.value ?? null) === null
        ? []
        : [
            {
              metric,
              unit: a.unit,
              before: a.value,
              after: b?.value ?? null,
              beforeSampleCount: a.sampleCount,
              afterSampleCount: b?.sampleCount ?? 0,
            },
          ];
    });
    crossExercisePairs.push({
      interpretationNotice: CROSS_EXERCISE_NOTICE,
      beforeExerciseId: sourceId,
      beforeExerciseName: snapshot.exerciseName ?? sourceId,
      afterExerciseId: replacementId,
      afterExerciseName: replacementName,
      proposedReplacementExerciseId:
        snapshot.replacement.proposedReplacementExerciseId,
      relationshipContext: snapshot.replacement.actualRelationshipContext,
      baseline: baselineWindow,
      postIntervention: postWindow,
      replacementPriorHistory: {
        available: priorWindow !== null,
        window: priorWindow,
      },
      sideBySide,
      nonComparableMetrics: [...crossExerciseNonComparableMetrics],
    });
    const comparable = before.length > 0 && after.length > 0;
    coverage.push({
      exerciseId: sourceId,
      replacementExerciseId: replacementId,
      baselineExposureCount: before.length,
      postExposureCount: after.length,
      comparable,
    });
    if (!before.length)
      limitations.push({ code: "no_baseline_exposures", exerciseId: sourceId });
    else if (before.length < OUTCOME_EXPOSURE_WINDOW)
      limitations.push({
        code: "fewer_baseline_exposures_than_window",
        exerciseId: sourceId,
      });
    if (!after.length)
      limitations.push({ code: "no_post_exposures", exerciseId: sourceId });
    else if (after.length < OUTCOME_EXPOSURE_WINDOW)
      limitations.push({
        code: "fewer_post_exposures_than_window",
        exerciseId: sourceId,
      });
    if (comparable && before.length !== after.length)
      limitations.push({
        code: "unequal_exposure_counts",
        exerciseId: sourceId,
      });
    if (postWindow && !postWindow.closed)
      limitations.push({ code: "post_window_open", exerciseId: sourceId });
    else if (postWindow?.closeReason === "intervention_program_ended")
      limitations.push({
        code: "intervention_program_ended_before_window_filled",
        exerciseId: sourceId,
      });
    if (replacementId && !snapshot.replacement.actualRelationshipContext.length)
      limitations.push({
        code: "replacement_relation_missing",
        exerciseId: sourceId,
      });
  }

  const lastPost =
    [
      ...postIntervention,
      ...crossExercisePairs.flatMap((pair) =>
        pair.postIntervention ? [pair.postIntervention] : [],
      ),
    ]
      .flatMap((window) =>
        window.exposures.map((exposure) => exposure.startedAt),
      )
      .sort()
      .at(-1) ?? null;
  const bodyWeightContext = deriveBodyWeightContext(
    bodyWeights,
    activatedAt,
    lastPost,
  );
  const anyPost = coverage.some((item) => item.postExposureCount > 0);
  if (anyPost) {
    if (
      !bodyWeightContext.atActivation ||
      !bodyWeightContext.latestInPostWindow
    )
      limitations.push({ code: "body_weight_unavailable", exerciseId: null });
    else if (bodyWeightContext.absoluteDeltaKg !== 0)
      limitations.push({ code: "body_weight_changed", exerciseId: null });
  }
  const status: OutcomeStatus = !anyPost
    ? "awaiting_post_exposure"
    : coverage.length > 0 && coverage.every((item) => item.comparable)
      ? "evaluable"
      : "limited_data";

  const exposureEvidence = [
    ...baseline,
    ...postIntervention,
    ...crossExercisePairs.flatMap((pair) => [
      pair.baseline,
      ...(pair.postIntervention ? [pair.postIntervention] : []),
      ...(pair.replacementPriorHistory.window
        ? [pair.replacementPriorHistory.window]
        : []),
    ]),
  ].flatMap((window) =>
    window.exposures.map((exposure) => ({
      kind: "workout_session" as const,
      id: exposure.workoutSessionId,
      version: null,
    })),
  );
  return {
    ...base,
    status,
    baseline,
    postIntervention,
    comparisons,
    crossExercisePairs,
    dataCoverage: {
      exposureLimit: OUTCOME_EXPOSURE_WINDOW,
      exercises: coverage,
    },
    bodyWeightContext,
    limitations: sortLimitations(limitations),
    evidenceReferences: uniqueEvidence([
      decisionEvidence,
      ...programEvidence,
      ...exercises.map((exercise) => ({
        kind: "exercise" as const,
        id: exercise.exerciseId,
        version: null,
      })),
      ...crossExercisePairs.flatMap((pair) =>
        [pair.beforeExerciseId, pair.afterExerciseId]
          .filter((id): id is string => id !== null)
          .map((id) => ({ kind: "exercise" as const, id, version: null })),
      ),
      ...exposureEvidence,
      ...(comparisons.some(
        (item) => item.metric === "best_estimated_one_rep_max_kg",
      )
        ? [
            {
              kind: "derived_calculation" as const,
              id: "estimated_one_rep_max",
              version: EPLEY_FORMULA_VERSION,
            },
          ]
        : []),
      ...(bodyWeightContext.atActivation
        ? [
            {
              kind: "body_weight_entry" as const,
              id: bodyWeightContext.atActivation.entryId,
              version: null,
            },
          ]
        : []),
      ...(bodyWeightContext.latestInPostWindow
        ? [
            {
              kind: "body_weight_entry" as const,
              id: bodyWeightContext.latestInPostWindow.entryId,
              version: null,
            },
          ]
        : []),
    ]),
  };
}

/** Deterministic order: most recently proposed first, ties by decision ID. */
export function sortInterventionOutcomes(
  evaluations: readonly InterventionOutcomeEvaluation[],
): readonly InterventionOutcomeEvaluation[] {
  return [...evaluations].sort(
    (a, b) =>
      b.episode.proposedAt.localeCompare(a.episode.proposedAt) ||
      a.decisionId.localeCompare(b.decisionId),
  );
}

// ---------------------------------------------------------------------------
// Individual response evidence (accumulated, non-causal)

export type IndividualResponsePrescriptionChange = Readonly<{
  sourcePath: PrescriptionPath | null;
  before: PrescriptionDimensionValue | null;
  proposed: PrescriptionDimensionValue;
  /** Value actually activated; the factual intervention (ADR-0051). */
  implemented: PrescriptionDimensionValue | null;
  proposedValueImplemented: boolean | null;
}>;
export type IndividualResponseEpisode = Readonly<{
  decisionId: string;
  proposalSummary: string;
  proposedAt: string;
  activatedAt: string;
  sourceProgram: ProgramReference;
  interventionProgram: ProgramReference | null;
  outcomeStatus: OutcomeStatus;
  prescriptionChanges: readonly IndividualResponsePrescriptionChange[];
  concurrentActionCount: number;
  affectedDimensions: readonly InterventionDimension[];
  baselineExposureCount: number;
  postExposureCount: number;
  baselineFacts: ObservedFacts | null;
  postFacts: ObservedFacts | null;
  comparisons: readonly OutcomeComparison[];
  /** Replacement episodes only: side-by-side facts, never deltas. */
  crossExercisePair: CrossExerciseObservationPair | null;
  limitations: readonly OutcomeLimitation[];
  bodyWeightContext: BodyWeightContext;
}>;
export type IndividualResponseEvidence = Readonly<{
  schemaVersion: typeof INDIVIDUAL_RESPONSE_EVIDENCE_SCHEMA_VERSION;
  notice: typeof INDIVIDUAL_RESPONSE_NOTICE;
  exerciseId: string;
  exerciseName: string;
  interventionDimension: InterventionDimension;
  /** Only for `target`: reps, seconds and meters are never grouped together. */
  targetMetric: TargetMetric | null;
  /** Only for `exercise_replacement`: the ACTIVATED replacement (directed pair). */
  replacementExerciseId: string | null;
  replacementExerciseName: string | null;
  episodeCount: number;
  /** Episodes with at least one computable before/after comparison. */
  observationCount: number;
  episodes: readonly IndividualResponseEpisode[];
}>;

/**
 * A set_count snapshot whose activated count equals the source count is a
 * structural edit, not a set-count intervention (ADR-0063).
 */
export function isUnchangedSetCount(
  action: InterventionActionSnapshot,
): boolean {
  if (action.dimension !== "set_count" || action.sourceValue === null)
    return false;
  const after = action.implementedValue ?? action.proposedValue;
  return (
    after.dimension === "set_count" &&
    action.sourceValue.dimension === "set_count" &&
    after.count === action.sourceValue.count
  );
}

/** Activation kept the original exercise: not a replacement intervention. */
export function isUnchangedReplacement(
  action: InterventionActionSnapshot,
): boolean {
  if (
    action.dimension !== "exercise_replacement" ||
    action.sourceValue === null
  )
    return false;
  const after = action.implementedValue ?? action.proposedValue;
  return (
    after.dimension === "exercise_replacement" &&
    action.sourceValue.dimension === "exercise_replacement" &&
    after.exerciseId === action.sourceValue.exerciseId
  );
}

function actionReplacementTarget(
  action: InterventionActionSnapshot,
): Readonly<{ id: string; name: string | null }> | null {
  const value = action.implementedValue ?? action.proposedValue;
  return value.dimension === "exercise_replacement"
    ? { id: value.exerciseId, name: value.exerciseName }
    : null;
}

function actionTargetMetric(
  action: InterventionActionSnapshot,
): TargetMetric | null {
  const value = action.implementedValue ?? action.proposedValue;
  return value.dimension === "target" ? value.metric : null;
}

/**
 * Groups activated episodes by canonical exercise, changed dimension and,
 * for targets, target metric (v2). Never averages across episodes and never
 * produces a preference or score.
 */
export function buildIndividualResponseEvidence(
  evaluations: readonly InterventionOutcomeEvaluation[],
): readonly IndividualResponseEvidence[] {
  const groups = new Map<
    string,
    {
      exerciseId: string;
      exerciseName: string;
      dimension: InterventionDimension;
      targetMetric: TargetMetric | null;
      replacementExerciseId: string | null;
      replacementExerciseName: string | null;
      episodes: IndividualResponseEpisode[];
    }
  >();
  const activated = [...evaluations]
    .filter((item) => item.activatedAt !== null)
    .sort(
      (a, b) =>
        a.activatedAt!.localeCompare(b.activatedAt!) ||
        a.decisionId.localeCompare(b.decisionId),
    );
  for (const evaluation of activated) {
    const actions = evaluation.episode.actions.filter(
      (action) =>
        action.exerciseId !== null &&
        !isUnchangedSetCount(action) &&
        !isUnchangedReplacement(action),
    );
    const keys = new Set(
      actions.map(
        (action) =>
          `${action.exerciseId}|${action.dimension}|${actionTargetMetric(action) ?? ""}|${actionReplacementTarget(action)?.id ?? ""}`,
      ),
    );
    for (const key of [...keys].sort()) {
      const [exerciseId, dimension, metric, replacementId] = key.split("|") as [
        string,
        InterventionDimension,
        string,
        string,
      ];
      const targetMetric = (metric || null) as TargetMetric | null;
      const replacementExerciseId = replacementId || null;
      const matching = actions.filter(
        (action) =>
          action.exerciseId === exerciseId &&
          action.dimension === dimension &&
          actionTargetMetric(action) === targetMetric &&
          (actionReplacementTarget(action)?.id ?? null) ===
            replacementExerciseId,
      );
      const pair =
        dimension === "exercise_replacement"
          ? (evaluation.crossExercisePairs.find(
              (item) =>
                item.beforeExerciseId === exerciseId &&
                item.afterExerciseId === replacementExerciseId,
            ) ?? null)
          : null;
      const fidelity = evaluation.interventionFidelity.actions;
      const baselineWindow = evaluation.baseline.find(
        (window) => window.exerciseId === exerciseId,
      );
      const postWindow = evaluation.postIntervention.find(
        (window) => window.exerciseId === exerciseId,
      );
      const group = groups.get(key) ?? {
        exerciseId,
        exerciseName: matching[0]!.exerciseName ?? exerciseId,
        dimension,
        targetMetric,
        replacementExerciseId,
        replacementExerciseName:
          (matching[0] ? actionReplacementTarget(matching[0])?.name : null) ??
          null,
        episodes: [],
      };
      group.episodes.push({
        decisionId: evaluation.decisionId,
        proposalSummary: evaluation.episode.proposalSummary,
        proposedAt: evaluation.episode.proposedAt,
        activatedAt: evaluation.activatedAt!,
        sourceProgram: evaluation.sourceProgram,
        interventionProgram: evaluation.interventionProgram
          ? {
              id: evaluation.interventionProgram.id,
              revision: evaluation.interventionProgram.revision,
            }
          : null,
        outcomeStatus: evaluation.status,
        prescriptionChanges: matching.map((action) => ({
          sourcePath: action.sourcePath,
          before: action.sourceValue,
          proposed: action.proposedValue,
          implemented: action.implementedValue,
          proposedValueImplemented:
            fidelity.find((item) => item.actionIndex === action.actionIndex)
              ?.proposedValueImplemented ?? null,
        })),
        concurrentActionCount: evaluation.episode.concurrentActionCount,
        affectedDimensions: evaluation.episode.affectedDimensions,
        baselineExposureCount: pair
          ? pair.baseline.exposures.length
          : (baselineWindow?.exposures.length ?? 0),
        postExposureCount: pair
          ? (pair.postIntervention?.exposures.length ?? 0)
          : (postWindow?.exposures.length ?? 0),
        baselineFacts: pair
          ? pair.baseline.affectedPrescriptionSets
          : (baselineWindow?.affectedPrescriptionSets ?? null),
        postFacts: pair
          ? (pair.postIntervention?.affectedPrescriptionSets ?? null)
          : (postWindow?.affectedPrescriptionSets ?? null),
        comparisons:
          dimension === "exercise_replacement"
            ? []
            : evaluation.comparisons.filter(
                (comparison) => comparison.scope.exerciseId === exerciseId,
              ),
        crossExercisePair: pair,
        limitations: evaluation.limitations.filter(
          (item) => item.exerciseId === null || item.exerciseId === exerciseId,
        ),
        bodyWeightContext: evaluation.bodyWeightContext,
      });
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      schemaVersion: INDIVIDUAL_RESPONSE_EVIDENCE_SCHEMA_VERSION,
      notice: INDIVIDUAL_RESPONSE_NOTICE,
      exerciseId: group.exerciseId,
      exerciseName: group.exerciseName,
      interventionDimension: group.dimension,
      targetMetric: group.targetMetric,
      replacementExerciseId: group.replacementExerciseId,
      replacementExerciseName: group.replacementExerciseName,
      episodeCount: group.episodes.length,
      observationCount: group.episodes.filter(
        (episode) =>
          episode.comparisons.some(
            (comparison) => comparison.absoluteDelta !== null,
          ) ||
          (episode.crossExercisePair?.sideBySide.some(
            (fact) => fact.before !== null && fact.after !== null,
          ) ??
            false),
      ).length,
      episodes: group.episodes,
    }))
    .sort(
      (a, b) =>
        a.exerciseName.localeCompare(b.exerciseName) ||
        a.exerciseId.localeCompare(b.exerciseId) ||
        interventionDimensions.indexOf(a.interventionDimension) -
          interventionDimensions.indexOf(b.interventionDimension) ||
        (a.targetMetric ?? "").localeCompare(b.targetMetric ?? "") ||
        (a.replacementExerciseId ?? "").localeCompare(
          b.replacementExerciseId ?? "",
        ),
    );
}

// ---------------------------------------------------------------------------
// Bounded dossier section

export type InterventionHistoryChange = Readonly<{
  exerciseId: string | null;
  exerciseName: string | null;
  dimension: InterventionDimension;
  before: PrescriptionDimensionValue | null;
  proposed: PrescriptionDimensionValue;
  implemented: PrescriptionDimensionValue | null;
  proposedValueImplemented: boolean | null;
}>;
export type InterventionHistoryComparison = Omit<OutcomeComparison, "evidence">;
export type InterventionHistoryItem = Readonly<{
  decisionId: string;
  decisionStatus: CoachProposalStatus;
  proposalSummary: string;
  proposedAt: string;
  materializedAt: string | null;
  sourceProgram: ProgramReference;
  interventionProgram: InterventionProgramReference | null;
  activatedAt: string | null;
  outcomeStatus: OutcomeStatus;
  concurrentActionCount: number;
  affectedDimensions: readonly InterventionDimension[];
  changes: readonly InterventionHistoryChange[];
  exposureCounts: readonly ExerciseDataCoverage[];
  comparisons: readonly InterventionHistoryComparison[];
  crossExercisePairs: readonly CompactCrossExercisePair[];
  limitations: readonly OutcomeLimitation[];
  evidence: readonly EvidenceReference[];
}>;
/** Bounded summary of a replacement pair: no raw window facts, no deltas. */
export type CompactCrossExercisePair = Readonly<{
  beforeExerciseId: string;
  beforeExerciseName: string;
  afterExerciseId: string | null;
  afterExerciseName: string | null;
  proposedReplacementExerciseId: string;
  relationshipContext: readonly ReplacementRelationContext[];
  baselineExposureCount: number;
  postExposureCount: number;
  replacementPriorHistoryAvailable: boolean;
  sideBySide: readonly CrossExerciseSideBySideFact[];
  nonComparableMetrics: CrossExerciseObservationPair["nonComparableMetrics"];
}>;
export function compactCrossExercisePair(
  pair: CrossExerciseObservationPair,
): CompactCrossExercisePair {
  return {
    beforeExerciseId: pair.beforeExerciseId,
    beforeExerciseName: pair.beforeExerciseName,
    afterExerciseId: pair.afterExerciseId,
    afterExerciseName: pair.afterExerciseName,
    proposedReplacementExerciseId: pair.proposedReplacementExerciseId,
    relationshipContext: pair.relationshipContext,
    baselineExposureCount: pair.baseline.exposures.length,
    postExposureCount: pair.postIntervention?.exposures.length ?? 0,
    replacementPriorHistoryAvailable: pair.replacementPriorHistory.available,
    sideBySide: pair.sideBySide,
    nonComparableMetrics: pair.nonComparableMetrics,
  };
}
export type InterventionHistory = Readonly<{
  outcomeSchemaVersion: typeof INTERVENTION_OUTCOME_SCHEMA_VERSION;
  interpretationNotice: typeof OUTCOME_INTERPRETATION_NOTICE;
  totalAvailable: number;
  included: number;
  hasMore: boolean;
  items: readonly InterventionHistoryItem[];
}>;

export function buildInterventionHistory(
  evaluations: readonly InterventionOutcomeEvaluation[],
  limit = INTERVENTION_HISTORY_LIMIT,
): InterventionHistory {
  const sorted = sortInterventionOutcomes(evaluations);
  const items = sorted.slice(0, limit).map((evaluation) => {
    const fidelity = evaluation.interventionFidelity.actions;
    return {
      decisionId: evaluation.decisionId,
      decisionStatus: evaluation.episode.decisionStatus,
      proposalSummary: evaluation.episode.proposalSummary,
      proposedAt: evaluation.episode.proposedAt,
      materializedAt: evaluation.episode.materializedAt,
      sourceProgram: evaluation.sourceProgram,
      interventionProgram: evaluation.interventionProgram,
      activatedAt: evaluation.activatedAt,
      outcomeStatus: evaluation.status,
      concurrentActionCount: evaluation.episode.concurrentActionCount,
      affectedDimensions: evaluation.episode.affectedDimensions,
      changes: evaluation.episode.actions.map((action) => ({
        exerciseId: action.exerciseId,
        exerciseName: action.exerciseName,
        dimension: action.dimension,
        before: action.sourceValue,
        proposed: action.proposedValue,
        implemented: action.implementedValue,
        proposedValueImplemented:
          fidelity.find((item) => item.actionIndex === action.actionIndex)
            ?.proposedValueImplemented ?? null,
      })),
      exposureCounts: evaluation.dataCoverage.exercises,
      crossExercisePairs: evaluation.crossExercisePairs.map(
        compactCrossExercisePair,
      ),
      comparisons: evaluation.comparisons.map((comparison) => ({
        metric: comparison.metric,
        unit: comparison.unit,
        scope: comparison.scope,
        relevantDimensions: comparison.relevantDimensions,
        before: comparison.before,
        after: comparison.after,
        absoluteDelta: comparison.absoluteDelta,
        relativeDelta: comparison.relativeDelta,
        beforeSampleCount: comparison.beforeSampleCount,
        afterSampleCount: comparison.afterSampleCount,
      })),
      limitations: evaluation.limitations,
      evidence: evaluation.evidenceReferences,
    };
  });
  return {
    outcomeSchemaVersion: INTERVENTION_OUTCOME_SCHEMA_VERSION,
    interpretationNotice: OUTCOME_INTERPRETATION_NOTICE,
    totalAvailable: sorted.length,
    included: items.length,
    hasMore: sorted.length > items.length,
    items,
  };
}
