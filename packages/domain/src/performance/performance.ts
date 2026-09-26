import type { WorkoutSession, WorkoutSet } from "../workout/workout.ts";

export const EPLEY_FORMULA_VERSION = "epley-v1" as const;
export type RangeAttainment = "below_range" | "within_range" | "above_range";
export type MeasuredAttainment =
  RangeAttainment | "not_measured" | "not_planned";

export type SessionDerivedMetrics = Readonly<{
  durationSeconds: number;
  prescribedSetCount: number;
  completedSetCount: number;
  skippedSetCount: number;
  pendingSetCount: number;
  totalActualReps: number;
  totalActualSeconds: number;
  totalActualMeters: number;
  withinTargetCount: number;
  targetEligibleCount: number;
  withinTargetRate: number | null;
  rirMeasuredCount: number;
  rirWithinRangeCount: number;
  restMeasuredCount: number;
  restWithinRangeCount: number;
  bestEstimatedOneRepMaxKg: number | null;
}>;

export type ExercisePerformancePoint = Readonly<{
  workoutSessionId: string;
  workoutSetId: string;
  exerciseId: string;
  exerciseName: string;
  sessionStatus: "completed" | "abandoned";
  performedAt: string;
  sessionStartedAt: string;
  programName: string;
  dayName: string;
  reps: number | null;
  actualSeconds: number | null;
  actualMeters: number | null;
  loggedLoadKg: number | null;
  actualRir: number | null;
  estimatedOneRepMaxKg: number | null;
  e1rmFormulaVersion: typeof EPLEY_FORMULA_VERSION | null;
  targetAttainment: RangeAttainment;
  rirAttainment: MeasuredAttainment;
  restAttainment: MeasuredAttainment;
  isNewMaxLoggedLoad: boolean;
  isNewEstimatedOneRepMax: boolean;
}>;

export type ExercisePersonalBest = Readonly<{
  exerciseId: string;
  exerciseName: string;
  maxLoggedLoadKg: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  e1rmFormulaVersion: typeof EPLEY_FORMULA_VERSION;
}>;

export type PerformanceOverview = Readonly<{
  completedWorkoutCount: number;
  abandonedWorkoutCount: number;
  completedSetCount: number;
  skippedSetCount: number;
  pendingSetCount: number;
  totalActualReps: number;
}>;

export function classifyRange(
  value: number,
  min: number,
  max: number,
): RangeAttainment {
  if (value < min) return "below_range";
  if (value > max) return "above_range";
  return "within_range";
}

export function deriveTargetAttainment(
  set: WorkoutSet,
): RangeAttainment | "not_measured" {
  return set.status === "completed" && set.actualValue !== null
    ? classifyRange(set.actualValue, set.plannedTargetMin, set.plannedTargetMax)
    : "not_measured";
}

export function deriveRirAttainment(set: WorkoutSet): MeasuredAttainment {
  if (set.plannedRirMin === null || set.plannedRirMax === null)
    return "not_planned";
  if (set.status !== "completed" || set.actualRir === null)
    return "not_measured";
  return classifyRange(set.actualRir, set.plannedRirMin, set.plannedRirMax);
}

