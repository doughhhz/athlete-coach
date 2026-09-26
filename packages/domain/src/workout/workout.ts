import type {
  LoadPrescriptionKind,
  TargetMetric,
} from "../training/training.ts";

export const workoutSessionStatuses = [
  "in_progress",
  "completed",
  "abandoned",
] as const;
export type WorkoutSessionStatus = (typeof workoutSessionStatuses)[number];
export const workoutSetStatuses = ["pending", "completed", "skipped"] as const;
export type WorkoutSetStatus = (typeof workoutSetStatuses)[number];

export type WorkoutSet = Readonly<{
  id: string;
  sourcePrescriptionSetId: string;
  sequence: number;
  status: WorkoutSetStatus;
  plannedMetric: TargetMetric;
  plannedTargetMin: number;
  plannedTargetMax: number;
  plannedRirMin: number | null;
  plannedRirMax: number | null;
  plannedRestMinSeconds: number | null;
  plannedRestMaxSeconds: number | null;
  plannedTempo: string | null;
  plannedLoadKind: LoadPrescriptionKind;
  plannedLoadKg: number | null;
  actualValue: number | null;
  actualLoadKg: number | null;
  actualRir: number | null;
  performedAt: string | null;
  restStartedAt: string | null;
  restEndedAt: string | null;
}>;
export type WorkoutExercise = Readonly<{
  id: string;
  sourceExercisePrescriptionId: string;
  exerciseId: string;
  sequence: number;
  exerciseName: string;
  plannedInstructions: string | null;
  plannedAthleteCues: string | null;
  sets: readonly WorkoutSet[];
}>;
export type WorkoutSession = Readonly<{
  id: string;
  athleteId: string;
  sourceTrainingDayId: string;
  programName: string;
  dayName: string;
  status: WorkoutSessionStatus;
  athleteNotes: string | null;
  startedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: readonly WorkoutExercise[];
}>;
export type WorkoutSessionSummary = Omit<WorkoutSession, "exercises"> &
  Readonly<{
    completedSetCount: number;
    skippedSetCount: number;
    pendingSetCount: number;
  }>;
export type RecordWorkoutSetPerformance = Readonly<{
  actualValue: number;
  actualLoadKg: number | null;
  actualRir: number | null;
  restStartedAt?: string | null | undefined;
  restEndedAt?: string | null | undefined;
}>;

export function assertWorkoutSetPerformance(
  metric: TargetMetric,
  input: RecordWorkoutSetPerformance,
): void {
  if (!Number.isFinite(input.actualValue) || input.actualValue <= 0)
    throw new Error("actualValue must be positive.");
  if (metric === "reps" && !Number.isInteger(input.actualValue))
    throw new Error("Repetitions must be an integer.");
  if (
    input.actualLoadKg !== null &&
    (!Number.isFinite(input.actualLoadKg) || input.actualLoadKg < 0)
  )
    throw new Error("actualLoadKg must be non-negative.");
  if (
    input.actualRir !== null &&
    (!Number.isInteger(input.actualRir) ||
      input.actualRir < 0 ||
      input.actualRir > 10)
  )
    throw new Error("actualRir must be between 0 and 10.");
}
export function canCompleteWorkout(session: WorkoutSession): boolean {
  return (
    session.status === "in_progress" &&
    session.exercises.length > 0 &&
    session.exercises.every(
      (exercise) =>
        exercise.sets.length > 0 &&
        exercise.sets.every((set) => set.status !== "pending"),
    )
  );
}
export function canTransitionWorkout(
  from: WorkoutSessionStatus,
  to: WorkoutSessionStatus,
): boolean {
  return from === "in_progress" && (to === "completed" || to === "abandoned");
}
export function workoutDurationSeconds(
  session: WorkoutSession,
  now = new Date(),
): number {
  const end = session.completedAt ?? session.abandonedAt ?? now.toISOString();
  return Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(session.startedAt)) / 1000),
  );
}
