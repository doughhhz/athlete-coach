import {
  classifyRange,
  estimateOneRepMaxKg,
  type RangeAttainment,
} from "../performance/performance.ts";
import {
  suggestedLoadDecrease,
  suggestedLoadIncrease,
  type LoadRangeKg,
} from "../progression/progression.ts";
import type { TargetMetric } from "../training/training.ts";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "../workout/workout.ts";

/**
 * Deterministic per-set assessment (Implementation Phase 22, ADR-0130): the
 * "active Personal" after each set, computed without AI. Compares the set
 * with its plan, with the earlier sets of today's workout, with the same set
 * in previous sessions, with the 28-day trend and with the week's training
 * load, and recommends the next set inside the approved load bands
 * (ADR-0118: -5..-10% / +2.5..+5%, 0.5 kg steps). Facts and codes only; the
 * presentation turns them into text.
 */
export const SET_ASSESSMENT_VERSION = "set-assessment-v1";
/** Previous sessions of the exercise used for the recent average. */
export const SET_ASSESSMENT_RECENT_SESSIONS = 3;
/** Window of the estimated-strength trend and of the 28-day records. */
export const SET_ASSESSMENT_TREND_DAYS = 28;
/** Minimum sessions (with an e1RM) for a trend. */
export const SET_ASSESSMENT_TREND_MIN_SESSIONS = 3;
/** e1RM change, first to last session of the window, that is a trend. */
export const SET_ASSESSMENT_TREND_THRESHOLD = 0.025;
/** Change against the last session that counts as a real difference. */
export const SET_ASSESSMENT_SESSION_CHANGE = 0.1;
/** Drop from the previous set of today that counts as steep fatigue. */
export const SET_ASSESSMENT_STEEP_DROP = 0.2;
/** Drop large enough to show a pain caution. */
export const SET_ASSESSMENT_SHARP_DROP = 0.5;
/** Days without the exercise that count as a return after a break. */
export const SET_ASSESSMENT_LONG_BREAK_DAYS = 14;
/** Rolling window of the week's training load. */
export const SET_ASSESSMENT_WEEK_DAYS = 7;

const DAY_MS = 86_400_000;
const LOAD_EPSILON = 0.01;

export type SetVerdict =
  /** Fewer reps (seconds, meters) than planned. */
  | "below_plan"
  | "within_plan"
  /** More than planned. */
  | "above_plan"
  /** Stopped before the target with more reserve than planned. */
  | "stopped_early";
export type SetRecommendationAction = "decrease" | "keep" | "increase";
export type SetRecommendationScope = "next_set" | "next_session";
export type SetAssessmentConfidence = "low" | "normal" | "high";
export type SetAssessmentReason =
  /** No previous session of this exercise. */
  | "first_time"
  /** RIR planned but not recorded: guidance uses reps only. */
  | "rir_not_recorded"
  /** Below plan, but in line with what the athlete did last time here. */
  | "usual_for_you"
  /** Clearly below the same set of the last session. */
  | "below_last_session"
  /** Clearly above the same set of the last session. */
  | "above_last_session"
  /** Steep drop from the previous set of today. */
  | "steep_in_session_drop"
  /** More workouts in the last 7 days than planned per week. */
  | "heavy_week"
  /** Third session in a row above plan in this set. */
  | "consistent_above"
  /** First time in 14+ days with this exercise. */
  | "long_break"
  /** Drop of 50%+: pain caution. */
  | "sharp_drop";
