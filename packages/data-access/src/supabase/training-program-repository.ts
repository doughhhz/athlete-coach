import type {
  CreateProgramDraftInput,
  ProgramStructureInput,
  TrainingProgramRepository,
} from "@athlete-coach/application";
import {
  loadPrescriptionKinds,
  programStatuses,
  targetMetrics,
  type TrainingProgram,
  type TrainingProgramSummary,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";

const setSchema = z.object({
  id: z.uuid(),
  lineage_id: z.uuid(),
  sequence: z.number().int(),
  target_metric: z.enum(targetMetrics),
  target_min: z.number(),
  target_max: z.number(),
  rir_min: z.number().int().nullable(),
  rir_max: z.number().int().nullable(),
  rest_min_seconds: z.number().int().nullable(),
  rest_max_seconds: z.number().int().nullable(),
  tempo: z.string().nullable(),
  load_kind: z.enum(loadPrescriptionKinds),
  load_kg: z.number().nullable(),
});
const prescriptionSchema = z.object({
  id: z.uuid(),
  lineage_id: z.uuid(),
  exercise_id: z.uuid(),
  sequence: z.number().int(),
  instructions: z.string().nullable(),
  athlete_cues: z.string().nullable(),
  exercises: z.object({ name_pt: z.string() }),
  prescription_sets: z.array(setSchema),
});
const daySchema = z.object({
  id: z.uuid(),
  lineage_id: z.uuid(),
  sequence: z.number().int(),
  name: z.string(),
  preferred_weekday: z.number().int().nullable(),
  notes: z.string().nullable(),
  exercise_prescriptions: z.array(prescriptionSchema),
});
const weekSchema = z.object({
  id: z.uuid(),
  lineage_id: z.uuid(),
  sequence: z.number().int(),
  name: z.string().nullable(),
  notes: z.string().nullable(),
  training_days: z.array(daySchema),
});
const blockSchema = z.object({
  id: z.uuid(),
  lineage_id: z.uuid(),
  sequence: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  training_weeks: z.array(weekSchema),
});
const programSchema = z.object({
  id: z.uuid(),
  athlete_id: z.uuid(),
  athlete_goal_id: z.uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(programStatuses),
  revision: z.number().int(),
  supersedes_program_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  activated_at: z.iso.datetime({ offset: true }).nullable(),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  archived_at: z.iso.datetime({ offset: true }).nullable(),
  lineage_tracked: z.boolean(),
  training_blocks: z.array(blockSchema).default([]),
});
const selectTree =
  "id,athlete_id,athlete_goal_id,name,description,status,revision,supersedes_program_id,created_at,updated_at,activated_at,completed_at,archived_at,lineage_tracked,training_blocks(id,lineage_id,sequence,name,description,training_weeks(id,lineage_id,sequence,name,notes,training_days(id,lineage_id,sequence,name,preferred_weekday,notes,exercise_prescriptions(id,lineage_id,exercise_id,sequence,instructions,athlete_cues,exercises(name_pt),prescription_sets(id,lineage_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg)))))";
function failure(message: string, error: unknown): never {
  throw new DataAccessError(message, { cause: error });
}
function map(input: unknown): TrainingProgram {
  const p = programSchema.parse(input);
  return {
    id: p.id,
    athleteId: p.athlete_id,
    athleteGoalId: p.athlete_goal_id,
    name: p.name,
    description: p.description,
    status: p.status,
    revision: p.revision,
    supersedesProgramId: p.supersedes_program_id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    activatedAt: p.activated_at,
    completedAt: p.completed_at,
    archivedAt: p.archived_at,
    lineageTracked: p.lineage_tracked,
    blocks: p.training_blocks
      .sort((a, b) => a.sequence - b.sequence)
      .map((b) => ({
        id: b.id,
        lineageId: b.lineage_id,
        sequence: b.sequence,
        name: b.name,
        description: b.description,
        weeks: b.training_weeks
          .sort((a, c) => a.sequence - c.sequence)
          .map((w) => ({
            id: w.id,
            lineageId: w.lineage_id,
            sequence: w.sequence,
            name: w.name,
            notes: w.notes,
            days: w.training_days
              .sort((a, c) => a.sequence - c.sequence)
              .map((d) => ({
                id: d.id,
                lineageId: d.lineage_id,
                sequence: d.sequence,
                name: d.name,
                preferredWeekday: d.preferred_weekday,
                notes: d.notes,
                prescriptions: d.exercise_prescriptions
                  .sort((a, c) => a.sequence - c.sequence)
                  .map((ep) => ({
                    id: ep.id,
                    lineageId: ep.lineage_id,
                    exerciseId: ep.exercise_id,
                    exerciseName: ep.exercises.name_pt,
                    sequence: ep.sequence,
                    instructions: ep.instructions,
                    athleteCues: ep.athlete_cues,
                    sets: ep.prescription_sets
                      .sort((a, c) => a.sequence - c.sequence)
                      .map((s) => ({
                        id: s.id,
                        lineageId: s.lineage_id,
                        sequence: s.sequence,
                        targetMetric: s.target_metric,
                        targetMin: s.target_min,
                        targetMax: s.target_max,
                        rirMin: s.rir_min,
                        rirMax: s.rir_max,
                        restMinSeconds: s.rest_min_seconds,
                        restMaxSeconds: s.rest_max_seconds,
                        tempo: s.tempo,
                        loadKind: s.load_kind,
                        loadKg: s.load_kg,
                      })),
                  })),
              })),
          })),
      })),
  };
}
export class SupabaseTrainingProgramRepository implements TrainingProgramRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async list(): Promise<readonly TrainingProgramSummary[]> {
    const { data, error } = await this.client
      .from("training_programs")
      .select(selectTree)
      .order("created_at", { ascending: false });
    if (error) failure("Não foi possível carregar os programas.", error);
    return (data ?? []).map(map).map((p) => {
      const { blocks, ...summary } = p;
      return {
        ...summary,
        blockCount: blocks.length,
        weekCount: blocks.reduce((n, b) => n + b.weeks.length, 0),
        dayCount: blocks.reduce(
          (n, b) => n + b.weeks.reduce((m, w) => m + w.days.length, 0),
          0,
        ),
      };
    });
  }
  async get(id: string) {
    const { data, error } = await this.client
      .from("training_programs")
      .select(selectTree)
      .eq("id", id)
      .maybeSingle();
    if (error) failure("Não foi possível carregar o programa.", error);
    return data ? map(data) : null;
  }
  async getActive() {
    const { data, error } = await this.client
      .from("training_programs")
      .select(selectTree)
      .eq("status", "active")
      .maybeSingle();
    if (error) failure("Não foi possível carregar o programa ativo.", error);
    return data ? map(data) : null;
  }
  async createDraft(input: CreateProgramDraftInput) {
    const athlete = await this.currentAthlete();
    const { data, error } = await this.client
      .from("training_programs")
      .insert({
        athlete_id: athlete,
        name: input.name,
        description: input.description ?? null,
        athlete_goal_id: input.athleteGoalId ?? null,
      })
      .select("id")
      .single();
    if (error) failure("Não foi possível criar o rascunho.", error);
    return (await this.get(data.id))!;
  }
  async saveStructure(id: string, structure: ProgramStructureInput) {
    const { error } = await this.client.rpc(
      "replace_training_program_structure",
      { p_program_id: id, p_structure: structure },
    );
    if (error) failure("Não foi possível salvar a estrutura.", error);
    return (await this.get(id))!;
  }
  activate(id: string) {
    return this.rpcProgram("activate_training_program", { p_program_id: id });
  }
  cloneAsDraft(id: string) {
    return this.rpcProgram("clone_training_program_as_draft", {
      p_program_id: id,
    });
  }
  complete(id: string) {
    return this.rpcProgram("transition_training_program", {
      p_program_id: id,
      p_status: "completed",
    });
  }
  archive(id: string) {
    return this.rpcProgram("transition_training_program", {
      p_program_id: id,
      p_status: "archived",
    });
  }
  private async currentAthlete(): Promise<string> {
    const { data, error } = await this.client.rpc("ensure_current_athlete");
    if (error) failure("Não foi possível identificar o atleta.", error);
    return z.object({ id: z.uuid() }).parse(data).id;
  }
  private async rpcProgram(
    name:
      | "activate_training_program"
      | "clone_training_program_as_draft"
      | "transition_training_program",
    args: { p_program_id: string; p_status?: string },
  ) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) failure("Não foi possível alterar o programa.", error);
    const id = z.object({ id: z.uuid() }).parse(data).id;
    return (await this.get(id))!;
  }
}
