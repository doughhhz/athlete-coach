import type { AthleteSnapshot } from "../athlete/athlete.ts";
import {
  EPLEY_FORMULA_VERSION,
  deriveRestAttainment,
  deriveExercisePerformanceHistory,
  derivePersonalBests,
  deriveRirAttainment,
  deriveTargetAttainment,
  estimateOneRepMaxKg,
} from "../performance/performance.ts";
import type { TrainingProgram } from "../training/training.ts";
import type { WorkoutSession, WorkoutSet } from "../workout/workout.ts";

export const ATHLETE_TRAINING_DOSSIER_SCHEMA_VERSION =
  "athlete-training-dossier-v1" as const;
export const DOSSIER_RECENT_SESSION_LIMIT = 12;

export type TimeWindowKey =
  | "last_7_days"
  | "previous_7_days"
  | "last_28_days"
  | "previous_28_days"
  | "lifetime";
export type EvidenceReference = Readonly<{
  kind:
    | "workout_session"
    | "workout_set"
    | "training_program"
    | "exercise"
    | "body_weight_entry"
    | "derived_calculation";
  id: string;
  version: string | null;
}>;
export type NumericComparison = Readonly<{
  currentValue: number | null;
  previousValue: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  recentSampleCount: number;
  previousSampleCount: number;
}>;
export type WindowTrainingSummary = Readonly<{
  key: TimeWindowKey;
  localStartDate: string | null;
  localEndDateExclusive: string | null;
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  sessionCompletionRate: number | null;
  completedSets: number;
  skippedSets: number;
  pendingSetsInAbandonedSessions: number;
  totalReps: number;
  totalRecordedSeconds: number;
  totalRecordedMeters: number;
}>;
export type DataCoverage = Readonly<{
  completedSetsCount: number;
  loadRecordedCount: number;
  loadCoverageRate: number | null;
  rirEligibleCount: number;
  rirRecordedCount: number;
  rirCoverageRate: number | null;
  restEligibleCount: number;
  restMeasuredCount: number;
  restCoverageRate: number | null;
}>;
export type ExerciseExposure = Readonly<{
  exerciseId: string;
  exerciseName: string;
  sessionAppearances: number;
  completedSets: number;
  skippedSets: number;
  totalReps: number;
  recordedSeconds: number;
  recordedMeters: number;
  loadRecordedSets: number;
  rirRecordedSets: number;
  restMeasuredSets: number;
  bestLoggedLoadKg: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  targetEligibleSets: number;
  belowTargetSets: number;
  withinTargetSets: number;
  aboveTargetSets: number;
  withinTargetRate: number | null;
  rirEligibleSets: number;
  rirMeasuredSets: number;
  rirBelowPlannedSets: number;
  rirWithinPlannedSets: number;
  rirAbovePlannedSets: number;
  restEligibleSets: number;
  restMeasuredEligibleSets: number;
  restBelowPlannedSets: number;
  restWithinPlannedSets: number;
  restAbovePlannedSets: number;
  evidence: readonly EvidenceReference[];
}>;
export type ExerciseLongitudinalSignal = Readonly<{
  exerciseId: string;
  exerciseName: string;
  completedSets: NumericComparison;
  sessionAppearances: NumericComparison;
  bestLoggedLoadKg: NumericComparison;
  bestEstimatedOneRepMaxKg: NumericComparison;
}>;
export type AthleteTrainingDossier = Readonly<{
  schemaVersion: typeof ATHLETE_TRAINING_DOSSIER_SCHEMA_VERSION;
  generatedAt: string;
  athlete: Readonly<{
    athleteId: string;
    preferredName: string | null;
    timezone: string;
    currentGoal: AthleteSnapshot["activeGoal"];
    trainingContext: AthleteSnapshot["trainingContext"];
    availableWeekdays: readonly number[];
    latestBodyWeight: AthleteSnapshot["latestWeight"];
  }>;
  activeProgram: Readonly<{
    id: string;
    name: string;
    revision: number;
    supersedesProgramId: string | null;
    activatedAt: string | null;
  }> | null;
  windows: readonly WindowTrainingSummary[];
  last28DaysExerciseExposure: readonly ExerciseExposure[];
  exerciseSignals: readonly ExerciseLongitudinalSignal[];
  dataCoverageLast28Days: DataCoverage;
  personalBests: readonly Readonly<{
    exerciseId: string;
    exerciseName: string;
    maxLoggedLoadKg: number | null;
    bestEstimatedOneRepMaxKg: number | null;
    e1rmFormulaVersion: typeof EPLEY_FORMULA_VERSION;
    evidence: readonly EvidenceReference[];
  }>[];
  recentSessions: Readonly<{
    totalAvailable: number;
    included: number;
    hasMore: boolean;
    items: readonly Readonly<{
      id: string;
      status: WorkoutSession["status"];
      startedAt: string;
      programName: string;
      dayName: string;
      sourceTrainingDayId: string;
    }>[];
  }>;
  evidence: readonly EvidenceReference[];
}>;

