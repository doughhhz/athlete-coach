import type {
  AnatomyRepository,
  ExerciseCatalogRepository,
} from "@athlete-coach/application";
import type {
  Equipment,
  ExerciseCatalogFacets,
  ExerciseDetails,
  ExerciseSummary,
  Muscle,
  MuscleGroup,
} from "@athlete-coach/domain";
import {
  exerciseDifficulties,
  exerciseLateralities,
  exerciseMechanics,
  exerciseRelationTypes,
  instructionSections,
  movementPatterns,
  muscleRoles,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";

const summarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name_pt: z.string(),
  name_en: z.string(),
  short_description_pt: z.string(),
  movement_pattern: z.enum(movementPatterns),
  mechanics: z.enum(exerciseMechanics),
  laterality: z.enum(exerciseLateralities),
  difficulty: z.enum(exerciseDifficulties).nullable(),
  primary_muscles: z.array(z.string()),
  primary_muscle_groups: z.array(z.string()),
  equipment: z.array(z.string()),
});
const exerciseSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name_pt: z.string(),
  name_en: z.string(),
  short_description_pt: z.string(),
  movement_pattern: z.enum(movementPatterns),
  mechanics: z.enum(exerciseMechanics),
  laterality: z.enum(exerciseLateralities),
  difficulty: z.enum(exerciseDifficulties).nullable(),
  is_active: z.boolean(),
});
const groupSchema = z.object({
  id: z.uuid(),
  body_region_id: z.uuid(),
  slug: z.string(),
  name_en: z.string(),
  name_pt: z.string(),
  description: z.string().nullable(),
});
const muscleSchema = z.object({
  id: z.uuid(),
  muscle_group_id: z.uuid(),
  slug: z.string(),
  name_en: z.string(),
  name_pt: z.string(),
  anatomical_name: z.string().nullable(),
  description: z.string().nullable(),
});
const equipmentSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name_en: z.string(),
  name_pt: z.string(),
});
const instructionSchema = z.object({
  section: z.enum(instructionSections),
  sort_order: z.number().int(),
  content_pt: z.string(),
});
const muscleLinkSchema = z.object({
  role: z.enum(muscleRoles),
  muscles: muscleSchema.extend({ muscle_groups: groupSchema }),
});
const relationSchema = z.object({
  relation_type: z.enum(exerciseRelationTypes),
  note_pt: z.string().nullable(),
  exercises: z.object({
    id: z.uuid(),
    slug: z.string(),
    name_pt: z.string(),
    name_en: z.string(),
  }),
});
const aliasSchema = z.object({ alias: z.string() });

function parsed<T extends z.ZodType>(
  schema: T,
  value: unknown,
  message: string,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new DataAccessError(message, { cause: result.error });
  return result.data;
}
function mapGroup(row: z.infer<typeof groupSchema>): MuscleGroup {
  return {
    id: row.id,
    bodyRegionId: row.body_region_id,
    slug: row.slug,
    nameEn: row.name_en,
    namePt: row.name_pt,
    description: row.description,
  };
}
function mapMuscle(row: z.infer<typeof muscleSchema>): Muscle {
  return {
    id: row.id,
    muscleGroupId: row.muscle_group_id,
    slug: row.slug,
    nameEn: row.name_en,
    namePt: row.name_pt,
    anatomicalName: row.anatomical_name,
    description: row.description,
  };
}
function mapEquipment(row: z.infer<typeof equipmentSchema>): Equipment {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    namePt: row.name_pt,
  };
}

