import type {
  AthleteGoalRepository,
  AthleteProfileRepository,
  AthleteRepository,
  AuthRepository,
  AuthSession,
  BodyWeightHistoryReader,
  BodyWeightRepository,
  OnboardingRepository,
  SignUpResult,
  TrainingContextRepository,
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  GoalInput,
  ProfileInput,
  TrainingContextInput,
  AuthCredentials,
} from "@athlete-coach/application";
import type {
  AthleteGoal,
  AthleteIdentity,
  AthleteProfile,
  BodyWeightEntry,
  TrainingContext,
  Weekday,
} from "@athlete-coach/domain";
import {
  goalTypes,
  trainingConsistencies,
  trainingEnvironments,
} from "@athlete-coach/domain";
import { z } from "zod";

import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";

export class DataAccessError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataAccessError";
  }
}

function fail(message: string, cause: unknown): never {
  throw new DataAccessError(message, { cause });
}

const athleteRowSchema = z.object({
  id: z.uuid(),
  onboarding_completed_at: z.iso.datetime({ offset: true }).nullable(),
  user_id: z.uuid(),
});
const profileRowSchema = z.object({
  athlete_id: z.uuid(),
  birth_date: z.iso.date(),
  height_cm: z.number(),
  preferred_name: z.string(),
  timezone: z.string(),
});
const goalRowSchema = z.object({
  athlete_id: z.uuid(),
  goal_type: z.enum(goalTypes),
  id: z.uuid(),
  notes: z.string().nullable(),
  started_at: z.iso.datetime({ offset: true }),
  target_weight_kg: z.number().nullable(),
});
const trainingContextRowSchema = z.object({
  athlete_id: z.uuid(),
  average_sleep_minutes: z.number().int().nullable(),
  constraints_notes: z.string().nullable(),
  preferred_session_duration_minutes: z.number().int(),
  preferences_notes: z.string().nullable(),
  recent_training_consistency: z.enum(trainingConsistencies),
  resistance_training_months: z.number().int(),
  routine_summary: z.string(),
  training_environment: z.enum(trainingEnvironments),
});
const weightRowSchema = z.object({
  athlete_id: z.uuid(),
  id: z.uuid(),
  measured_at: z.iso.datetime({ offset: true }),
  source: z.literal("manual"),
  weight_kg: z.number(),
});

function parseExternal<T extends z.ZodType>(
  schema: T,
  input: unknown,
  message: string,
): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail(message, parsed.error);
  return parsed.data;
}

function mapSession(
  session: { user: { email?: string; id: string } } | null,
): AuthSession | null {
  return session
    ? { email: session.user.email ?? null, userId: session.user.id }
    : null;
}

function mapAthlete(input: unknown): AthleteIdentity {
  const row = parseExternal(
    athleteRowSchema,
    input,
    "A identidade retornada pelo servidor é inválida.",
  );
  return {
    id: row.id,
    onboardingCompletedAt: row.onboarding_completed_at,
    userId: row.user_id,
  };
}

function mapProfile(input: unknown): AthleteProfile {
  const row = parseExternal(
    profileRowSchema,
    input,
    "O perfil retornado pelo servidor é inválido.",
  );
  return {
    athleteId: row.athlete_id,
    birthDate: row.birth_date,
    heightCm: Number(row.height_cm),
    preferredName: row.preferred_name,
    timezone: row.timezone,
  };
}

function mapGoal(input: unknown): AthleteGoal {
  const row = parseExternal(
    goalRowSchema,
    input,
    "O objetivo retornado pelo servidor é inválido.",
  );
  return {
    athleteId: row.athlete_id,
    goalType: row.goal_type,
    id: row.id,
    notes: row.notes,
    startedAt: row.started_at,
    targetWeightKg:
      row.target_weight_kg === null ? null : Number(row.target_weight_kg),
  };
}

function mapTrainingContext(input: unknown): TrainingContext {
  const row = parseExternal(
    trainingContextRowSchema,
    input,
    "O contexto retornado pelo servidor é inválido.",
  );
  return {
    athleteId: row.athlete_id,
    averageSleepMinutes: row.average_sleep_minutes,
    constraintsNotes: row.constraints_notes,
    preferredSessionDurationMinutes: row.preferred_session_duration_minutes,
    preferencesNotes: row.preferences_notes,
    recentTrainingConsistency: row.recent_training_consistency,
    resistanceTrainingMonths: row.resistance_training_months,
    routineSummary: row.routine_summary,
    trainingEnvironment: row.training_environment,
  };
}

