import type { EvidenceReference } from "../dossier/dossier.ts";
import {
  INDIVIDUAL_RESPONSE_NOTICE,
  OUTCOME_INTERPRETATION_NOTICE,
  buildIndividualResponseEvidence,
  outcomeMetricDimensions,
  type BodyWeightContext,
  type IndividualResponseEpisode,
  type IndividualResponseEvidence,
  type InterventionActionSnapshot,
  type InterventionDimension,
  type InterventionOutcomeEvaluation,
  type OutcomeComparison,
  type OutcomeLimitationCode,
  type OutcomeMetric,
  type OutcomeScopeKind,
  type OutcomeStatus,
  type PrescriptionDimensionValue,
  type ProgramReference,
} from "../outcomes/outcomes.ts";
import type { TargetMetric } from "../training/training.ts";

export const INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION =
  "individual-response-memory-v1" as const;
export const RESPONSE_MEMORY_NOTICE =
  "Response Memory remembers observations, not truths." as const;
export const RESPONSE_MEMORY_POLICY_NOTICE =
  "Repeated observational evidence may inform future reasoning, but it must not become an automatic training rule." as const;
/** Groups included in bounded contexts (dossier); aggregates never truncate. */
export const RESPONSE_MEMORY_GROUP_LIMIT = 10;
/** Episode details per group in bounded contexts. */
export const RESPONSE_MEMORY_EPISODE_DETAIL_LIMIT = 5;

// ---------------------------------------------------------------------------
// Activated-intervention signature

/**
 * Purely structural direction of an activated value change. Ranges move in a
 * direction only when both bounds move the same way (or one stays). Widening
 * or narrowing is `mixed`. No magnitude buckets exist.
 */
export const changeDirections = [
  "increase",
  "decrease",
  "unchanged",
  "mixed",
  "not_comparable",
] as const;
export type ChangeDirection = (typeof changeDirections)[number];

export type ActivatedPrescriptionChange = Readonly<{
  setSequence: number | null;
  before: PrescriptionDimensionValue | null;
  after: PrescriptionDimensionValue | null;
  direction: ChangeDirection;
}>;
export type NormalizedInterventionSignature = Readonly<{
  dimension: InterventionDimension;
  targetMetric: TargetMetric | null;
  changes: readonly ActivatedPrescriptionChange[];
  /** Same direction across every change, otherwise `mixed`/`not_comparable`. */
  direction: ChangeDirection;
  activatedChangeIdentifiable: boolean;
}>;

function numericDirection(before: number, after: number): ChangeDirection {
  if (after > before) return "increase";
  if (after < before) return "decrease";
  return "unchanged";
}
function rangeDirection(
  beforeMin: number | null,
  beforeMax: number | null,
  afterMin: number | null,
  afterMax: number | null,
): ChangeDirection {
  if (
    beforeMin === null ||
    beforeMax === null ||
    afterMin === null ||
    afterMax === null
  )
    return "not_comparable";
  const bounds = [
    numericDirection(beforeMin, afterMin),
    numericDirection(beforeMax, afterMax),
  ].filter((value) => value !== "unchanged");
  if (!bounds.length) return "unchanged";
  return bounds.every((value) => value === bounds[0]) ? bounds[0]! : "mixed";
}

export function deriveChangeDirection(
  before: PrescriptionDimensionValue | null,
  after: PrescriptionDimensionValue | null,
): ChangeDirection {
  if (!before || !after || before.dimension !== after.dimension)
    return "not_comparable";
  if (before.dimension === "target" && after.dimension === "target")
    return before.metric !== after.metric
      ? "not_comparable"
      : rangeDirection(before.min, before.max, after.min, after.max);
  if (before.dimension === "planned_rir" && after.dimension === "planned_rir")
    return rangeDirection(before.min, before.max, after.min, after.max);
  if (before.dimension === "planned_rest" && after.dimension === "planned_rest")
    return rangeDirection(
      before.minSeconds,
      before.maxSeconds,
      after.minSeconds,
      after.maxSeconds,
    );
  if (
    before.dimension === "absolute_load" &&
    after.dimension === "absolute_load"
  )
    return before.loadKg === null || after.loadKg === null
      ? "not_comparable"
      : numericDirection(before.loadKg, after.loadKg);
  return "not_comparable";
}

