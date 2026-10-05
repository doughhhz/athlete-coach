import {
  assessWorkoutSet,
  deriveExercisePerformanceHistory,
  derivePerformanceOverview,
  derivePersonalBests,
  deriveSessionMetrics,
  plannedTrainingDaysPerWeek,
  type SetAssessment,
  type WorkoutSession,
} from "@athlete-coach/domain";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type { PerformanceReadRepository } from "./ports.ts";

class PerformanceUseCase {
  protected readonly repository: PerformanceReadRepository;
  constructor(repository: PerformanceReadRepository) {
    this.repository = repository;
  }
}
export class GetPerformanceOverview extends PerformanceUseCase {
  async execute() {
    return derivePerformanceOverview(
      await this.repository.listHistoricalSessions(),
    );
  }
}
export class GetExercisePerformanceHistory extends PerformanceUseCase {
  async execute(exerciseId?: string) {
    return deriveExercisePerformanceHistory(
      await this.repository.listHistoricalSessions(),
      exerciseId,
    );
  }
}
export class GetExercisePersonalBests extends PerformanceUseCase {
  async execute() {
    return derivePersonalBests(
      deriveExercisePerformanceHistory(
        await this.repository.listHistoricalSessions(),
      ),
    );
  }
}
export class GetWorkoutDerivedSummary extends PerformanceUseCase {
  async execute(sessionId: string) {
    const session = await this.repository.getHistoricalSession(sessionId);
    if (!session) return null;
    const points = deriveExercisePerformanceHistory(
      await this.repository.listHistoricalSessions(),
    );
    return {
      metrics: deriveSessionMetrics(session),
      personalRecordEvents: points.filter(
        (point) =>
          point.workoutSessionId === sessionId &&
          (point.isNewMaxLoggedLoad || point.isNewEstimatedOneRepMax),
      ),
    };
  }
}

/**
 * Per-set assessment (ADR-0130): the set just recorded, against today's
 * earlier sets, the athlete's history and the planned week. Deterministic;
 * no AI call. The current session comes from the caller (just saved).
 */
export class AssessWorkoutSet extends PerformanceUseCase {
  private readonly programs: Pick<TrainingProgramRepository, "getActive">;
  constructor(
    repository: PerformanceReadRepository,
    programs: Pick<TrainingProgramRepository, "getActive">,
  ) {
    super(repository);
    this.programs = programs;
  }
  async execute(
    input: Readonly<{
      session: WorkoutSession;
      workoutSetId: string;
      now?: Date;
    }>,
  ): Promise<SetAssessment | null> {
    const [history, program] = await Promise.all([
      this.repository.listHistoricalSessions(),
      this.programs.getActive(),
    ]);
    return assessWorkoutSet({
      session: input.session,
      workoutSetId: input.workoutSetId,
      history,
      plannedPerWeek: plannedTrainingDaysPerWeek(program),
      now: input.now ?? new Date(),
    });
  }
}
