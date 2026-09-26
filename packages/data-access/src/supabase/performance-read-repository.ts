import type { PerformanceReadRepository } from "@athlete-coach/application";
import type { WorkoutSession } from "@athlete-coach/domain";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";
import {
  mapWorkoutSession,
  workoutSessionSelectTree,
} from "./workout-session-repository.ts";

export class SupabasePerformanceReadRepository implements PerformanceReadRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async listHistoricalSessions(): Promise<readonly WorkoutSession[]> {
    const { data, error } = await this.client
      .from("workout_sessions")
      .select(workoutSessionSelectTree)
      .neq("status", "in_progress")
      .order("started_at", { ascending: true });
    if (error)
      throw new DataAccessError(
        "Não foi possível calcular o histórico de performance.",
        { cause: error },
      );
    return (data ?? []).map(mapWorkoutSession);
  }
  async getHistoricalSession(id: string): Promise<WorkoutSession | null> {
    const { data, error } = await this.client
      .from("workout_sessions")
      .select(workoutSessionSelectTree)
      .eq("id", id)
      .neq("status", "in_progress")
      .maybeSingle();
    if (error)
      throw new DataAccessError(
        "Não foi possível calcular o resumo do treino.",
        { cause: error },
      );
    return data ? mapWorkoutSession(data) : null;
  }
}