function combineDirections(
  directions: readonly ChangeDirection[],
): ChangeDirection {
  if (!directions.length || directions.includes("not_comparable"))
    return "not_comparable";
  const moving = directions.filter((value) => value !== "unchanged");
  if (!moving.length) return "unchanged";
  return moving.every((value) => value === moving[0]) ? moving[0]! : "mixed";
}

export function buildInterventionSignature(
  episode: IndividualResponseEpisode,
  dimension: InterventionDimension,
  targetMetric: TargetMetric | null,
): NormalizedInterventionSignature {
  const changes = episode.prescriptionChanges.map((change) => ({
    setSequence: change.sourcePath?.setSequence ?? null,
    before: change.before,
    after: change.implemented,
    direction: deriveChangeDirection(change.before, change.implemented),
  }));
  return {
    dimension,
    targetMetric,
    changes,
    direction: combineDirections(changes.map((change) => change.direction)),
    activatedChangeIdentifiable:
      changes.length > 0 && changes.every((change) => change.after !== null),
  };
}

// ---------------------------------------------------------------------------
// Comparability

/**
 * Structural confounders reused from Phase 11: another variable changed
 * together with the intervention, so the episode is kept as context only.
 */
export const structuralConfounderCodes = [
  "multiple_variables_changed_concurrently",
  "multiple_exercises_changed_concurrently",
  "unproposed_changes_in_affected_prescription",
  "program_revision_changed_other_prescriptions",
  "exercise_identity_changed",
  "proposed_action_not_present_at_activation",
] as const satisfies readonly OutcomeLimitationCode[];

const missingObservationCode: Readonly<
  Partial<Record<InterventionDimension, OutcomeLimitationCode>>
> = {
  planned_rir: "rir_observations_missing",
  planned_rest: "rest_observations_missing",
  absolute_load: "load_observations_missing",
};

export type ComparabilityReason =
  | OutcomeLimitationCode
  | "activated_change_not_identifiable"
  | "no_relevant_comparison";
export type EpisodeComparability = Readonly<{
  /**
   * `strict_comparable` = comparable under structural rules only. It is not
   * a controlled experiment and never implies causation.
   */
  classification: "strict_comparable" | "context_only";
  reasons: readonly ComparabilityReason[];
}>;

// ---------------------------------------------------------------------------
// Metrics per group

export type ResponseMetricKey = Readonly<{
  metric: OutcomeMetric;
  scope: OutcomeScopeKind;
}>;
/**
 * Changed sets: metrics Phase 11 marks relevant to the dimension. Whole
 * exercise: performance context shared by every dimension.
 */
export function responseMetricsFor(
  dimension: InterventionDimension,
): readonly ResponseMetricKey[] {
  const changed = (Object.keys(outcomeMetricDimensions) as OutcomeMetric[])
    .filter((metric) => outcomeMetricDimensions[metric].includes(dimension))
    .map((metric) => ({
      metric,
      scope: "affected_prescription_sets" as const,
    }));
  const exercise: readonly OutcomeMetric[] = [
    "completed_sets_per_exposure",
    "best_logged_load_kg",
    "best_estimated_one_rep_max_kg",
  ];
  return [
    ...changed,
    ...exercise.map((metric) => ({ metric, scope: "exercise" as const })),
  ];
}

export type ResponseMetricObservation = Readonly<{
  metric: OutcomeMetric;
  scope: OutcomeScopeKind;
  unit: OutcomeComparison["unit"];
  before: number | null;
  after: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  beforeSampleCount: number;
  afterSampleCount: number;
}>;

/**
 * Sign pattern of absolute deltas across strict-comparable episodes. "positive"
 * is arithmetic (after − before > 0), never "better".
 */
export type DeltaSignPattern =
  | "no_observations"
  | "single_observation"
  | "all_positive"
  | "all_negative"
  | "all_zero"
  | "zero_and_one_sign"
  | "opposite_signs";
