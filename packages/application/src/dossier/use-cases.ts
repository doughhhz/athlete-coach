import { buildAthleteTrainingDossier } from "@athlete-coach/domain";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type { WorkoutSessionRepository } from "../workout/ports.ts";
import type { PerformanceReadRepository } from "../performance/ports.ts";

export interface AthleteSnapshotLoader {
  execute(): ReturnType<
    import("../athlete/use-cases.ts").LoadCurrentAthleteProfile["execute"]
  >;
}

export class BuildAthleteTrainingDossier {
  private readonly profile: AthleteSnapshotLoader;
  private readonly programs: TrainingProgramRepository;
  private readonly workouts: WorkoutSessionRepository;
  private readonly performance: PerformanceReadRepository;
  private readonly now: () => Date;
  constructor(
    profile: AthleteSnapshotLoader,
    programs: TrainingProgramRepository,
    workouts: WorkoutSessionRepository,
    performance: PerformanceReadRepository,
    now: () => Date = () => new Date(),
  ) {
    this.profile = profile;
    this.programs = programs;
    this.workouts = workouts;
    this.performance = performance;
    this.now = now;
  }
  async execute() {
    const [snapshot, activeProgram, historical, inProgress] = await Promise.all(
      [
        this.profile.execute(),
        this.programs.getActive(),
        this.performance.listHistoricalSessions(),
        this.workouts.getInProgress(),
      ],
    );
    const sessions = inProgress ? [...historical, inProgress] : historical;
    return buildAthleteTrainingDossier({
      snapshot,
      activeProgram,
      sessions,
      generatedAt: this.now().toISOString(),
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
