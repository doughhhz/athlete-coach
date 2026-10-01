import type {
  LoadPrescriptionKind,
  TrainingProgram,
} from "../training/training.ts";
import type { WorkoutSession, WorkoutSet } from "../workout/workout.ts";

/**
 * Deterministic progression signals (Implementation Phase 20, ADR-0118).
 * The system decides whether recorded performance is consistently above or
 * below the plan and computes the allowed load range; the Coach only
 * interprets and proposes inside that range.
 */
export const PROGRESSION_SIGNALS_VERSION = "progression-signals-v1";
/** Most recent completed sessions of a prescription considered. */
export const PROGRESSION_SIGNAL_SESSION_COUNT = 3;
/** Load increase band (fraction of current load), rounded to 0.5 kg. */
export const PROGRESSION_LOAD_INCREASE = { min: 0.025, max: 0.05 } as const;
/** Smallest increase in kg when the percentage rounds lower. */
export const PROGRESSION_MIN_INCREASE_KG = 1;
/** Load decrease band (fraction of current load), rounded to 0.5 kg. */
export const PROGRESSION_LOAD_DECREASE = { min: 0.05, max: 0.1 } as const;
export const PROGRESSION_LOAD_STEP_KG = 0.5;

export type ProgressionDirection = "above_plan" | "below_plan";
/**
 * `program_load_change`: prescribed absolute load; a program change inside
 * `suggestedLoadKg` is justified. `athlete_guidance`: load is chosen by the
 * athlete (or unprescribed); guide the athlete, do not change program load.
 */
export type ProgressionRecommendation =
  "program_load_change" | "athlete_guidance";
export type LoadRangeKg = Readonly<{ min: number; max: number }>;
export type ProgressionSetSignal = Readonly<{
  prescriptionSetId: string;
  loadKind: LoadPrescriptionKind;
  currentLoadKg: number | null;
  /** Only for prescribed absolute load; inclusive, kg, 0.5 kg steps. */
  suggestedLoadKg: LoadRangeKg | null;
}>;
export type ProgressionSignal = Readonly<{
  version: typeof PROGRESSION_SIGNALS_VERSION;
  trainingDayId: string;
  exercisePrescriptionId: string;
  exerciseId: string;
  exerciseName: string;
  direction: ProgressionDirection;
  recommendation: ProgressionRecommendation;
  /** Completed sessions used, most recent first (always the full window). */
  sessionIds: readonly string[];
  completedSetCount: number;
  sets: readonly ProgressionSetSignal[];
}>;

const ceilToStep = (value: number) =>
  Math.ceil(value / PROGRESSION_LOAD_STEP_KG - 1e-9) * PROGRESSION_LOAD_STEP_KG;
const floorToStep = (value: number) =>
  Math.floor(value / PROGRESSION_LOAD_STEP_KG + 1e-9) *
  PROGRESSION_LOAD_STEP_KG;

/** +2.5%..+5%, 0.5 kg steps, at least +1 kg (40 kg -> 41..42 kg). */
export function suggestedLoadIncrease(currentLoadKg: number): LoadRangeKg {
  if (!Number.isFinite(currentLoadKg) || currentLoadKg <= 0)
    throw new Error("currentLoadKg must be positive.");
  const floor = currentLoadKg + PROGRESSION_MIN_INCREASE_KG;
  const min = Math.max(
    ceilToStep(currentLoadKg * (1 + PROGRESSION_LOAD_INCREASE.min)),
    floor,
  );
  const max = Math.max(
    floorToStep(currentLoadKg * (1 + PROGRESSION_LOAD_INCREASE.max)),
    min,
  );
  return { min, max };
}
/**
 * -5%..-10%, 0.5 kg steps (40 kg -> 36..38 kg). When the band is narrower
 * than one step, the nearest valid load below the current one is used; null
 * when no positive load below the current one exists.
 */
export function suggestedLoadDecrease(
  currentLoadKg: number,
): LoadRangeKg | null {
  if (!Number.isFinite(currentLoadKg) || currentLoadKg <= 0)
    throw new Error("currentLoadKg must be positive.");
  const max = floorToStep(currentLoadKg * (1 - PROGRESSION_LOAD_DECREASE.min));
  const min = ceilToStep(currentLoadKg * (1 - PROGRESSION_LOAD_DECREASE.max));
  if (max <= 0) return null;
  return min <= max ? { min, max } : { min: max, max };
}

