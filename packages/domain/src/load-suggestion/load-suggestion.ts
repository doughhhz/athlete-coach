import type { ExerciseMechanics } from "../exercise/exercise.ts";
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "../workout/workout.ts";

/**
 * Deterministic load and warm-up suggestion (Implementation Phase 23,
 * ADR-0131). Before the first set of an exercise the Personal suggests the
 * working load from the athlete's own recent sets (Epley with reps in
 * reserve, inverted for today's plan) and a warm-up ramp from that load.
 * No AI. No estimate across different exercises: without history the
 * athlete starts with an exploratory set and the per-set assessment
 * (ADR-0130) adjusts from there.
 */
export const LOAD_SUGGESTION_VERSION = "load-suggestion-v1";
/** Reps + RIR accepted to estimate strength from a set (hypothesis). */
export const LOAD_SUGGESTION_MAX_EFFORT_REPS = 20;
/** RIR assumed when the plan has none (hypothesis). */
export const LOAD_SUGGESTION_DEFAULT_RIR = 2;
/** Load factor after 14+ days without the exercise. */
export const LOAD_SUGGESTION_LONG_BREAK_FACTOR = 0.9;
export const LOAD_SUGGESTION_LONG_BREAK_DAYS = 14;
/** Largest increase over the last working load (safety cap). */
export const LOAD_SUGGESTION_MAX_INCREASE = 0.1;
/** Below this working load a ramp has two sets instead of three. */
export const WARM_UP_LIGHT_LOAD_KG = 40;
/** Empty barbell (warm-ups never go below it on barbell lifts). */
export const BARBELL_KG = 20;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Equipment family that defines plate steps (from the catalog). */
export type LoadEquipment =
  "barbell" | "dumbbell" | "machine" | "kettlebell" | "bodyweight" | "other";
/** Default load steps without history (hypothesis, ADR-0131). */
export const DEFAULT_LOAD_STEP_KG: Readonly<Record<LoadEquipment, number>> = {
  barbell: 2.5,
  dumbbell: 1,
  machine: 2.5,
  kettlebell: 4,
  bodyweight: 2.5,
  other: 2.5,
};
export type ExerciseLoadProfile = Readonly<{
  mechanics: ExerciseMechanics;
  primaryMuscleGroups: readonly string[];
  equipment: LoadEquipment;
}>;

export type WarmUpPlan = "full" | "single" | "none";
export type WarmUpSet = Readonly<{
  /** null: bodyweight or no load known. */
  loadKg: number | null;
  reps: number;
  /** Fraction of the working load (null for the empty bar). */
  percent: number | null;
}>;
export type LoadSuggestionKind =
  /** Working load from the athlete's own sets. */
  | "from_history"
  /** The program prescribes an absolute load. */
  | "prescribed"
  /** No usable history: exploratory first set. */
  | "exploratory"
  /** Bodyweight exercise: no load. */
  | "bodyweight";
export type LoadSuggestionReason =
  | "long_break"
  | "heavy_week"
  | "capped_increase"
  | "rir_assumed"
  | "group_already_warm"
  | "isolation";
export type ExerciseLoadSuggestion = Readonly<{
  version: typeof LOAD_SUGGESTION_VERSION;
  workoutExerciseId: string;
  exerciseId: string;
  kind: LoadSuggestionKind;
  /** Suggested load of the first working set; kg. */
  workingLoadKg: number | null;
  stepKg: number;
  /** Set the estimate came from. */
  basis: Readonly<{
    startedAt: string;
    value: number;
    loadKg: number;
    rir: number | null;
    estimatedOneRepMaxKg: number;
  }> | null;
  /** What the load is meant for: today's first set. */
  target: Readonly<{ reps: number; rir: number }>;
  warmUp: Readonly<{ plan: WarmUpPlan; sets: readonly WarmUpSet[] }>;
  reasons: readonly LoadSuggestionReason[];
}>;

export type SuggestWorkoutLoadsInput = Readonly<{
  session: WorkoutSession;
  /** Completed or abandoned sessions; the current one is ignored. */
  history: readonly WorkoutSession[];
  /** Catalog data by exerciseId; missing = unknown (no warm-up rules). */
  profiles: ReadonlyMap<string, ExerciseLoadProfile>;
  plannedPerWeek: number | null;
  now: Date;
}>;

