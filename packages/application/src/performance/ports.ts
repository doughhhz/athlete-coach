import type { WorkoutSession } from "@athlete-coach/domain";

export interface PerformanceReadRepository {
  listHistoricalSessions(): Promise<readonly WorkoutSession[]>;
  getHistoricalSession(id: string): Promise<WorkoutSession | null>;
}
