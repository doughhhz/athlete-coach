import {
  deriveExercisePerformanceHistory,
  derivePerformanceOverview,
  derivePersonalBests,
  deriveSessionMetrics,
} from "@athlete-coach/domain";
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