/** Epley with reps in reserve: load x (1 + (reps + RIR) / 30). */
export function estimateOneRepMaxWithReserveKg(
  loadKg: number,
  reps: number,
  rir: number | null,
): number | null {
  const effort = reps + (rir ?? 0);
  if (
    !Number.isFinite(loadKg) ||
    loadKg <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    effort > LOAD_SUGGESTION_MAX_EFFORT_REPS
  )
    return null;
  return loadKg * (1 + effort / 30);
}
/** Inverse of the estimate: the load for `reps` leaving `rir` in reserve. */
export function loadForRepsKg(
  oneRepMaxKg: number,
  reps: number,
  rir: number,
): number {
  return oneRepMaxKg / (1 + (reps + rir) / 30);
}
/** Nearest multiple of the step (ties down), never below one step. */
export function roundToLoadStep(loadKg: number, stepKg: number): number {
  const steps = Math.max(1, Math.round(loadKg / stepKg - 1e-9));
  return Math.round(steps * stepKg * 100) / 100;
}
const floorToStep = (loadKg: number, stepKg: number) =>
  Math.round(Math.floor(loadKg / stepKg + 1e-9) * stepKg * 100) / 100;

/**
 * Plate step the athlete actually uses on this exercise: the smallest gap
 * between distinct logged loads (0.5..5 kg), else the equipment default.
 */
export function inferLoadStepKg(
  loggedLoadsKg: readonly number[],
  equipment: LoadEquipment,
): number {
  const distinct = [...new Set(loggedLoadsKg.filter((load) => load > 0))]
    .map((load) => Math.round(load * 100) / 100)
    .sort((a, b) => a - b);
  const gaps = distinct
    .slice(1)
    .map((load, index) => Math.round((load - distinct[index]!) * 100) / 100)
    .filter((gap) => gap >= 0.5 && gap <= 5);
  return gaps.length ? Math.min(...gaps) : DEFAULT_LOAD_STEP_KG[equipment];
}

/**
 * Warm-up ramp from the working load (hypothesis, ADR-0131):
 * full = 40% x 10, 60% x 5, 80% x 3 (50% x 8, 75% x 4 under 40 kg);
 * single = 60% x 6 (50% x 10 for an isolation). Loads are rounded down to
 * the step, barbell lifts start at the empty bar, and sets that would be as
 * heavy as the working load are dropped.
 */
export function buildWarmUp(
  plan: WarmUpPlan,
  workingLoadKg: number | null,
  stepKg: number,
  profile: ExerciseLoadProfile | null,
): readonly WarmUpSet[] {
  if (plan === "none") return [];
  const scheme: readonly (readonly [number, number])[] =
    plan === "single"
      ? profile?.mechanics === "isolation"
        ? [[0.5, 10]]
        : [[0.6, 6]]
      : workingLoadKg !== null && workingLoadKg < WARM_UP_LIGHT_LOAD_KG
        ? [
            [0.5, 8],
            [0.75, 4],
          ]
        : [
            [0.4, 10],
            [0.6, 5],
            [0.8, 3],
          ];
  if (workingLoadKg === null)
    return scheme.map(([percent, reps]) => ({ loadKg: null, reps, percent }));
  const barbell = profile?.equipment === "barbell";
  const sets: WarmUpSet[] = [];
  for (const [percent, reps] of scheme) {
    let loadKg = floorToStep(workingLoadKg * percent, stepKg);
    if (barbell && loadKg < BARBELL_KG) loadKg = BARBELL_KG;
    if (loadKg <= 0 || loadKg >= workingLoadKg) continue;
    if (sets.some((set) => set.loadKg === loadKg)) continue;
    sets.push({
      loadKg,
      reps,
      percent: barbell && loadKg === BARBELL_KG ? null : percent,
    });
  }
  return sets;
}

const bySequence = <T extends { sequence: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.sequence - b.sequence);
const loadedRepSet = (set: WorkoutSet) =>
  set.status === "completed" &&
  set.plannedMetric === "reps" &&
  set.actualValue !== null &&
  set.actualLoadKg !== null &&
  set.actualLoadKg > 0;

