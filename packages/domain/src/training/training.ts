export const programStatuses = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export type ProgramStatus = (typeof programStatuses)[number];
export const targetMetrics = ["reps", "seconds", "meters"] as const;
export type TargetMetric = (typeof targetMetrics)[number];
export const loadPrescriptionKinds = [
  "unprescribed",
  "athlete_selected",
  "absolute",
] as const;
export type LoadPrescriptionKind = (typeof loadPrescriptionKinds)[number];

export type PrescriptionSet = Readonly<{
  id: string;
  /**
   * Stable structural identity across revisions (Implementation Phase 18,
   * ADR-0091). Absent/null = unknown (legacy or not yet materialized).
   */
  lineageId?: string | null;
  sequence: number;
  targetMetric: TargetMetric;
  targetMin: number;
  targetMax: number;
  rirMin: number | null;
  rirMax: number | null;
  restMinSeconds: number | null;
  restMaxSeconds: number | null;
  tempo: string | null;
  loadKind: LoadPrescriptionKind;
  loadKg: number | null;
}>;
export type ExercisePrescription = Readonly<{
  id: string;
  /**
   * Stable structural identity across revisions (Implementation Phase 18,
   * ADR-0091). Absent/null = unknown (legacy or not yet materialized).
   */
  lineageId?: string | null;
  exerciseId: string;
  exerciseName: string;
  sequence: number;
  instructions: string | null;
  athleteCues: string | null;
  sets: readonly PrescriptionSet[];
}>;
export type TrainingDay = Readonly<{
  id: string;
  /**
   * Stable structural identity across revisions (Implementation Phase 18,
   * ADR-0091). Absent/null = unknown (legacy or not yet materialized).
   */
  lineageId?: string | null;
  sequence: number;
  name: string;
  preferredWeekday: number | null;
  notes: string | null;
  prescriptions: readonly ExercisePrescription[];
}>;
export type TrainingWeek = Readonly<{
  id: string;
  /**
   * Stable structural identity across revisions (Implementation Phase 18,
   * ADR-0091). Absent/null = unknown (legacy or not yet materialized).
   */
  lineageId?: string | null;
  sequence: number;
  name: string | null;
  notes: string | null;
  days: readonly TrainingDay[];
}>;
export type TrainingBlock = Readonly<{
  id: string;
  /**
   * Stable structural identity across revisions (Implementation Phase 18,
   * ADR-0091). Absent/null = unknown (legacy or not yet materialized).
   */
  lineageId?: string | null;
  sequence: number;
  name: string;
  description: string | null;
  weeks: readonly TrainingWeek[];
}>;
export type TrainingProgram = Readonly<{
  id: string;
  /**
   * True when this revision preserved lineage from its source (created after
   * Implementation Phase 18). Absent/false = legacy: continuity unknown.
   */
  lineageTracked?: boolean;
  athleteId: string;
  athleteGoalId: string | null;
  name: string;
  description: string | null;
  status: ProgramStatus;
  revision: number;
  supersedesProgramId: string | null;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  blocks: readonly TrainingBlock[];
}>;
export type TrainingProgramSummary = Omit<TrainingProgram, "blocks"> &
  Readonly<{ blockCount: number; weekCount: number; dayCount: number }>;

export function assertPositiveSequence(sequence: number): void {
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new Error("sequence must be a positive integer.");
}
export function assertPrescriptionSet(
  input: Omit<PrescriptionSet, "id">,
): void {
  assertPositiveSequence(input.sequence);
  if (!targetMetrics.includes(input.targetMetric))
    throw new Error("targetMetric is invalid.");
  if (
    !Number.isFinite(input.targetMin) ||
    input.targetMin <= 0 ||
    input.targetMax < input.targetMin
  )
    throw new Error("target range is invalid.");
  if (
    (input.rirMin === null) !== (input.rirMax === null) ||
    (input.rirMin !== null &&
      (input.rirMin < 0 || input.rirMax! > 10 || input.rirMax! < input.rirMin))
  )
    throw new Error("RIR range is invalid.");
  if (
    (input.restMinSeconds === null) !== (input.restMaxSeconds === null) ||
    (input.restMinSeconds !== null &&
      (input.restMinSeconds < 0 ||
        input.restMaxSeconds! < input.restMinSeconds))
  )
    throw new Error("rest range is invalid.");
  if (
    input.tempo !== null &&
    !/^([0-9X])-([0-9X])-([0-9X])-([0-9X])$/.test(input.tempo)
  )
    throw new Error("tempo must use four phases such as 3-1-X-0.");
  if (
    !loadPrescriptionKinds.includes(input.loadKind) ||
    (input.loadKind === "absolute"
      ? input.loadKg === null || input.loadKg <= 0
      : input.loadKg !== null)
  )
    throw new Error("load prescription is inconsistent.");
}
export function canTransitionProgram(
  from: ProgramStatus,
  to: ProgramStatus,
): boolean {
  return (
    (from === "draft" && (to === "active" || to === "archived")) ||
    (from === "active" && (to === "completed" || to === "archived")) ||
    (from === "completed" && to === "archived")
  );
}
export function assertActivatable(program: TrainingProgram): void {
  if (program.status !== "draft")
    throw new Error("Only a draft can be activated.");
  if (
    !program.blocks.length ||
    program.blocks.some(
      (b) =>
        !b.weeks.length ||
        b.weeks.some(
          (w) =>
            !w.days.length ||
            w.days.some(
              (d) =>
                !d.prescriptions.length ||
                d.prescriptions.some((p) => !p.sets.length),
            ),
        ),
    )
  )
    throw new Error("Program structure is incomplete.");
}

/**
 * A program may be deleted unless it is the active one (archive or complete
 * it first). History is protected by the database: programs with workouts,
 * Coach decisions or later revisions cannot be deleted (ADR-0125).
 */
export function canDeleteTrainingProgram(
  program: Pick<TrainingProgram, "status">,
): boolean {
  return program.status !== "active";
}