export function actualRestSeconds(set: WorkoutSet): number | null {
  if (!set.restStartedAt || !set.restEndedAt) return null;
  const seconds =
    (Date.parse(set.restEndedAt) - Date.parse(set.restStartedAt)) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function deriveRestAttainment(set: WorkoutSet): MeasuredAttainment {
  if (set.plannedRestMinSeconds === null || set.plannedRestMaxSeconds === null)
    return "not_planned";
  const observed = actualRestSeconds(set);
  return observed === null
    ? "not_measured"
    : classifyRange(
        observed,
        set.plannedRestMinSeconds,
        set.plannedRestMaxSeconds,
      );
}

export function estimateOneRepMaxKg(
  input: Readonly<{
    metric: string;
    reps: number | null;
    loadKg: number | null;
    status: string;
  }>,
): number | null {
  if (
    input.status !== "completed" ||
    input.metric !== "reps" ||
    input.reps === null ||
    input.loadKg === null ||
    input.loadKg <= 0 ||
    !Number.isInteger(input.reps) ||
    input.reps < 1 ||
    input.reps > 12
  )
    return null;
  return input.reps === 1 ? input.loadKg : input.loadKg * (1 + input.reps / 30);
}

export function deriveSessionMetrics(
  session: WorkoutSession,
): SessionDerivedMetrics {
  const end = session.completedAt ?? session.abandonedAt;
  const durationSeconds = end
    ? Math.max(
        0,
        Math.floor((Date.parse(end) - Date.parse(session.startedAt)) / 1000),
      )
    : 0;
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.status === "completed");
  const target = completed.map(deriveTargetAttainment);
  const rir = completed.map(deriveRirAttainment);
  const rest = completed.map(deriveRestAttainment);
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
  return {
    durationSeconds,
    prescribedSetCount: sets.length,
    completedSetCount: completed.length,
    skippedSetCount: sets.filter((set) => set.status === "skipped").length,
    pendingSetCount: sets.filter((set) => set.status === "pending").length,
    totalActualReps: completed
      .filter((set) => set.plannedMetric === "reps")
      .reduce((sum, set) => sum + (set.actualValue ?? 0), 0),
    totalActualSeconds: completed
      .filter((set) => set.plannedMetric === "seconds")
      .reduce((sum, set) => sum + (set.actualValue ?? 0), 0),
    totalActualMeters: completed
      .filter((set) => set.plannedMetric === "meters")
      .reduce((sum, set) => sum + (set.actualValue ?? 0), 0),
    withinTargetCount: target.filter((value) => value === "within_range")
      .length,
    targetEligibleCount: target.length,
    withinTargetRate: target.length
      ? target.filter((value) => value === "within_range").length /
        target.length
      : null,
    rirMeasuredCount: rir.filter(
      (value) => value !== "not_measured" && value !== "not_planned",
    ).length,
    rirWithinRangeCount: rir.filter((value) => value === "within_range").length,
    restMeasuredCount: rest.filter(
      (value) => value !== "not_measured" && value !== "not_planned",
    ).length,
    restWithinRangeCount: rest.filter((value) => value === "within_range")
      .length,
    bestEstimatedOneRepMaxKg: e1rms.length ? Math.max(...e1rms) : null,
  };
}