export type ResponseMetricAggregate = Readonly<{
  metric: OutcomeMetric;
  scope: OutcomeScopeKind;
  unit: OutcomeComparison["unit"] | null;
  strictComparableEpisodeCount: number;
  observedDeltaCount: number;
  positiveDeltaCount: number;
  zeroDeltaCount: number;
  negativeDeltaCount: number;
  missingDeltaCount: number;
  minAbsoluteDelta: number | null;
  maxAbsoluteDelta: number | null;
  medianAbsoluteDelta: number | null;
  signPattern: DeltaSignPattern;
  /** Positive and negative deltas coexist; the observations disagree. */
  contradictory: boolean;
  beforeSampleCountTotal: number;
  afterSampleCountTotal: number;
}>;

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function signPattern(
  positive: number,
  zero: number,
  negative: number,
): DeltaSignPattern {
  const total = positive + zero + negative;
  if (total === 0) return "no_observations";
  if (total === 1) return "single_observation";
  if (positive > 0 && negative > 0) return "opposite_signs";
  if (positive === total) return "all_positive";
  if (negative === total) return "all_negative";
  if (zero === total) return "all_zero";
  return "zero_and_one_sign";
}

// ---------------------------------------------------------------------------
// Contract

export type ResponseMemoryEpisode = Readonly<{
  decisionId: string;
  proposalSummary: string;
  proposedAt: string;
  activatedAt: string;
  sourceProgram: ProgramReference;
  interventionProgram: ProgramReference | null;
  outcomeStatus: OutcomeStatus;
  signature: NormalizedInterventionSignature;
  comparability: EpisodeComparability;
  concurrentActionCount: number;
  affectedDimensions: readonly InterventionDimension[];
  baselineExposureCount: number;
  postExposureCount: number;
  observations: readonly ResponseMetricObservation[];
  limitationCodes: readonly OutcomeLimitationCode[];
  bodyWeightContext: BodyWeightContext;
  evidence: readonly EvidenceReference[];
}>;

export type ResponseMemoryCoverage = Readonly<{
  totalEpisodes: number;
  evaluableEpisodes: number;
  strictComparableEpisodes: number;
  contextOnlyEpisodes: number;
  episodesWithRirObservations: number;
  episodesWithRestObservations: number;
  episodesWithLoadObservations: number;
}>;

export type ComparableInterventionGroup = Readonly<{
  /** Stable structured key: `exerciseId.dimension[.metric]`. */
  key: string;
  exerciseId: string;
  exerciseName: string;
  interventionDimension: InterventionDimension;
  targetMetric: TargetMetric | null;
  firstActivatedAt: string;
  latestActivatedAt: string;
  coverage: ResponseMemoryCoverage;
  /** Technical: ≥ 2 strict-comparable episodes. Not "strong evidence". */
  hasMultipleComparableEpisodes: boolean;
  directionsObserved: readonly ChangeDirection[];
  aggregates: readonly ResponseMetricAggregate[];
  limitationCounts: readonly Readonly<{
    code: OutcomeLimitationCode;
    episodeCount: number;
  }>[];
  episodes: Readonly<{
    totalAvailable: number;
    included: number;
    hasMore: boolean;
    items: readonly ResponseMemoryEpisode[];
  }>;
  evidence: readonly EvidenceReference[];
}>;

export type IndividualResponseMemory = Readonly<{
  schemaVersion: typeof INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION;
  notices: readonly string[];
  generatedAt: string;
  athleteId: string | null;
  summary: Readonly<{
    totalGroups: number;
    totalEpisodes: number;
    strictComparableEpisodes: number;
    contextOnlyEpisodes: number;
    groupsWithContradictoryObservations: number;
  }>;
  groups: Readonly<{
    totalAvailable: number;
    included: number;
    hasMore: boolean;
    items: readonly ComparableInterventionGroup[];
  }>;
  totalEpisodes: number;
  includedEpisodeDetails: number;
  omittedEpisodeDetails: number;
  truncation: Readonly<{
    groupLimit: number | null;
    episodeDetailLimit: number | null;
  }>;
}>;

