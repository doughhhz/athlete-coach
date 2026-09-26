import type {
  RecordWorkoutSetInput,
  WorkoutSessionRepository,
} from "@athlete-coach/application";
import {
  loadPrescriptionKinds,
  targetMetrics,
  workoutSessionStatuses,
  workoutSetStatuses,
  type WorkoutSession,
  type WorkoutSessionSummary,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";
const setSchema = z.object({
  id: z.uuid(),
  source_prescription_set_id: z.uuid(),
  sequence: z.number().int(),
  status: z.enum(workoutSetStatuses),
  planned_metric: z.enum(targetMetrics),
  planned_target_min: z.number(),
  planned_target_max: z.number(),
  planned_rir_min: z.number().int().nullable(),
  planned_rir_max: z.number().int().nullable(),
  planned_rest_min_seconds: z.number().int().nullable(),
  planned_rest_max_seconds: z.number().int().nullable(),
  planned_tempo: z.string().nullable(),
  planned_load_kind: z.enum(loadPrescriptionKinds),
  planned_load_kg: z.number().nullable(),
  actual_value: z.number().nullable(),
  actual_load_kg: z.number().nullable(),
  actual_rir: z.number().int().nullable(),
  performed_at: z.iso.datetime({ offset: true }).nullable(),
  rest_started_at: z.iso.datetime({ offset: true }).nullable(),
  rest_ended_at: z.iso.datetime({ offset: true }).nullable(),
});
const exerciseSchema = z.object({
  id: z.uuid(),
  source_exercise_prescription_id: z.uuid(),
  exercise_id: z.uuid(),
  sequence: z.number().int(),
  exercise_name_snapshot: z.string(),
  planned_instructions: z.string().nullable(),
  planned_athlete_cues: z.string().nullable(),
  workout_sets: z.array(setSchema),
});
const sessionSchema = z.object({
  id: z.uuid(),
  athlete_id: z.uuid(),
  source_training_day_id: z.uuid(),
  program_name_snapshot: z.string(),
  day_name_snapshot: z.string(),
  status: z.enum(workoutSessionStatuses),
  athlete_notes: z.string().nullable(),
  started_at: z.iso.datetime({ offset: true }),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  abandoned_at: z.iso.datetime({ offset: true }).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  workout_exercises: z.array(exerciseSchema),
});
export const workoutSessionSelectTree =
  "id,athlete_id,source_training_day_id,program_name_snapshot,day_name_snapshot,status,athlete_notes,started_at,completed_at,abandoned_at,created_at,updated_at,workout_exercises(id,source_exercise_prescription_id,exercise_id,sequence,exercise_name_snapshot,planned_instructions,planned_athlete_cues,workout_sets(id,source_prescription_set_id,sequence,status,planned_metric,planned_target_min,planned_target_max,planned_rir_min,planned_rir_max,planned_rest_min_seconds,planned_rest_max_seconds,planned_tempo,planned_load_kind,planned_load_kg,actual_value,actual_load_kg,actual_rir,performed_at,rest_started_at,rest_ended_at))";
function fail(message: string, error: unknown): never {
  throw new DataAccessError(message, { cause: error });
}
export function mapWorkoutSession(input: unknown): WorkoutSession {
  const s = sessionSchema.parse(input);
  return {
    id: s.id,
    athleteId: s.athlete_id,
    sourceTrainingDayId: s.source_training_day_id,
    programName: s.program_name_snapshot,
    dayName: s.day_name_snapshot,
    status: s.status,
    athleteNotes: s.athlete_notes,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    abandonedAt: s.abandoned_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    exercises: s.workout_exercises
      .sort((a, b) => a.sequence - b.sequence)
      .map((e) => ({
        id: e.id,
        sourceExercisePrescriptionId: e.source_exercise_prescription_id,
        exerciseId: e.exercise_id,
        sequence: e.sequence,
        exerciseName: e.exercise_name_snapshot,
        plannedInstructions: e.planned_instructions,
        plannedAthleteCues: e.planned_athlete_cues,
        sets: e.workout_sets
          .sort((a, b) => a.sequence - b.sequence)
          .map((x) => ({
            id: x.id,
            sourcePrescriptionSetId: x.source_prescription_set_id,
            sequence: x.sequence,
            status: x.status,
            plannedMetric: x.planned_metric,
            plannedTargetMin: x.planned_target_min,
            plannedTargetMax: x.planned_target_max,
            plannedRirMin: x.planned_rir_min,
            plannedRirMax: x.planned_rir_max,
            plannedRestMinSeconds: x.planned_rest_min_seconds,
            plannedRestMaxSeconds: x.planned_rest_max_seconds,
            plannedTempo: x.planned_tempo,
            plannedLoadKind: x.planned_load_kind,
            plannedLoadKg: x.planned_load_kg,
            actualValue: x.actual_value,
            actualLoadKg: x.actual_load_kg,
            actualRir: x.actual_rir,
            performedAt: x.performed_at,
            restStartedAt: x.rest_started_at,
            restEndedAt: x.rest_ended_at,
          })),
      })),
  };
}
export class SupabaseWorkoutSessionRepository implements WorkoutSessionRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async start(trainingDayId: string) {
    const { data, error } = await this.client.rpc("start_workout_session", {
      p_training_day_id: trainingDayId,
    });
    if (error) fail("Não foi possível iniciar o treino.", error);
    return (await this.get(data))!;
  }
  async getInProgress() {
    const { data, error } = await this.client
      .from("workout_sessions")
      .select(workoutSessionSelectTree)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) fail("Não foi possível carregar o treino em andamento.", error);
    return data ? mapWorkoutSession(data) : null;
  }
  async get(id: string) {
    const { data, error } = await this.client
      .from("workout_sessions")
      .select(workoutSessionSelectTree)
      .eq("id", id)
      .maybeSingle();
    if (error) fail("Não foi possível carregar o treino.", error);
    return data ? mapWorkoutSession(data) : null;
  }
  async list(): Promise<readonly WorkoutSessionSummary[]> {
    const { data, error } = await this.client
      .from("workout_sessions")
      .select(workoutSessionSelectTree)
      .neq("status", "in_progress")
      .order("started_at", { ascending: false });
    if (error) fail("Não foi possível carregar o histórico.", error);
    return (data ?? []).map(mapWorkoutSession).map((s) => {
      const sets = s.exercises.flatMap((e) => e.sets),
        { exercises, ...rest } = s;
      return {
        ...rest,
        completedSetCount: sets.filter((x) => x.status === "completed").length,
        skippedSetCount: sets.filter((x) => x.status === "skipped").length,
        pendingSetCount: sets.filter((x) => x.status === "pending").length,
      };
    });
  }
  async recordSet(setId: string, input: RecordWorkoutSetInput) {
    const { error } = await this.client.rpc("record_workout_set", {
      p_set_id: setId,
      p_actual_value: input.actualValue,
      ...(input.actualLoadKg === null
        ? {}
        : { p_actual_load_kg: input.actualLoadKg }),
      ...(input.actualRir === null ? {} : { p_actual_rir: input.actualRir }),
      ...(input.restStartedAt
        ? { p_rest_started_at: input.restStartedAt }
        : {}),
      ...(input.restEndedAt ? { p_rest_ended_at: input.restEndedAt } : {}),
    });
    if (error)
      fail(
        "A série não foi salva. Seus valores continuam na tela; tente novamente.",
        error,
      );
    return this.findBySet(setId);
  }
  async skipSet(setId: string) {
    const { error } = await this.client.rpc("skip_workout_set", {
      p_set_id: setId,
    });
    if (error) fail("Não foi possível pular a série.", error);
    return this.findBySet(setId);
  }
  async complete(id: string) {
    return this.transition("complete_workout_session", id);
  }
  async abandon(id: string) {
    return this.transition("abandon_workout_session", id);
  }
  private async findBySet(setId: string) {
    const { data, error } = await this.client
      .from("workout_exercises")
      .select("workout_session_id,workout_sets!inner(id)")
      .eq("workout_sets.id", setId)
      .single();
    if (error) fail("Não foi possível recarregar o treino.", error);
    return (await this.get(data.workout_session_id))!;
  }
  private async transition(
    name: "complete_workout_session" | "abandon_workout_session",
    id: string,
  ) {
    const { error } = await this.client.rpc(name, { p_session_id: id });
    if (error) fail("Não foi possível encerrar o treino.", error);
    return (await this.get(id))!;
  }
}
