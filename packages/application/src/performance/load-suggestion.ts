import {
  plannedTrainingDaysPerWeek,
  suggestWorkoutLoads,
  type ExerciseLoadProfile,
  type ExerciseLoadSuggestion,
  type ExerciseSummary,
  type LoadEquipment,
  type WorkoutSession,
} from "@athlete-coach/domain";
import type { ExerciseCatalogRepository } from "../exercise/ports.ts";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type { PerformanceReadRepository } from "./ports.ts";

/**
 * Catalog equipment (Portuguese names, primary first) -> the family that
 * defines load steps. Accessories such as the bench do not define it.
 */
const EQUIPMENT_FAMILY: Readonly<Record<string, LoadEquipment>> = {
  Barra: "barbell",
  "Barra W": "barbell",
  "Máquina Smith": "barbell",
  Landmine: "barbell",
  Halter: "dumbbell",
  Kettlebell: "kettlebell",
  Cabo: "machine",
  "Máquina com placas": "machine",
  "Máquina com anilhas": "machine",
  "Peso corporal": "bodyweight",
  "Barra fixa": "bodyweight",
  "Faixa elástica": "bodyweight",
};
export function loadProfileFromCatalog(
  exercise: Pick<
    ExerciseSummary,
    "mechanics" | "primaryMuscleGroups" | "equipment"
  >,
): ExerciseLoadProfile {
  const family = exercise.equipment
    .map((name) => EQUIPMENT_FAMILY[name])
    .find((value) => value !== undefined);
  return {
    mechanics: exercise.mechanics,
    primaryMuscleGroups: exercise.primaryMuscleGroups,
    equipment: family ?? "other",
  };
}

/**
 * Working-load and warm-up suggestions for a workout (ADR-0131), from the
 * athlete's history, the active program and the exercise catalog.
 * Deterministic; no AI call.
 */
export class SuggestWorkoutLoads {
  private readonly performance: PerformanceReadRepository;
  private readonly programs: Pick<TrainingProgramRepository, "getActive">;
  private readonly catalog: Pick<ExerciseCatalogRepository, "list">;
  constructor(
    performance: PerformanceReadRepository,
    programs: Pick<TrainingProgramRepository, "getActive">,
    catalog: Pick<ExerciseCatalogRepository, "list">,
  ) {
    this.performance = performance;
    this.programs = programs;
    this.catalog = catalog;
  }
  async execute(
    input: Readonly<{ session: WorkoutSession; now?: Date }>,
  ): Promise<readonly ExerciseLoadSuggestion[]> {
    const [history, program, exercises] = await Promise.all([
      this.performance.listHistoricalSessions(),
      this.programs.getActive(),
      this.catalog.list(),
    ]);
    const used = new Set(
      input.session.exercises.map((exercise) => exercise.exerciseId),
    );
    const profiles = new Map(
      exercises
        .filter((exercise) => used.has(exercise.id))
        .map((exercise) => [exercise.id, loadProfileFromCatalog(exercise)]),
    );
    return suggestWorkoutLoads({
      session: input.session,
      history,
      profiles,
      plannedPerWeek: plannedTrainingDaysPerWeek(program),
      now: input.now ?? new Date(),
    });
  }
}