export function responseMemoryGroupKey(
  exerciseId: string,
  dimension: InterventionDimension,
  targetMetric: TargetMetric | null,
): string {
  return targetMetric
    ? `${exerciseId}.${dimension}.${targetMetric}`
    : `${exerciseId}.${dimension}`;
}

/** Group key for an activated action (uses the activated target metric). */
export function responseMemoryGroupKeyForAction(
  action: InterventionActionSnapshot,
): string | null {
  if (!action.exerciseId) return null;
  const value = action.implementedValue ?? action.proposedValue;
  return responseMemoryGroupKey(
    action.exerciseId,
    action.dimension,
    value.dimension === "target" ? value.metric : null,
  );
}

function classify(
  episode: IndividualResponseEpisode,
  signature: NormalizedInterventionSignature,
  observations: readonly ResponseMetricObservation[],
  dimension: InterventionDimension,
): EpisodeComparability {
  const codes = new Set(episode.limitations.map((item) => item.code));
  const reasons: ComparabilityReason[] = [];
  if (!signature.activatedChangeIdentifiable)
    reasons.push("activated_change_not_identifiable");
  if (episode.baselineExposureCount === 0)
    reasons.push("no_baseline_exposures");
  if (episode.postExposureCount === 0) reasons.push("no_post_exposures");
  for (const code of structuralConfounderCodes)
    if (codes.has(code)) reasons.push(code);
  const missing = missingObservationCode[dimension];
  if (missing && codes.has(missing)) reasons.push(missing);
  const relevant = new Set(
    responseMetricsFor(dimension)
      .filter((item) => item.scope === "affected_prescription_sets")
      .map((item) => item.metric),
  );
  if (
    !observations.some(
      (item) =>
        item.scope === "affected_prescription_sets" &&
        relevant.has(item.metric) &&
        item.absoluteDelta !== null,
    )
  )
    reasons.push("no_relevant_comparison");
  return {
    classification: reasons.length ? "context_only" : "strict_comparable",
    reasons,
  };
}

function toEpisode(
  episode: IndividualResponseEpisode,
  evidence: IndividualResponseEvidence,
): ResponseMemoryEpisode {
  const signature = buildInterventionSignature(
    episode,
    evidence.interventionDimension,
    evidence.targetMetric,
  );
  const wanted = responseMetricsFor(evidence.interventionDimension);
  const observations = wanted.flatMap(({ metric, scope }) => {
    const comparison = episode.comparisons.find(
      (item) => item.metric === metric && item.scope.kind === scope,
    );
    return comparison
      ? [
          {
            metric,
            scope,
            unit: comparison.unit,
            before: comparison.before,
            after: comparison.after,
            absoluteDelta: comparison.absoluteDelta,
            relativeDelta: comparison.relativeDelta,
            beforeSampleCount: comparison.beforeSampleCount,
            afterSampleCount: comparison.afterSampleCount,
          },
        ]
      : [];
  });
  return {
    decisionId: episode.decisionId,
    proposalSummary: episode.proposalSummary,
    proposedAt: episode.proposedAt,
    activatedAt: episode.activatedAt,
    sourceProgram: episode.sourceProgram,
    interventionProgram: episode.interventionProgram,
    outcomeStatus: episode.outcomeStatus,
    signature,
    comparability: classify(
      episode,
      signature,
      observations,
      evidence.interventionDimension,
    ),
    concurrentActionCount: episode.concurrentActionCount,
    affectedDimensions: episode.affectedDimensions,
    baselineExposureCount: episode.baselineExposureCount,
    postExposureCount: episode.postExposureCount,
    observations,
    limitationCodes: [...new Set(episode.limitations.map((item) => item.code))],
    bodyWeightContext: episode.bodyWeightContext,
    evidence: [
      { kind: "coach_decision", id: episode.decisionId, version: null },
      ...(episode.interventionProgram
        ? [
            {
              kind: "training_program" as const,
              id: episode.interventionProgram.id,
              version: String(episode.interventionProgram.revision),
            },
          ]
        : []),
    ],
  };
}