export class SupabaseExerciseCatalogRepository implements ExerciseCatalogRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async list(
    filters: Parameters<ExerciseCatalogRepository["list"]>[0] = {},
  ): Promise<readonly ExerciseSummary[]> {
    const { data, error } = await this.client.rpc("search_exercise_catalog", {
      ...(filters.query === undefined ? {} : { p_query: filters.query }),
      ...(filters.muscleGroupSlug === undefined
        ? {}
        : { p_muscle_group_slug: filters.muscleGroupSlug }),
      ...(filters.muscleSlug === undefined
        ? {}
        : { p_muscle_slug: filters.muscleSlug }),
      ...(filters.equipmentSlug === undefined
        ? {}
        : { p_equipment_slug: filters.equipmentSlug }),
      ...(filters.movementPattern === undefined
        ? {}
        : { p_movement_pattern: filters.movementPattern }),
    });
    if (error)
      throw new DataAccessError(
        "Não foi possível carregar a biblioteca de exercícios.",
        { cause: error },
      );
    return parsed(
      z.array(summarySchema),
      data,
      "O catálogo retornado pelo servidor é inválido.",
    ).map((row) => ({
      ...exerciseSchema.parse({ ...row, is_active: true }),
      namePt: row.name_pt,
      nameEn: row.name_en,
      shortDescriptionPt: row.short_description_pt,
      movementPattern: row.movement_pattern,
      primaryMuscles: row.primary_muscles,
      primaryMuscleGroups: row.primary_muscle_groups,
      equipment: row.equipment,
      isActive: true,
    }));
  }
  async getBySlug(slug: string): Promise<ExerciseDetails | null> {
    const base = await this.client
      .from("exercises")
      .select(
        "id,slug,name_pt,name_en,short_description_pt,movement_pattern,mechanics,laterality,difficulty,is_active",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (base.error)
      throw new DataAccessError("Não foi possível carregar o exercício.", {
        cause: base.error,
      });
    if (!base.data) return null;
    const exercise = parsed(
      exerciseSchema,
      base.data,
      "O exercício retornado é inválido.",
    );
    const [aliases, muscles, equipment, instructions, relations, media] =
      await Promise.all([
        this.client
          .from("exercise_aliases")
          .select("alias")
          .eq("exercise_id", exercise.id)
          .order("alias"),
        this.client
          .from("exercise_muscles")
          .select(
            "role,muscles!inner(id,muscle_group_id,slug,name_en,name_pt,anatomical_name,description,muscle_groups!inner(id,body_region_id,slug,name_en,name_pt,description))",
          )
          .eq("exercise_id", exercise.id)
          .order("role")
          .order("sort_order"),
        this.client
          .from("exercise_equipment")
          .select("equipment!inner(id,slug,name_en,name_pt)")
          .eq("exercise_id", exercise.id)
          .order("is_primary", { ascending: false }),
        this.client
          .from("exercise_instruction_steps")
          .select("section,sort_order,content_pt")
          .eq("exercise_id", exercise.id)
          .order("section")
          .order("sort_order"),
        this.client
          .from("exercise_relations")
          .select(
            "relation_type,note_pt,exercises!exercise_relations_target_exercise_id_fkey(id,slug,name_pt,name_en)",
          )
          .eq("source_exercise_id", exercise.id)
          .order("relation_type"),
        this.client
          .from("exercise_media")
          .select("id", { count: "exact", head: true })
          .eq("exercise_id", exercise.id),
      ]);
    const failure = [
      aliases,
      muscles,
      equipment,
      instructions,
      relations,
      media,
    ].find((result) => result.error);
    if (failure?.error)
      throw new DataAccessError(
        "Não foi possível carregar os detalhes do exercício.",
        { cause: failure.error },
      );
    const equipmentRows = parsed(
      z.array(z.object({ equipment: equipmentSchema })),
      equipment.data,
      "Equipamentos inválidos.",
    );
    return {
      id: exercise.id,
      slug: exercise.slug,
      namePt: exercise.name_pt,
      nameEn: exercise.name_en,
      shortDescriptionPt: exercise.short_description_pt,
      movementPattern: exercise.movement_pattern,
      mechanics: exercise.mechanics,
      laterality: exercise.laterality,
      difficulty: exercise.difficulty,
      isActive: exercise.is_active,
      aliases: parsed(
        z.array(aliasSchema),
        aliases.data,
        "Aliases inválidos.",
      ).map((row) => row.alias),
      muscles: parsed(
        z.array(muscleLinkSchema),
        muscles.data,
        "Músculos inválidos.",
      ).map((row) => ({
        role: row.role,
        muscle: mapMuscle(row.muscles),
        group: mapGroup(row.muscles.muscle_groups),
      })),
      equipment: equipmentRows.map((row) => mapEquipment(row.equipment)),
      instructions: parsed(
        z.array(instructionSchema),
        instructions.data,
        "Instruções inválidas.",
      ).map((row) => ({
        section: row.section,
        sortOrder: row.sort_order,
        contentPt: row.content_pt,
      })),
      relations: parsed(
        z.array(relationSchema),
        relations.data,
        "Relações inválidas.",
      ).map((row) => ({
        type: row.relation_type,
        notePt: row.note_pt,
        exercise: {
          id: row.exercises.id,
          slug: row.exercises.slug,
          namePt: row.exercises.name_pt,
          nameEn: row.exercises.name_en,
        },
      })),
      hasMedia: (media.count ?? 0) > 0,
    };
  }
}

export class SupabaseAnatomyRepository implements AnatomyRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async listCatalogFacets(): Promise<ExerciseCatalogFacets> {
    const [groups, muscles, equipment] = await Promise.all([
      this.client.from("muscle_groups").select("*").order("name_pt"),
      this.client.from("muscles").select("*").order("name_pt"),
      this.client.from("equipment").select("*").order("name_pt"),
    ]);
    const failure = [groups, muscles, equipment].find((result) => result.error);
    if (failure?.error)
      throw new DataAccessError(
        "Não foi possível carregar os filtros do catálogo.",
        { cause: failure.error },
      );
    return {
      muscleGroups: parsed(
        z.array(groupSchema),
        groups.data,
        "Grupos musculares inválidos.",
      ).map(mapGroup),
      muscles: parsed(
        z.array(muscleSchema),
        muscles.data,
        "Músculos inválidos.",
      ).map(mapMuscle),
      equipment: parsed(
        z.array(equipmentSchema),
        equipment.data,
        "Equipamentos inválidos.",
      ).map(mapEquipment),
    };
  }
}