function mapWeight(input: unknown): BodyWeightEntry {
  const row = parseExternal(
    weightRowSchema,
    input,
    "A pesagem retornada pelo servidor é inválida.",
  );
  return {
    athleteId: row.athlete_id,
    id: row.id,
    measuredAt: row.measured_at,
    source: "manual",
    weightKg: Number(row.weight_kg),
  };
}

async function currentAthleteId(
  client: AthleteCoachSupabaseClient,
): Promise<string> {
  const { data, error } = await client.rpc("current_athlete_id");
  if (error || !data)
    fail("Não foi possível identificar o atleta atual.", error);
  return data;
}

export class SupabaseAuthRepository implements AuthRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) fail("Não foi possível restaurar a sessão.", error);
    return mapSession(data.session);
  }

  onSessionChange(listener: (session: AuthSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) =>
      listener(mapSession(session)),
    );
    return () => data.subscription.unsubscribe();
  }

  async signIn(credentials: AuthCredentials): Promise<AuthSession> {
    const { data, error } =
      await this.client.auth.signInWithPassword(credentials);
    if (error || !data.session)
      fail("Não foi possível entrar. Confira e-mail e senha.", error);
    return mapSession(data.session)!;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: "local" });
    if (error) fail("Não foi possível sair desta sessão.", error);
  }

  async signUp(credentials: AuthCredentials): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp(credentials);
    if (error) fail("Não foi possível criar a conta.", error);
    return {
      requiresEmailConfirmation: data.session === null,
      session: mapSession(data.session),
    };
  }
}

export class SupabaseAthleteRepository implements AthleteRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async ensureCurrent(): Promise<AthleteIdentity> {
    const { data, error } = await this.client.rpc("ensure_current_athlete");
    if (error || !data)
      fail("Não foi possível preparar a identidade do atleta.", error);
    return mapAthlete(data);
  }
}

export class SupabaseAthleteProfileRepository implements AthleteProfileRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getCurrent(): Promise<AthleteProfile | null> {
    const { data, error } = await this.client
      .from("athlete_profiles")
      .select("*")
      .maybeSingle();
    if (error) fail("Não foi possível carregar o perfil.", error);
    return data ? mapProfile(data) : null;
  }
  async updateCurrent(input: ProfileInput): Promise<AthleteProfile> {
    const athleteId = await currentAthleteId(this.client);
    const { data, error } = await this.client
      .from("athlete_profiles")
      .update({
        birth_date: input.birthDate,
        height_cm: input.heightCm,
        preferred_name: input.preferredName,
        timezone: input.timezone,
      })
      .eq("athlete_id", athleteId)
      .select()
      .single();
    if (error) fail("Não foi possível atualizar o perfil.", error);
    return mapProfile(data);
  }
}

export class SupabaseAthleteGoalRepository implements AthleteGoalRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getActive(): Promise<AthleteGoal | null> {
    const { data, error } = await this.client
      .from("athlete_goals")
      .select("*")
      .eq("status", "active")
      .maybeSingle();
    if (error) fail("Não foi possível carregar o objetivo.", error);
    return data ? mapGoal(data) : null;
  }
  async changeActive(input: GoalInput): Promise<AthleteGoal> {
    const { data, error } = await this.client.rpc(
      "change_current_athlete_goal",
      {
        p_goal_type: input.goalType,
        ...(input.goalNotes === undefined ? {} : { p_notes: input.goalNotes }),
        ...(input.targetWeightKg === undefined
          ? {}
          : { p_target_weight_kg: input.targetWeightKg }),
      },
    );
    if (error || !data) fail("Não foi possível alterar o objetivo.", error);
    return mapGoal(data);
  }
}