function aggregate(
  episodes: readonly ResponseMemoryEpisode[],
  key: ResponseMetricKey,
): ResponseMetricAggregate {
  const strict = episodes.filter(
    (episode) => episode.comparability.classification === "strict_comparable",
  );
  const observations = strict.map(
    (episode) =>
      episode.observations.find(
        (item) => item.metric === key.metric && item.scope === key.scope,
      ) ?? null,
  );
  const deltas = observations
    .map((item) => item?.absoluteDelta ?? null)
    .filter((value): value is number => value !== null);
  const positive = deltas.filter((value) => value > 0).length;
  const zero = deltas.filter((value) => value === 0).length;
  const negative = deltas.filter((value) => value < 0).length;
  return {
    metric: key.metric,
    scope: key.scope,
    unit: observations.find((item) => item !== null)?.unit ?? null,
    strictComparableEpisodeCount: strict.length,
    observedDeltaCount: deltas.length,
    positiveDeltaCount: positive,
    zeroDeltaCount: zero,
    negativeDeltaCount: negative,
    missingDeltaCount: strict.length - deltas.length,
    minAbsoluteDelta: deltas.length ? Math.min(...deltas) : null,
    maxAbsoluteDelta: deltas.length ? Math.max(...deltas) : null,
    medianAbsoluteDelta: median(deltas),
    signPattern: signPattern(positive, zero, negative),
    contradictory: positive > 0 && negative > 0,
    beforeSampleCountTotal: observations.reduce(
      (sum, item) => sum + (item?.beforeSampleCount ?? 0),
      0,
    ),
    afterSampleCountTotal: observations.reduce(
      (sum, item) => sum + (item?.afterSampleCount ?? 0),
      0,
    ),
  };
}

function hasObservations(
  facts: IndividualResponseEpisode["baselineFacts"],
  pick: (
    value: NonNullable<IndividualResponseEpisode["baselineFacts"]>,
  ) => number,
): boolean {
  return facts !== null && pick(facts) > 0;
}

