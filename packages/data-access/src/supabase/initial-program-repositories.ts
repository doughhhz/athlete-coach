import type {
  InitialProgramGenerationEntry,
  InitialProgramGenerationLog,
  ProgramCatalogReader,
  ProgramIntakeInput,
  ProgramIntakeRepository,
} from "@athlete-coach/application";
import type {
  ProgramCatalogExercise,
  ProgramIntake,
} from "@athlete-coach/domain";
import {
  exerciseDifficulties,
  exerciseLateralities,
  exerciseMechanics,
  movementPatterns,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";

function fail(message: string, cause: unknown): never {
  throw new DataAccessError(message, { cause });
}
function parsed<T extends z.ZodType>(
  schema: T,
  input: unknown,
  message: string,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) fail(message, result.error);
  return result.data;
}

const intakeRowSchema = z.object({
  athlete_id: z.uuid(),
  current_pain_or_injury: z.boolean(),
  pain_or_injury_notes: z.string().nullable(),
  medical_exercise_restriction: z.boolean(),
  preferred_exercises_notes: z.string().nullable(),
  avoided_exercises_notes: z.string().nullable(),
  other_sports_notes: z.string().nullable(),
  available_equipment: z.array(z.string()).nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});
function mapIntake(input: unknown): ProgramIntake {
  const row = parsed(
    intakeRowSchema,
    input,
    "As respostas retornadas pelo servidor são inválidas.",
  );
  return {
    athleteId: row.athlete_id,
    currentPainOrInjury: row.current_pain_or_injury,
    painOrInjuryNotes: row.pain_or_injury_notes,
    medicalExerciseRestriction: row.medical_exercise_restriction,
    preferredExercisesNotes: row.preferred_exercises_notes,
    avoidedExercisesNotes: row.avoided_exercises_notes,
    otherSportsNotes: row.other_sports_notes,
    availableEquipment: row.available_equipment,
    updatedAt: row.updated_at,
  };
}

/** Athlete-owned answers before the first program (RLS, caller JWT). */
export class SupabaseProgramIntakeRepository implements ProgramIntakeRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getCurrent(): Promise<ProgramIntake | null> {
    const { data, error } = await this.client
      .from("athlete_program_intakes")
      .select("*")
      .maybeSingle();
    if (error) fail("Não foi possível carregar suas respostas.", error);
    return data ? mapIntake(data) : null;
  }
  async saveCurrent(input: ProgramIntakeInput): Promise<ProgramIntake> {
    const { data: athleteId, error: athleteError } =
      await this.client.rpc("current_athlete_id");
    if (athleteError || !athleteId)
      fail("Não foi possível identificar o atleta atual.", athleteError);
    const { data, error } = await this.client
      .from("athlete_program_intakes")
      .upsert({
        athlete_id: athleteId,
        current_pain_or_injury: input.currentPainOrInjury,
        pain_or_injury_notes: input.painOrInjuryNotes ?? null,
        medical_exercise_restriction: input.medicalExerciseRestriction,
        preferred_exercises_notes: input.preferredExercisesNotes ?? null,
        avoided_exercises_notes: input.avoidedExercisesNotes ?? null,
        other_sports_notes: input.otherSportsNotes ?? null,
        // An empty selection means "not informed".
        available_equipment: input.availableEquipment?.length
          ? [...new Set(input.availableEquipment)].sort()
          : null,
      })
      .select()
      .single();
    if (error) fail("Não foi possível salvar suas respostas.", error);
    return mapIntake(data);
  }
}

const catalogRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name_pt: z.string(),
  movement_pattern: z.enum(movementPatterns),
  mechanics: z.enum(exerciseMechanics),
  laterality: z.enum(exerciseLateralities),
  difficulty: z.enum(exerciseDifficulties).nullable(),
  exercise_equipment: z.array(
    z.object({ equipment: z.object({ slug: z.string() }) }),
  ),
});
/** Active catalog with equipment slugs, for initial program generation. */
export class SupabaseProgramCatalogReader implements ProgramCatalogReader {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async listForProgram(): Promise<readonly ProgramCatalogExercise[]> {
    const { data, error } = await this.client
      .from("exercises")
      .select(
        "id,slug,name_pt,movement_pattern,mechanics,laterality,difficulty,exercise_equipment(equipment(slug))",
      )
      .eq("is_active", true)
      .order("slug");
    if (error)
      fail("Não foi possível carregar o catálogo de exercícios.", error);
    return parsed(
      z.array(catalogRowSchema),
      data,
      "O catálogo retornado pelo servidor é inválido.",
    ).map((row) => ({
      id: row.id,
      slug: row.slug,
      namePt: row.name_pt,
      movementPattern: row.movement_pattern,
      mechanics: row.mechanics,
      laterality: row.laterality,
      difficulty: row.difficulty,
      equipmentSlugs: row.exercise_equipment
        .map((item) => item.equipment.slug)
        .sort(),
    }));
  }
}

/**
 * Backend-owned audit, written with the service role for the authenticated
 * user only; the database also requires the program to be that athlete's.
 */
export class SupabaseInitialProgramGenerationLog implements InitialProgramGenerationLog {
  private readonly client: AthleteCoachSupabaseClient;
  private readonly userId: string;
  constructor(serviceClient: AthleteCoachSupabaseClient, userId: string) {
    this.client = serviceClient;
    this.userId = userId;
  }
  async record(entry: InitialProgramGenerationEntry): Promise<void> {
    const { data: athlete, error: athleteError } = await this.client
      .from("athletes")
      .select("id")
      .eq("user_id", this.userId)
      .single();
    if (athleteError || !athlete)
      fail("Não foi possível identificar o atleta atual.", athleteError);
    const { error } = await this.client
      .from("initial_program_generations")
      .insert({
        athlete_id: athlete.id,
        program_id: entry.programId,
        origin: entry.origin,
        provider: entry.provider,
        model: entry.model,
        prompt_version: entry.promptVersion,
        envelope_version: entry.envelopeVersion,
        spec_version: entry.specVersion,
        repaired: entry.repaired,
      });
    if (error) fail("Não foi possível registrar a geração do programa.", error);
  }
}