export type SetRecordKind = "load" | "estimated_one_rep_max" | "reps_at_load";
export type SetRecord = Readonly<{
  kind: SetRecordKind;
  scope: "all_time" | "last_28_days";
}>;
export type SetObservation = Readonly<{
  value: number;
  loadKg: number | null;
  rir: number | null;
}>;
export type SetAssessment = Readonly<{
  version: typeof SET_ASSESSMENT_VERSION;
  workoutSetId: string;
  exerciseId: string;
  exerciseName: string;
  setSequence: number;
  metric: TargetMetric;
  verdict: SetVerdict;
  plan: Readonly<{
    actual: SetObservation;
    target: Readonly<{ min: number; max: number }>;
    targetAttainment: RangeAttainment;
    rir: Readonly<{ min: number; max: number }> | null;
    /** null when RIR is not planned or not recorded. */
    rirAttainment: RangeAttainment | null;
    plannedLoadKg: number | null;
  }>;
  /** Previous completed set of the same exercise today. */
  previousSetToday:
    (SetObservation & { sequence: number; change: number }) | null;
  /** Same set (sequence) in the most recent previous session. */
  lastSession:
    | (SetObservation &
        Readonly<{
          startedAt: string;
          /** Value change (fraction) when the load is the same. */
          valueChange: number | null;
          /** Estimated 1RM change (fraction) when both have one. */
          estimatedOneRepMaxChange: number | null;
        }>)
    | null;
  /** Same set over the last sessions (2 or more). */
  recentAverage: Readonly<{
    sessionCount: number;
    value: number;
    loadKg: number | null;
  }> | null;
  /** Best e1RM per session over 28 days, today included. */
  trend: Readonly<{
    direction: "rising" | "stable" | "falling";
    change: number;
    sessionCount: number;
  }> | null;
  records: readonly SetRecord[];
  week: Readonly<{
    /** Workouts started in the last 7 days, this one included. */
    workoutsLast7Days: number;
    plannedPerWeek: number | null;
    /** Whole days since the last previous session with this exercise. */
    daysSinceExercise: number | null;
  }>;
  previousSessionCount: number;
  recommendation: Readonly<{
    action: SetRecommendationAction;
    scope: SetRecommendationScope;
    currentLoadKg: number | null;
    /** Only when a load was used; kg, 0.5 kg steps. */
    loadKg: LoadRangeKg | null;
    target: Readonly<{ min: number; max: number }>;
    rir: Readonly<{ min: number; max: number }> | null;
    confidence: SetAssessmentConfidence;
  }>;
  reasons: readonly SetAssessmentReason[];
}>;

export type AssessWorkoutSetInput = Readonly<{
  session: WorkoutSession;
  workoutSetId: string;
  /** Completed or abandoned sessions; the current one is ignored. */
  history: readonly WorkoutSession[];
  plannedPerWeek: number | null;
  now: Date;
}>;

const bySequence = <T extends { sequence: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.sequence - b.sequence);
const change = (now: number, before: number) =>
  before > 0 ? (now - before) / before : 0;
const sameLoad = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < LOAD_EPSILON;
const observe = (set: WorkoutSet): SetObservation => ({
  value: set.actualValue!,
  loadKg: set.actualLoadKg,
  rir: set.actualRir,
});
const e1rm = (set: WorkoutSet) =>
  estimateOneRepMaxKg({
    metric: set.plannedMetric,
    reps: set.actualValue,
    loadKg: set.actualLoadKg,
    status: set.status,
  });
const done = (set: WorkoutSet) =>
  set.status === "completed" && set.actualValue !== null;
/** Same criteria as the progression signal (ADR-0118). */
const isAbovePlan = (set: WorkoutSet) =>
  set.actualValue !== null &&
  set.actualRir !== null &&
  set.plannedRirMax !== null &&
  set.actualValue >= set.plannedTargetMax &&
  set.actualRir > set.plannedRirMax;

type PastSet = Readonly<{
  session: WorkoutSession;
  exercise: WorkoutExercise;
  set: WorkoutSet;
}>;

