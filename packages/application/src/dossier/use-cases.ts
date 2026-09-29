import {
  buildAthleteTrainingDossier,
  type ExerciseReplacementContext,
  type IndividualResponseMemory,
  type InterventionHistory,
} from "@athlete-coach/domain";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type { WorkoutSessionRepository } from "../workout/ports.ts";
import type { PerformanceReadRepository } from "../performance/ports.ts";

export interface AthleteSnapshotLoader {
  execute(): ReturnType<
    import("../athlete/use-cases.ts").LoadCurrentAthleteProfile["execute"]
  >;
}

/** Supplies dossier v3 intervention sections from one outcome computation. */
export interface InterventionContextLoader {
  execute(): Promise<
    Readonly<{
      interventionHistory: InterventionHistory;
      responseMemory: IndividualResponseMemory;
    }>
  >;
}

/** Bounded replacement candidates for the active program's exercises. */
export interface ReplacementCandidateLoader {
  execute(exerciseIds: readonly string[]): Promise<ExerciseReplacementContext>;
}

export class BuildAthleteTrainingDossier {
  private readonly profile: AthleteSnapshotLoader;
  private readonly programs: TrainingProgramRepository;
  private readonly workouts: WorkoutSessionRepository;
  private readonly performance: PerformanceReadRepository;
  private readonly now: () => Date;
  private readonly interventionContext: InterventionContextLoader | null;
  private readonly replacementCandidates: ReplacementCandidateLoader | null;
  constructor(
    profile: AthleteSnapshotLoader,
    programs: TrainingProgramRepository,
    workouts: WorkoutSessionRepository,
    performance: PerformanceReadRepository,
    now: () => Date = () => new Date(),
    interventionContext: InterventionContextLoader | null = null,
    replacementCandidates: ReplacementCandidateLoader | null = null,
  ) {
    this.profile = profile;
    this.programs = programs;
    this.workouts = workouts;
    this.performance = performance;
    this.now = now;
    this.interventionContext = interventionContext;
    this.replacementCandidates = replacementCandidates;
  }
  async execute() {
    const [snapshot, activeProgram, historical, inProgress, context] =
      await Promise.all([
        this.profile.execute(),
        this.programs.getActive(),
        this.performance.listHistoricalSessions(),
        this.workouts.getInProgress(),
        this.interventionContext?.execute() ?? Promise.resolve(null),
      ]);
    const sessions = inProgress ? [...historical, inProgress] : historical;
    const programExerciseIds =
      activeProgram?.blocks.flatMap((block) =>
        block.weeks.flatMap((week) =>
          week.days.flatMap((day) =>
            day.prescriptions.map((prescription) => prescription.exerciseId),
          ),
        ),
      ) ?? [];
    const exerciseReplacementCandidates = this.replacementCandidates
      ? await this.replacementCandidates.execute(programExerciseIds)
      : null;
    return buildAthleteTrainingDossier({
      snapshot,
      activeProgram,
      sessions,
      generatedAt: this.now().toISOString(),
      interventionHistory: context?.interventionHistory ?? null,
      responseMemory: context?.responseMemory ?? null,
      exerciseReplacementCandidates,
    });
  }
}

export class GetLongitudinalTrainingSignals {
  private readonly dossier: BuildAthleteTrainingDossier;
  constructor(dossier: BuildAthleteTrainingDossier) {
    this.dossier = dossier;
  }
  async execute() {
    const dossier = await this.dossier.execute();
    return {
      windows: dossier.windows,
      exerciseSignals: dossier.exerciseSignals,
      dataCoverageLast28Days: dossier.dataCoverageLast28Days,
    };
  }
}