type LocalDay = Readonly<{ year: number; month: number; day: number }>;
function localDay(instant: string, timezone: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}
function ordinal(value: LocalDay): number {
  return Math.floor(
    Date.UTC(value.year, value.month - 1, value.day) / 86400000,
  );
}
function dateFromOrdinal(value: number): string {
  return new Date(value * 86400000).toISOString().slice(0, 10);
}
function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
function sessionOrdinal(session: WorkoutSession, timezone: string): number {
  return ordinal(localDay(session.startedAt, timezone));
}
function windowSessions(
  sessions: readonly WorkoutSession[],
  timezone: string,
  start: number,
  endExclusive: number,
): readonly WorkoutSession[] {
  return sessions.filter((session) => {
    const day = sessionOrdinal(session, timezone);
    return day >= start && day < endExclusive;
  });
}
function sets(sessions: readonly WorkoutSession[]) {
  return sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({ session, exercise, set })),
    ),
  );
}
function summary(
  key: TimeWindowKey,
  sessions: readonly WorkoutSession[],
  start: number | null,
  end: number | null,
): WindowTrainingSummary {
  const all = sets(sessions),
    completed = all.filter(({ set }) => set.status === "completed");
  const completedSessions = sessions.filter(
    (item) => item.status === "completed",
  ).length;
  return {
    key,
    localStartDate: start === null ? null : dateFromOrdinal(start),
    localEndDateExclusive: end === null ? null : dateFromOrdinal(end),
    sessionsStarted: sessions.length,
    sessionsCompleted: completedSessions,
    sessionsAbandoned: sessions.filter((item) => item.status === "abandoned")
      .length,
    sessionCompletionRate: rate(completedSessions, sessions.length),
    completedSets: completed.length,
    skippedSets: all.filter(({ set }) => set.status === "skipped").length,
    pendingSetsInAbandonedSessions: all.filter(
      ({ set, session }) =>
        set.status === "pending" && session.status === "abandoned",
    ).length,
    totalReps: completed
      .filter(({ set }) => set.plannedMetric === "reps")
      .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
    totalRecordedSeconds: completed
      .filter(({ set }) => set.plannedMetric === "seconds")
      .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
    totalRecordedMeters: completed
      .filter(({ set }) => set.plannedMetric === "meters")
      .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
  };
}
function measuredRest(set: WorkoutSet): boolean {
  return (
    set.restStartedAt !== null &&
    set.restEndedAt !== null &&
    deriveRestAttainment(set) !== "not_measured"
  );
}
export function deriveDataCoverage(
  sessions: readonly WorkoutSession[],
): DataCoverage {
  const completed = sets(sessions)
    .filter(({ set }) => set.status === "completed")
    .map(({ set }) => set);
  const rirEligible = completed.filter((set) => set.plannedRirMin !== null);
  const restEligible = completed.filter(
    (set) => set.plannedRestMinSeconds !== null,
  );
  const load = completed.filter((set) => set.actualLoadKg !== null).length;
  const rir = rirEligible.filter((set) => set.actualRir !== null).length;
  const rest = restEligible.filter(measuredRest).length;
  return {
    completedSetsCount: completed.length,
    loadRecordedCount: load,
    loadCoverageRate: rate(load, completed.length),
    rirEligibleCount: rirEligible.length,
    rirRecordedCount: rir,
    rirCoverageRate: rate(rir, rirEligible.length),
    restEligibleCount: restEligible.length,
    restMeasuredCount: rest,
    restCoverageRate: rate(rest, restEligible.length),
  };
}
export function deriveExerciseExposure(
  sessions: readonly WorkoutSession[],
): readonly ExerciseExposure[] {
  const grouped = new Map<string, ReturnType<typeof sets>>();
  for (const item of sets(sessions))
    grouped.set(item.exercise.exerciseId, [
      ...(grouped.get(item.exercise.exerciseId) ?? []),
      item,
    ]);
  return [...grouped.entries()]
    .map(([exerciseId, items]) => {
      const completed = items.filter(({ set }) => set.status === "completed");
      const targets = completed.map(({ set }) => deriveTargetAttainment(set));
      const rir = completed.map(({ set }) => deriveRirAttainment(set));
      const rest = completed.map(({ set }) => deriveRestAttainment(set));
      const loads = completed
        .map(({ set }) => set.actualLoadKg)
        .filter((v): v is number => v !== null);
      const e1rms = completed
        .map(({ set }) =>
          estimateOneRepMaxKg({
            metric: set.plannedMetric,
            reps: set.actualValue,
            loadKg: set.actualLoadKg,
            status: set.status,
          }),
        )
        .filter((v): v is number => v !== null);
      const sessionIds = new Set(completed.map(({ session }) => session.id));
      return {
        exerciseId,
        exerciseName: items[0]!.exercise.exerciseName,
        sessionAppearances: sessionIds.size,
        completedSets: completed.length,
        skippedSets: items.filter(({ set }) => set.status === "skipped").length,
        totalReps: completed
          .filter(({ set }) => set.plannedMetric === "reps")
          .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
        recordedSeconds: completed
          .filter(({ set }) => set.plannedMetric === "seconds")
          .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
        recordedMeters: completed
          .filter(({ set }) => set.plannedMetric === "meters")
          .reduce((sum, { set }) => sum + (set.actualValue ?? 0), 0),
        loadRecordedSets: loads.length,
        rirRecordedSets: completed.filter(({ set }) => set.actualRir !== null)
          .length,
        restMeasuredSets: completed.filter(({ set }) => measuredRest(set))
          .length,
        bestLoggedLoadKg: loads.length ? Math.max(...loads) : null,
        bestEstimatedOneRepMaxKg: e1rms.length ? Math.max(...e1rms) : null,
        targetEligibleSets: targets.length,
        belowTargetSets: targets.filter((v) => v === "below_range").length,
        withinTargetSets: targets.filter((v) => v === "within_range").length,
        aboveTargetSets: targets.filter((v) => v === "above_range").length,
        withinTargetRate: rate(
          targets.filter((v) => v === "within_range").length,
          targets.length,
        ),
        rirEligibleSets: rir.filter((value) => value !== "not_planned").length,
        rirMeasuredSets: rir.filter(
          (value) => value !== "not_planned" && value !== "not_measured",
        ).length,
        rirBelowPlannedSets: rir.filter((value) => value === "below_range")
          .length,
        rirWithinPlannedSets: rir.filter((value) => value === "within_range")
          .length,
        rirAbovePlannedSets: rir.filter((value) => value === "above_range")
          .length,
        restEligibleSets: rest.filter((value) => value !== "not_planned")
          .length,
        restMeasuredEligibleSets: rest.filter(
          (value) => value !== "not_planned" && value !== "not_measured",
        ).length,
        restBelowPlannedSets: rest.filter((value) => value === "below_range")
          .length,
        restWithinPlannedSets: rest.filter((value) => value === "within_range")
          .length,
        restAbovePlannedSets: rest.filter((value) => value === "above_range")
          .length,
        evidence: [...sessionIds]
          .sort()
          .slice(0, 3)
          .map((id) => ({
            kind: "workout_session" as const,
            id,
            version: null,
          })),
      };
    })
    .sort(
      (a, b) =>
        a.exerciseName.localeCompare(b.exerciseName) ||
        a.exerciseId.localeCompare(b.exerciseId),
    );
}
export function compareNumeric(
  currentValue: number | null,
  previousValue: number | null,
  recentSampleCount: number,
  previousSampleCount: number,
): NumericComparison {
  const absoluteDelta =
    currentValue === null || previousValue === null
      ? null
      : currentValue - previousValue;
  const relativeDelta =
    currentValue === null || previousValue === null || previousValue === 0
      ? null
      : (currentValue - previousValue) / Math.abs(previousValue);
  return {
    currentValue,
    previousValue,
    absoluteDelta,
    relativeDelta,
    recentSampleCount,
    previousSampleCount,
  };
}
function comparisons(
  recent: readonly ExerciseExposure[],
  previous: readonly ExerciseExposure[],
): readonly ExerciseLongitudinalSignal[] {
  const ids = new Set([...recent, ...previous].map((item) => item.exerciseId));
  return [...ids]
    .map((id) => {
      const a = recent.find((item) => item.exerciseId === id),
        b = previous.find((item) => item.exerciseId === id);
      const name = a?.exerciseName ?? b!.exerciseName;
      return {
        exerciseId: id,
        exerciseName: name,
        completedSets: compareNumeric(
          a?.completedSets ?? 0,
          b?.completedSets ?? 0,
          a?.completedSets ?? 0,
          b?.completedSets ?? 0,
        ),
        sessionAppearances: compareNumeric(
          a?.sessionAppearances ?? 0,
          b?.sessionAppearances ?? 0,
          a?.sessionAppearances ?? 0,
          b?.sessionAppearances ?? 0,
        ),
        bestLoggedLoadKg: compareNumeric(
          a?.bestLoggedLoadKg ?? null,
          b?.bestLoggedLoadKg ?? null,
          a?.loadRecordedSets ?? 0,
          b?.loadRecordedSets ?? 0,
        ),
        bestEstimatedOneRepMaxKg: compareNumeric(
          a?.bestEstimatedOneRepMaxKg ?? null,
          b?.bestEstimatedOneRepMaxKg ?? null,
          a?.completedSets ?? 0,
          b?.completedSets ?? 0,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.exerciseName.localeCompare(b.exerciseName) ||
        a.exerciseId.localeCompare(b.exerciseId),
    );
}
export function buildAthleteTrainingDossier(
  input: Readonly<{
    snapshot: AthleteSnapshot;
    activeProgram: TrainingProgram | null;
    sessions: readonly WorkoutSession[];
    generatedAt: string;
  }>,
): AthleteTrainingDossier {
  const timezone = input.snapshot.profile?.timezone ?? "UTC";
  const today = ordinal(localDay(input.generatedAt, timezone));
  const end = today + 1,
    last7Start = end - 7,
    previous7Start = last7Start - 7,
    last28Start = end - 28,
    previous28Start = last28Start - 28;
  const stableSessions = [...input.sessions].sort(
    (a, b) =>
      a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
  const last7 = windowSessions(stableSessions, timezone, last7Start, end),
    previous7 = windowSessions(
      stableSessions,
      timezone,
      previous7Start,
      last7Start,
    ),
    last28 = windowSessions(stableSessions, timezone, last28Start, end),
    previous28 = windowSessions(
      stableSessions,
      timezone,
      previous28Start,
      last28Start,
    );
  const recentExposure = deriveExerciseExposure(last28),
    previousExposure = deriveExerciseExposure(previous28);
  const performancePoints = deriveExercisePerformanceHistory(stableSessions);
  const personalBests = derivePersonalBests(performancePoints).map((best) => ({
    ...best,
    evidence: performancePoints
      .filter(
        (point) =>
          point.exerciseId === best.exerciseId &&
          (point.loggedLoadKg === best.maxLoggedLoadKg ||
            point.estimatedOneRepMaxKg === best.bestEstimatedOneRepMaxKg),
      )
      .slice(-2)
      .map((point) => ({
        kind: "workout_set" as const,
        id: point.workoutSetId,
        version: point.e1rmFormulaVersion,
      })),
  }));
  const recentDescending = [...stableSessions].sort(
    (a, b) =>
      b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
  );
  const items = recentDescending
    .slice(0, DOSSIER_RECENT_SESSION_LIMIT)
    .map((session) => ({
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      programName: session.programName,
      dayName: session.dayName,
      sourceTrainingDayId: session.sourceTrainingDayId,
    }));
  const evidence: EvidenceReference[] = [];
  if (input.activeProgram)
    evidence.push({
      kind: "training_program",
      id: input.activeProgram.id,
      version: String(input.activeProgram.revision),
    });
  if (input.snapshot.latestWeight)
    evidence.push({
      kind: "body_weight_entry",
      id: input.snapshot.latestWeight.id,
      version: null,
    });
  evidence.push({
    kind: "derived_calculation",
    id: "estimated_one_rep_max",
    version: EPLEY_FORMULA_VERSION,
  });
  return {
    schemaVersion: ATHLETE_TRAINING_DOSSIER_SCHEMA_VERSION,
    generatedAt: new Date(input.generatedAt).toISOString(),
    athlete: {
      athleteId: input.snapshot.athlete.id,
      preferredName: input.snapshot.profile?.preferredName ?? null,
      timezone,
      currentGoal: input.snapshot.activeGoal,
      trainingContext: input.snapshot.trainingContext,
      availableWeekdays: [...input.snapshot.availableWeekdays].sort(
        (a, b) => a - b,
      ),
      latestBodyWeight: input.snapshot.latestWeight,
    },
    activeProgram: input.activeProgram
      ? {
          id: input.activeProgram.id,
          name: input.activeProgram.name,
          revision: input.activeProgram.revision,
          supersedesProgramId: input.activeProgram.supersedesProgramId,
          activatedAt: input.activeProgram.activatedAt,
        }
      : null,
    windows: [
      summary("last_7_days", last7, last7Start, end),
      summary("previous_7_days", previous7, previous7Start, last7Start),
      summary("last_28_days", last28, last28Start, end),
      summary("previous_28_days", previous28, previous28Start, last28Start),
      summary("lifetime", stableSessions, null, null),
    ],
    last28DaysExerciseExposure: recentExposure,
    exerciseSignals: comparisons(recentExposure, previousExposure),
    dataCoverageLast28Days: deriveDataCoverage(last28),
    personalBests,
    recentSessions: {
      totalAvailable: stableSessions.length,
      included: items.length,
      hasMore: stableSessions.length > items.length,
      items,
    },
    evidence,
  };
}