function toGroup(
  evidence: IndividualResponseEvidence,
  episodeDetailLimit: number | null,
): ComparableInterventionGroup {
  const pairs = evidence.episodes.map((episode) => ({
    source: episode,
    memory: toEpisode(episode, evidence),
  }));
  const episodes = pairs
    .map((pair) => pair.memory)
    .sort(
      (a, b) =>
        b.activatedAt.localeCompare(a.activatedAt) ||
        a.decisionId.localeCompare(b.decisionId),
    );
  const strict = episodes.filter(
    (episode) => episode.comparability.classification === "strict_comparable",
  ).length;
  const both = (
    pick: (
      value: NonNullable<IndividualResponseEpisode["baselineFacts"]>,
    ) => number,
  ) =>
    pairs.filter(
      ({ source }) =>
        hasObservations(source.baselineFacts, pick) &&
        hasObservations(source.postFacts, pick),
    ).length;
  const limitationCounts = new Map<OutcomeLimitationCode, number>();
  for (const episode of episodes)
    for (const code of episode.limitationCodes)
      limitationCounts.set(code, (limitationCounts.get(code) ?? 0) + 1);
  const items =
    episodeDetailLimit === null
      ? episodes
      : episodes.slice(0, episodeDetailLimit);
  const key = responseMemoryGroupKey(
    evidence.exerciseId,
    evidence.interventionDimension,
    evidence.targetMetric,
  );
  const activations = episodes.map((episode) => episode.activatedAt).sort();
  return {
    key,
    exerciseId: evidence.exerciseId,
    exerciseName: evidence.exerciseName,
    interventionDimension: evidence.interventionDimension,
    targetMetric: evidence.targetMetric,
    firstActivatedAt: activations[0]!,
    latestActivatedAt: activations.at(-1)!,
    coverage: {
      totalEpisodes: episodes.length,
      evaluableEpisodes: episodes.filter(
        (episode) => episode.outcomeStatus === "evaluable",
      ).length,
      strictComparableEpisodes: strict,
      contextOnlyEpisodes: episodes.length - strict,
      episodesWithRirObservations: both((facts) => facts.rir.measuredSetCount),
      episodesWithRestObservations: both(
        (facts) => facts.rest.measuredSetCount,
      ),
      episodesWithLoadObservations: both((facts) => facts.loadRecordedSetCount),
    },
    hasMultipleComparableEpisodes: strict >= 2,
    directionsObserved: [
      ...new Set(episodes.map((episode) => episode.signature.direction)),
    ].sort(),
    aggregates: responseMetricsFor(evidence.interventionDimension).map(
      (metricKey) => aggregate(episodes, metricKey),
    ),
    limitationCounts: [...limitationCounts.entries()]
      .map(([code, episodeCount]) => ({ code, episodeCount }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    episodes: {
      totalAvailable: episodes.length,
      included: items.length,
      hasMore: episodes.length > items.length,
      items,
    },
    evidence: [
      {
        kind: "response_memory_group",
        id: key,
        version: INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION,
      },
      ...items.flatMap((episode) => episode.evidence),
    ],
  };
}

export type BuildIndividualResponseMemoryOptions = Readonly<{
  athleteId: string | null;
  generatedAt: string;
  /** `null` disables truncation (detail views); defaults are bounded. */
  groupLimit?: number | null;
  episodeDetailLimit?: number | null;
}>;

/**
 * Deterministic, non-causal projection over Phase 11 outcomes. Groups are
 * ordered by latest activation desc, then key; episodes by activation desc,
 * then decision ID. No weights, decay, scores or optimal values.
 */
export function buildIndividualResponseMemory(
  evaluations: readonly InterventionOutcomeEvaluation[],
  options: BuildIndividualResponseMemoryOptions,
): IndividualResponseMemory {
  const groupLimit =
    options.groupLimit === undefined
      ? RESPONSE_MEMORY_GROUP_LIMIT
      : options.groupLimit;
  const episodeDetailLimit =
    options.episodeDetailLimit === undefined
      ? RESPONSE_MEMORY_EPISODE_DETAIL_LIMIT
      : options.episodeDetailLimit;
  const all = buildIndividualResponseEvidence(evaluations)
    .map((evidence) => toGroup(evidence, episodeDetailLimit))
    .sort(
      (a, b) =>
        b.latestActivatedAt.localeCompare(a.latestActivatedAt) ||
        a.key.localeCompare(b.key),
    );
  const items = groupLimit === null ? all : all.slice(0, groupLimit);
  const totalEpisodes = all.reduce(
    (sum, group) => sum + group.coverage.totalEpisodes,
    0,
  );
  const includedEpisodeDetails = items.reduce(
    (sum, group) => sum + group.episodes.included,
    0,
  );
  const strict = all.reduce(
    (sum, group) => sum + group.coverage.strictComparableEpisodes,
    0,
  );
  return {
    schemaVersion: INDIVIDUAL_RESPONSE_MEMORY_SCHEMA_VERSION,
    notices: [
      RESPONSE_MEMORY_NOTICE,
      RESPONSE_MEMORY_POLICY_NOTICE,
      OUTCOME_INTERPRETATION_NOTICE,
      INDIVIDUAL_RESPONSE_NOTICE,
    ],
    generatedAt: new Date(options.generatedAt).toISOString(),
    athleteId: options.athleteId,
    summary: {
      totalGroups: all.length,
      totalEpisodes,
      strictComparableEpisodes: strict,
      contextOnlyEpisodes: totalEpisodes - strict,
      groupsWithContradictoryObservations: all.filter((group) =>
        group.aggregates.some((item) => item.contradictory),
      ).length,
    },
    groups: {
      totalAvailable: all.length,
      included: items.length,
      hasMore: all.length > items.length,
      items,
    },
    totalEpisodes,
    includedEpisodeDetails,
    omittedEpisodeDetails: totalEpisodes - includedEpisodeDetails,
    truncation: { groupLimit, episodeDetailLimit },
  };
}