export function deriveExercisePerformanceHistory(
  sessions: readonly WorkoutSession[],
  exerciseId?: string,
): readonly ExercisePerformancePoint[] {
  const candidates = sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets
        .filter(
          (set) =>
            set.status === "completed" &&
            set.actualValue !== null &&
            set.performedAt !== null,
        )
        .map((set) => ({ session, exercise, set })),
    ),
  );
  candidates.sort(
    (a, b) =>
      a.set.performedAt!.localeCompare(b.set.performedAt!) ||
      a.session.startedAt.localeCompare(b.session.startedAt) ||
      a.set.id.localeCompare(b.set.id),
  );
  const bestLoad = new Map<string, number>();
  const bestE1rm = new Map<string, number>();
  const seenLoad = new Set<string>();
  const seenE1rm = new Set<string>();
  return candidates
    .filter(({ exercise }) => !exerciseId || exercise.exerciseId === exerciseId)
    .map(({ session, exercise, set }) => {
      const e1rm = estimateOneRepMaxKg({
        metric: set.plannedMetric,
        reps: set.actualValue,
        loadKg: set.actualLoadKg,
        status: set.status,
      });
      const previousLoad = bestLoad.get(exercise.exerciseId);
      const previousE1rm = bestE1rm.get(exercise.exerciseId);
      const isNewMaxLoggedLoad =
        set.actualLoadKg !== null &&
        seenLoad.has(exercise.exerciseId) &&
        set.actualLoadKg > (previousLoad ?? -Infinity);
      const isNewEstimatedOneRepMax =
        e1rm !== null &&
        seenE1rm.has(exercise.exerciseId) &&
        e1rm > (previousE1rm ?? -Infinity);
      if (set.actualLoadKg !== null) {
        seenLoad.add(exercise.exerciseId);
        bestLoad.set(
          exercise.exerciseId,
          Math.max(previousLoad ?? -Infinity, set.actualLoadKg),
        );
      }
      if (e1rm !== null) {
        seenE1rm.add(exercise.exerciseId);
        bestE1rm.set(
          exercise.exerciseId,
          Math.max(previousE1rm ?? -Infinity, e1rm),
        );
      }
      return {
        workoutSessionId: session.id,
        workoutSetId: set.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sessionStatus: session.status as "completed" | "abandoned",
        performedAt: set.performedAt!,
        sessionStartedAt: session.startedAt,
        programName: session.programName,
        dayName: session.dayName,
        reps: set.plannedMetric === "reps" ? set.actualValue : null,
        actualSeconds: set.plannedMetric === "seconds" ? set.actualValue : null,
        actualMeters: set.plannedMetric === "meters" ? set.actualValue : null,
        loggedLoadKg: set.actualLoadKg,
        actualRir: set.actualRir,
        estimatedOneRepMaxKg: e1rm,
        e1rmFormulaVersion: e1rm === null ? null : EPLEY_FORMULA_VERSION,
        targetAttainment: classifyRange(
          set.actualValue!,
          set.plannedTargetMin,
          set.plannedTargetMax,
        ),
        rirAttainment: deriveRirAttainment(set),
        restAttainment: deriveRestAttainment(set),
        isNewMaxLoggedLoad,
        isNewEstimatedOneRepMax,
      };
    });
}

export function derivePersonalBests(
  points: readonly ExercisePerformancePoint[],
): readonly ExercisePersonalBest[] {
  const values = new Map<string, ExercisePersonalBest>();
  for (const point of points) {
    const current = values.get(point.exerciseId);
    values.set(point.exerciseId, {
      exerciseId: point.exerciseId,
      exerciseName: point.exerciseName,
      maxLoggedLoadKg:
        point.loggedLoadKg === null
          ? (current?.maxLoggedLoadKg ?? null)
          : Math.max(current?.maxLoggedLoadKg ?? -Infinity, point.loggedLoadKg),
      bestEstimatedOneRepMaxKg:
        point.estimatedOneRepMaxKg === null
          ? (current?.bestEstimatedOneRepMaxKg ?? null)
          : Math.max(
              current?.bestEstimatedOneRepMaxKg ?? -Infinity,
              point.estimatedOneRepMaxKg,
            ),
      e1rmFormulaVersion: EPLEY_FORMULA_VERSION,
    });
  }
  return [...values.values()]
    .filter(
      (value) =>
        value.maxLoggedLoadKg !== null ||
        value.bestEstimatedOneRepMaxKg !== null,
    )
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function derivePerformanceOverview(
  sessions: readonly WorkoutSession[],
): PerformanceOverview {
  const metrics = sessions.map(deriveSessionMetrics);
  return {
    completedWorkoutCount: sessions.filter(
      (session) => session.status === "completed",
    ).length,
    abandonedWorkoutCount: sessions.filter(
      (session) => session.status === "abandoned",
    ).length,
    completedSetCount: metrics.reduce(
      (sum, value) => sum + value.completedSetCount,
      0,
    ),
    skippedSetCount: metrics.reduce(
      (sum, value) => sum + value.skippedSetCount,
      0,
    ),
    pendingSetCount: metrics.reduce(
      (sum, value) => sum + value.pendingSetCount,
      0,
    ),
    totalActualReps: metrics.reduce(
      (sum, value) => sum + value.totalActualReps,
      0,
    ),
  };
}