export class SupabaseTrainingContextRepository implements TrainingContextRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getCurrent(): Promise<TrainingContext | null> {
    const { data, error } = await this.client
      .from("athlete_training_contexts")
      .select("*")
      .maybeSingle();
    if (error) fail("Não foi possível carregar o contexto de treino.", error);
    return data ? mapTrainingContext(data) : null;
  }
  async getAvailability(): Promise<readonly Weekday[]> {
    const { data, error } = await this.client
      .from("athlete_training_availability")
      .select("weekday")
      .order("weekday");
    if (error) fail("Não foi possível carregar a disponibilidade.", error);
    return data.map(({ weekday }) => weekday as Weekday);
  }
  async updateCurrent(input: TrainingContextInput): Promise<TrainingContext> {
    const athleteId = await currentAthleteId(this.client);
    const { data, error } = await this.client
      .from("athlete_training_contexts")
      .update({
        average_sleep_minutes: input.averageSleepMinutes ?? null,
        constraints_notes: input.constraintsNotes ?? null,
        preferred_session_duration_minutes:
          input.preferredSessionDurationMinutes,
        preferences_notes: input.preferencesNotes ?? null,
        recent_training_consistency: input.recentTrainingConsistency,
        resistance_training_months: input.resistanceTrainingMonths,
        routine_summary: input.routineSummary,
        training_environment: input.trainingEnvironment,
      })
      .eq("athlete_id", athleteId)
      .select()
      .single();
    if (error) fail("Não foi possível atualizar o contexto de treino.", error);
    return mapTrainingContext(data);
  }
  async setAvailability(input: AvailabilityInput): Promise<readonly Weekday[]> {
    const { error } = await this.client.rpc(
      "set_current_training_availability",
      { p_available_weekdays: input.availableWeekdays },
    );
    if (error) fail("Não foi possível atualizar a disponibilidade.", error);
    return this.getAvailability();
  }
}

export class SupabaseBodyWeightRepository
  implements BodyWeightRepository, BodyWeightHistoryReader
{
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getLatest(): Promise<BodyWeightEntry | null> {
    const { data, error } = await this.client
      .from("body_weight_entries")
      .select("*")
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("Não foi possível carregar o peso mais recente.", error);
    return data ? mapWeight(data) : null;
  }
  async list(): Promise<readonly BodyWeightEntry[]> {
    const { data, error } = await this.client
      .from("body_weight_entries")
      .select("*")
      .order("measured_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) fail("Não foi possível carregar o histórico de peso.", error);
    return (data ?? []).map(mapWeight);
  }
  async record(input: BodyWeightInput): Promise<BodyWeightEntry> {
    const athleteId = await currentAthleteId(this.client);
    const { data, error } = await this.client
      .from("body_weight_entries")
      .insert({
        athlete_id: athleteId,
        measured_at: input.measuredAt,
        source: "manual",
        weight_kg: input.weightKg,
      })
      .select()
      .single();
    if (error) fail("Não foi possível registrar o peso.", error);
    return mapWeight(data);
  }
}

export class SupabaseOnboardingRepository implements OnboardingRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async complete(input: CompleteOnboardingInput): Promise<AthleteIdentity> {
    const { data, error } = await this.client.rpc(
      "complete_athlete_onboarding",
      {
        p_available_weekdays: input.availableWeekdays,
        p_birth_date: input.birthDate,
        p_goal_type: input.goalType,
        p_height_cm: input.heightCm,
        p_preferred_name: input.preferredName,
        p_preferred_session_duration_minutes:
          input.preferredSessionDurationMinutes,
        p_recent_training_consistency: input.recentTrainingConsistency,
        p_resistance_training_months: input.resistanceTrainingMonths,
        p_routine_summary: input.routineSummary,
        p_timezone: input.timezone,
        p_training_environment: input.trainingEnvironment,
        p_weight_kg: input.weightKg,
        p_weight_measured_at: input.measuredAt,
        ...(input.averageSleepMinutes === undefined
          ? {}
          : { p_average_sleep_minutes: input.averageSleepMinutes }),
        ...(input.constraintsNotes === undefined
          ? {}
          : { p_constraints_notes: input.constraintsNotes }),
        ...(input.goalNotes === undefined
          ? {}
          : { p_goal_notes: input.goalNotes }),
        ...(input.preferencesNotes === undefined
          ? {}
          : { p_preferences_notes: input.preferencesNotes }),
        ...(input.targetWeightKg === undefined
          ? {}
          : { p_target_weight_kg: input.targetWeightKg }),
      },
    );
    if (error || !data) fail("Não foi possível concluir o onboarding.", error);
    return mapAthlete(data);
  }
}