/** Assessment of a completed set; null when the set is not completed. */
export function assessWorkoutSet(
  input: AssessWorkoutSetInput,
): SetAssessment | null {
  const { session, now } = input;
  const exercise = session.exercises.find((item) =>
    item.sets.some((set) => set.id === input.workoutSetId),
  );
  const set = exercise?.sets.find((item) => item.id === input.workoutSetId);
  if (!exercise || !set || !done(set)) return null;
  const actual = observe(set);
  const reasons: SetAssessmentReason[] = [];

  // Plan.
  const targetAttainment = classifyRange(
    actual.value,
    set.plannedTargetMin,
    set.plannedTargetMax,
  );
  const rirPlanned = set.plannedRirMin !== null && set.plannedRirMax !== null;
  const rirAttainment =
    rirPlanned && actual.rir !== null
      ? classifyRange(actual.rir, set.plannedRirMin!, set.plannedRirMax!)
      : null;
  if (rirPlanned && actual.rir === null) reasons.push("rir_not_recorded");
  const verdict: SetVerdict =
    targetAttainment === "below_range"
      ? rirAttainment === "above_range"
        ? "stopped_early"
        : "below_plan"
      : targetAttainment === "above_range"
        ? "above_plan"
        : "within_plan";

  // Today: previous completed set of the same exercise.
  const previousToday = bySequence(exercise.sets)
    .filter((item) => item.sequence < set.sequence && done(item))
    .at(-1);
  const previousSetToday = previousToday
    ? {
        ...observe(previousToday),
        sequence: previousToday.sequence,
        change: change(actual.value, previousToday.actualValue!),
      }
    : null;
  if (
    previousSetToday &&
    previousSetToday.change <= -SET_ASSESSMENT_STEEP_DROP &&
    (actual.loadKg ?? 0) <= (previousSetToday.loadKg ?? 0) + LOAD_EPSILON
  )
    reasons.push("steep_in_session_drop");

  // History of this exercise, most recent session first.
  const past: PastSet[][] = input.history
    .filter((item) => item.id !== session.id && item.status !== "in_progress")
    .filter((item) => Date.parse(item.startedAt) <= now.getTime())
    .sort(
      (a, b) =>
        Date.parse(b.startedAt) - Date.parse(a.startedAt) ||
        b.id.localeCompare(a.id),
    )
    .map((item) =>
      item.exercises
        .filter((candidate) => candidate.exerciseId === exercise.exerciseId)
        .flatMap((candidate) =>
          candidate.sets.filter(done).map((pastSet) => ({
            session: item,
            exercise: candidate,
            set: pastSet,
          })),
        ),
    )
    .filter((sets) => sets.length > 0);
  const previousSessionCount = past.length;
  if (!previousSessionCount) reasons.push("first_time");
  const sameSetIn = (sets: readonly PastSet[]) =>
    sets.find((entry) => entry.set.sequence === set.sequence)?.set ?? null;

  // Last session, same set.
  const lastSame = past[0] ? sameSetIn(past[0]) : null;
  let lastSession: SetAssessment["lastSession"] = null;
  if (lastSame) {
    const before = e1rm(lastSame),
      today = e1rm(set);
    lastSession = {
      ...observe(lastSame),
      startedAt: past[0]![0]!.session.startedAt,
      valueChange: sameLoad(actual.loadKg, lastSame.actualLoadKg)
        ? change(actual.value, lastSame.actualValue!)
        : null,
      estimatedOneRepMaxChange:
        before !== null && today !== null ? change(today, before) : null,
    };
    const difference =
      lastSession.valueChange ?? lastSession.estimatedOneRepMaxChange;
    if (difference !== null && difference <= -SET_ASSESSMENT_SESSION_CHANGE)
      reasons.push("below_last_session");
    if (difference !== null && difference >= SET_ASSESSMENT_SESSION_CHANGE)
      reasons.push("above_last_session");
  }
  const worstDrop = Math.min(
    previousSetToday?.change ?? 0,
    lastSession?.valueChange ?? 0,
  );
  if (worstDrop <= -SET_ASSESSMENT_SHARP_DROP) reasons.push("sharp_drop");

  // Recent average of the same set.
  const recentSets = past
    .slice(0, SET_ASSESSMENT_RECENT_SESSIONS)
    .map(sameSetIn)
    .filter((item): item is WorkoutSet => item !== null);
  const recentLoads = recentSets.map((item) => item.actualLoadKg);
  const recentAverage =
    recentSets.length >= 2
      ? {
          sessionCount: recentSets.length,
          value:
            recentSets.reduce((sum, item) => sum + item.actualValue!, 0) /
            recentSets.length,
          loadKg: recentLoads.every((load) => load !== null)
            ? (recentLoads as number[]).reduce((sum, load) => sum + load, 0) /
              recentLoads.length
            : null,
        }
      : null;

  // 28-day trend of the best e1RM per session (oldest first), today last.
  const since = now.getTime() - SET_ASSESSMENT_TREND_DAYS * DAY_MS;
  const window = past.filter(
    (sets) => Date.parse(sets[0]!.session.startedAt) > since,
  );
  const bestOf = (sets: readonly WorkoutSet[]) => {
    const values = sets
      .map(e1rm)
      .filter((value): value is number => value !== null);
    return values.length ? Math.max(...values) : null;
  };
  const todayDone = exercise.sets.filter(
    (item) => done(item) && item.sequence <= set.sequence,
  );
  const points = [
    ...window.map((sets) => bestOf(sets.map((entry) => entry.set))).reverse(),
    bestOf(todayDone),
  ].filter((value): value is number => value !== null);
  let trend: SetAssessment["trend"] = null;
  if (points.length >= SET_ASSESSMENT_TREND_MIN_SESSIONS) {
    const delta = change(points.at(-1)!, points[0]!);
    trend = {
      direction:
        delta >= SET_ASSESSMENT_TREND_THRESHOLD
          ? "rising"
          : delta <= -SET_ASSESSMENT_TREND_THRESHOLD
            ? "falling"
            : "stable",
      change: delta,
      sessionCount: points.length,
    };
  }

  // Records against every earlier set (history and earlier today).
  const earlierToday = exercise.sets.filter(
    (item) => done(item) && item.sequence < set.sequence,
  );
  const allEarlier = [
    ...past.flatMap((sets) => sets.map((entry) => entry.set)),
    ...earlierToday,
  ];
  const recentEarlier = [
    ...window.flatMap((sets) => sets.map((entry) => entry.set)),
    ...earlierToday,
  ];
  const records: SetRecord[] = [];
  const beats = (pool: readonly WorkoutSet[], kind: SetRecordKind) => {
    if (!pool.length) return false;
    if (kind === "load")
      return (
        actual.loadKg !== null &&
        actual.loadKg > 0 &&
        pool.some((item) => item.actualLoadKg !== null) &&
        pool.every((item) => (item.actualLoadKg ?? -1) < actual.loadKg!)
      );
    if (kind === "estimated_one_rep_max") {
      const today = e1rm(set),
        best = bestOf(pool);
      return today !== null && best !== null && today > best + LOAD_EPSILON;
    }
    const atLoad = pool.filter(
      (item) =>
        item.plannedMetric === set.plannedMetric &&
        (item.actualLoadKg ?? 0) >= (actual.loadKg ?? 0) - LOAD_EPSILON,
    );
    return (
      atLoad.length > 0 &&
      atLoad.every((item) => item.actualValue! < actual.value)
    );
  };
  for (const kind of [
    "load",
    "estimated_one_rep_max",
    "reps_at_load",
  ] as const) {
    if (beats(allEarlier, kind)) records.push({ kind, scope: "all_time" });
    else if (past.length > window.length && beats(recentEarlier, kind))
      records.push({ kind, scope: "last_28_days" });
  }

  // Week.
  const weekSince = now.getTime() - SET_ASSESSMENT_WEEK_DAYS * DAY_MS;
  const workoutsLast7Days =
    input.history.filter(
      (item) =>
        item.id !== session.id &&
        item.status === "completed" &&
        Date.parse(item.startedAt) > weekSince &&
        Date.parse(item.startedAt) <= now.getTime(),
    ).length + 1;
  const daysSinceExercise = past[0]
    ? Math.floor(
        (Date.parse(session.startedAt) -
          Date.parse(past[0][0]!.session.startedAt)) /
          DAY_MS,
      )
    : null;
  if (
    input.plannedPerWeek !== null &&
    input.plannedPerWeek > 0 &&
    workoutsLast7Days > input.plannedPerWeek
  )
    reasons.push("heavy_week");
  if (
    daysSinceExercise !== null &&
    daysSinceExercise >= SET_ASSESSMENT_LONG_BREAK_DAYS
  )
    reasons.push("long_break");

  // Recommendation: approved bands, adjusted by context.
  const next = bySequence(exercise.sets).find(
    (item) => item.sequence > set.sequence && item.status === "pending",
  );
  const reference = next ?? set;
  let action: SetRecommendationAction = "keep";
  if (targetAttainment === "below_range" && rirAttainment === "below_range")
    action = "decrease";
  else if (
    actual.value >= set.plannedTargetMax &&
    rirAttainment === "above_range"
  )
    action = "increase";
  if (action === "decrease" && lastSame) {
    // What the athlete usually does here: not clearly worse than the same
    // set last time, at the same or a lighter load (a drop within today that
    // also happened last time is the athlete's normal fatigue).
    const usual =
      (actual.loadKg ?? 0) <= (lastSame.actualLoadKg ?? 0) + LOAD_EPSILON &&
      actual.value >=
        lastSame.actualValue! * (1 - SET_ASSESSMENT_SESSION_CHANGE);
    if (usual) {
      action = "keep";
      reasons.push("usual_for_you");
    }
  }
  if (action === "increase") {
    const previousTwo = past
      .slice(0, 2)
      .map(sameSetIn)
      .filter((item): item is WorkoutSet => item !== null);
    if (previousTwo.length === 2 && previousTwo.every(isAbovePlan))
      reasons.push("consistent_above");
  }
  const currentLoadKg =
    actual.loadKg !== null && actual.loadKg > 0 ? actual.loadKg : null;
  const loadKg =
    currentLoadKg === null
      ? null
      : action === "increase"
        ? suggestedLoadIncrease(currentLoadKg)
        : action === "decrease"
          ? suggestedLoadDecrease(currentLoadKg)
          : { min: currentLoadKg, max: currentLoadKg };
  const confidence: SetAssessmentConfidence =
    reasons.includes("first_time") || reasons.includes("rir_not_recorded")
      ? "low"
      : (action === "decrease" &&
            reasons.includes("below_last_session") &&
            (reasons.includes("heavy_week") ||
              reasons.includes("steep_in_session_drop"))) ||
          (action === "increase" && reasons.includes("consistent_above"))
        ? "high"
        : "normal";

  return {
    version: SET_ASSESSMENT_VERSION,
    workoutSetId: set.id,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    setSequence: set.sequence,
    metric: set.plannedMetric,
    verdict,
    plan: {
      actual,
      target: { min: set.plannedTargetMin, max: set.plannedTargetMax },
      targetAttainment,
      rir: rirPlanned
        ? { min: set.plannedRirMin!, max: set.plannedRirMax! }
        : null,
      rirAttainment,
      plannedLoadKg: set.plannedLoadKg,
    },
    previousSetToday,
    lastSession,
    recentAverage,
    trend,
    records,
    week: {
      workoutsLast7Days,
      plannedPerWeek: input.plannedPerWeek,
      daysSinceExercise,
    },
    previousSessionCount,
    recommendation: {
      action,
      scope: next ? "next_set" : "next_session",
      currentLoadKg,
      loadKg,
      target: {
        min: reference.plannedTargetMin,
        max: reference.plannedTargetMax,
      },
      rir:
        reference.plannedRirMin !== null && reference.plannedRirMax !== null
          ? { min: reference.plannedRirMin, max: reference.plannedRirMax }
          : null,
      confidence,
    },
    reasons,
  };
}