/** One suggestion per exercise of the session whose sets count reps. */
export function suggestWorkoutLoads(
  input: SuggestWorkoutLoadsInput,
): readonly ExerciseLoadSuggestion[] {
  const { session, now } = input;
  const ordered = bySequence(session.exercises);
  const sessions = input.history
    .filter((item) => item.id !== session.id && item.status !== "in_progress")
    .filter((item) => Date.parse(item.startedAt) <= now.getTime())
    .sort(
      (a, b) =>
        Date.parse(b.startedAt) - Date.parse(a.startedAt) ||
        b.id.localeCompare(a.id),
    );
  const workoutsLast7Days =
    sessions.filter(
      (item) =>
        item.status === "completed" &&
        Date.parse(item.startedAt) > now.getTime() - WEEK_MS,
    ).length + 1;
  const heavyWeek =
    input.plannedPerWeek !== null &&
    input.plannedPerWeek > 0 &&
    workoutsLast7Days > input.plannedPerWeek;

  return ordered.flatMap((exercise, index): ExerciseLoadSuggestion[] => {
    const first = bySequence(exercise.sets)[0];
    if (!first || first.plannedMetric !== "reps") return [];
    const profile = input.profiles.get(exercise.exerciseId) ?? null;
    const reasons: LoadSuggestionReason[] = [];
    const target = {
      reps: Math.floor((first.plannedTargetMin + first.plannedTargetMax) / 2),
      rir: first.plannedRirMin ?? LOAD_SUGGESTION_DEFAULT_RIR,
    };
    if (first.plannedRirMin === null) reasons.push("rir_assumed");

    // History of this exercise, most recent first.
    const past = sessions
      .map((item) => ({
        session: item,
        sets: item.exercises
          .filter((candidate) => candidate.exerciseId === exercise.exerciseId)
          .flatMap((candidate) => candidate.sets)
          .filter(loadedRepSet),
      }))
      .filter((entry) => entry.sets.length > 0);
    const stepKg = inferLoadStepKg(
      past.flatMap((entry) => entry.sets.map((set) => set.actualLoadKg!)),
      profile?.equipment ?? "other",
    );

    let kind: LoadSuggestionKind;
    let workingLoadKg: number | null = null;
    let basis: ExerciseLoadSuggestion["basis"] = null;
    if (first.plannedLoadKind === "absolute" && first.plannedLoadKg !== null) {
      kind = "prescribed";
      workingLoadKg = first.plannedLoadKg;
    } else if (past[0]) {
      // Best estimate of the most recent session (current state).
      const candidates = past[0].sets
        .map((set) => ({
          set,
          estimate: estimateOneRepMaxWithReserveKg(
            set.actualLoadKg!,
            set.actualValue!,
            set.actualRir,
          ),
        }))
        .filter(
          (entry): entry is { set: WorkoutSet; estimate: number } =>
            entry.estimate !== null,
        )
        .sort((a, b) => b.estimate - a.estimate);
      const best = candidates[0];
      if (best) {
        kind = "from_history";
        basis = {
          startedAt: past[0].session.startedAt,
          value: best.set.actualValue!,
          loadKg: best.set.actualLoadKg!,
          rir: best.set.actualRir,
          estimatedOneRepMaxKg: best.estimate,
        };
        const lastWorking =
          bySequence(past[0].sets)[0]?.actualLoadKg ?? best.set.actualLoadKg!;
        let raw = loadForRepsKg(best.estimate, target.reps, target.rir);
        const days = Math.floor(
          (now.getTime() - Date.parse(past[0].session.startedAt)) / DAY_MS,
        );
        if (days >= LOAD_SUGGESTION_LONG_BREAK_DAYS) {
          raw *= LOAD_SUGGESTION_LONG_BREAK_FACTOR;
          reasons.push("long_break");
        }
        if (raw > lastWorking * (1 + LOAD_SUGGESTION_MAX_INCREASE)) {
          raw = lastWorking * (1 + LOAD_SUGGESTION_MAX_INCREASE);
          reasons.push("capped_increase");
        }
        if (heavyWeek && raw > lastWorking) {
          raw = lastWorking;
          reasons.push("heavy_week");
        }
        workingLoadKg = roundToLoadStep(raw, stepKg);
      } else kind = "exploratory";
    } else
      kind = profile?.equipment === "bodyweight" ? "bodyweight" : "exploratory";

    // Warm-up: a ramp for the first compound of its muscle groups.
    const earlierGroups = new Set(
      ordered
        .slice(0, index)
        .flatMap(
          (item) =>
            input.profiles.get(item.exerciseId)?.primaryMuscleGroups ?? [],
        ),
    );
    const groupWarm =
      profile !== null &&
      profile.primaryMuscleGroups.length > 0 &&
      profile.primaryMuscleGroups.every((group) => earlierGroups.has(group));
    let plan: WarmUpPlan = "none";
    if (profile && workingLoadKg !== null) {
      if (profile.mechanics === "compound")
        plan = groupWarm ? "single" : "full";
      else if (!groupWarm && workingLoadKg >= 10) plan = "single";
      if (groupWarm) reasons.push("group_already_warm");
      if (profile.mechanics === "isolation") reasons.push("isolation");
    }
    const warmUpSets = buildWarmUp(plan, workingLoadKg, stepKg, profile);
    if (!warmUpSets.length) plan = "none";
    return [
      {
        version: LOAD_SUGGESTION_VERSION,
        workoutExerciseId: exercise.id,
        exerciseId: exercise.exerciseId,
        kind,
        workingLoadKg,
        stepKg,
        basis,
        target,
        warmUp: { plan, sets: warmUpSets },
        reasons,
      },
    ];
  });
}

/** The exercise has no completed set yet (suggestion still useful). */
export function isExerciseUnstarted(exercise: WorkoutExercise): boolean {
  return exercise.sets.every((set) => set.status === "pending");
}