/** Set clearly above plan: value >= target max and RIR > planned RIR max. */
function isAbovePlan(set: WorkoutSet): boolean {
  if (
    set.actualValue === null ||
    set.actualRir === null ||
    set.plannedRirMax === null
  )
    return false;
  // A prescribed load must actually have been used (no lighter shortcut).
  if (
    set.plannedLoadKind === "absolute" &&
    (set.plannedLoadKg === null ||
      set.actualLoadKg === null ||
      set.actualLoadKg < set.plannedLoadKg)
  )
    return false;
  return (
    set.actualValue >= set.plannedTargetMax && set.actualRir > set.plannedRirMax
  );
}
/** Set clearly below plan: value < target min and RIR < planned RIR min. */
function isBelowPlan(set: WorkoutSet): boolean {
  if (
    set.actualValue === null ||
    set.actualRir === null ||
    set.plannedRirMin === null
  )
    return false;
  // Failing with a heavier load than prescribed says nothing about the plan.
  if (
    set.plannedLoadKind === "absolute" &&
    (set.plannedLoadKg === null ||
      set.actualLoadKg === null ||
      set.actualLoadKg > set.plannedLoadKg)
  )
    return false;
  return (
    set.actualValue < set.plannedTargetMin && set.actualRir < set.plannedRirMin
  );
}

/**
 * One signal per prescription of the active program whose 3 most recent
 * completed sessions (matched by the recorded source prescription id, so a
 * new program revision starts a fresh window) all point the same way in
 * every completed set. Mixed data or fewer sessions: no signal.
 */
export function deriveProgressionSignals(
  program: TrainingProgram | null,
  sessions: readonly WorkoutSession[],
): readonly ProgressionSignal[] {
  if (!program) return [];
  const completed = sessions
    .filter((session) => session.status === "completed")
    .sort(
      (a, b) =>
        Date.parse(b.completedAt ?? b.startedAt) -
          Date.parse(a.completedAt ?? a.startedAt) || b.id.localeCompare(a.id),
    );
  const signals: ProgressionSignal[] = [];
  for (const block of program.blocks)
    for (const week of block.weeks)
      for (const day of week.days)
        for (const prescription of day.prescriptions) {
          const window = completed
            .map((session) => ({
              session,
              sets: session.exercises
                .filter(
                  (exercise) =>
                    exercise.sourceExercisePrescriptionId === prescription.id,
                )
                .flatMap((exercise) => exercise.sets)
                .filter((set) => set.status === "completed"),
            }))
            .filter((entry) => entry.sets.length > 0)
            .slice(0, PROGRESSION_SIGNAL_SESSION_COUNT);
          if (window.length < PROGRESSION_SIGNAL_SESSION_COUNT) continue;
          const sets = window.flatMap((entry) => entry.sets);
          const direction: ProgressionDirection | null = sets.every(isAbovePlan)
            ? "above_plan"
            : sets.every(isBelowPlan)
              ? "below_plan"
              : null;
          if (!direction) continue;
          const setSignals = [...prescription.sets]
            .sort((a, b) => a.sequence - b.sequence)
            .map((set): ProgressionSetSignal => ({
              prescriptionSetId: set.id,
              loadKind: set.loadKind,
              currentLoadKg: set.loadKg,
              suggestedLoadKg:
                set.loadKind === "absolute" && set.loadKg !== null
                  ? direction === "above_plan"
                    ? suggestedLoadIncrease(set.loadKg)
                    : suggestedLoadDecrease(set.loadKg)
                  : null,
            }));
          signals.push({
            version: PROGRESSION_SIGNALS_VERSION,
            trainingDayId: day.id,
            exercisePrescriptionId: prescription.id,
            exerciseId: prescription.exerciseId,
            exerciseName: prescription.exerciseName,
            direction,
            recommendation: setSignals.some((set) => set.suggestedLoadKg)
              ? "program_load_change"
              : "athlete_guidance",
            sessionIds: window.map((entry) => entry.session.id),
            completedSetCount: sets.length,
            sets: setSignals,
          });
        }
  return signals;
}

/**
 * Rule for an absolute-load action on a set: not covered when no progression
 * signal covers the set (other rules still apply); otherwise the signal
 * direction and the allowed range (null = athlete guidance only, no program
 * load change).
 */
export type ProgressionLoadRule =
  | Readonly<{ covered: false }>
  | Readonly<{
      covered: true;
      direction: ProgressionDirection;
      range: LoadRangeKg | null;
    }>;
export function progressionLoadRuleFor(
  signals: readonly ProgressionSignal[],
  prescriptionSetId: string,
): ProgressionLoadRule {
  for (const signal of signals)
    for (const set of signal.sets)
      if (set.prescriptionSetId === prescriptionSetId)
        return {
          covered: true,
          direction: signal.direction,
          range: set.suggestedLoadKg,
        };
  return { covered: false };
}
