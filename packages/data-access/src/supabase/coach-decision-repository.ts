import {
  coachProposalStatuses,
  coachRejectionReasons,
  type CoachDecision,
  type CoachProposal,
} from "@athlete-coach/domain";
import {
  coachProposalSchema,
  type CoachDecisionRepository,
} from "@athlete-coach/application";
import { z } from "zod";
import type { AthleteCoachSupabaseClient } from "./create-athlete-coach-supabase-client.ts";
import { DataAccessError } from "./supabase-repositories.ts";
import type { Json } from "../generated/database.types.ts";
const rowSchema = z.object({
  id: z.uuid(),
  athlete_id: z.uuid(),
  status: z.enum(coachProposalStatuses),
  proposal_snapshot: z.unknown(),
  rejection_reason: z.enum(coachRejectionReasons).nullable(),
  rejection_notes: z.string().nullable(),
  proposed_at: z.iso.datetime({ offset: true }),
  approved_at: z.iso.datetime({ offset: true }).nullable(),
  rejected_at: z.iso.datetime({ offset: true }).nullable(),
  stale_at: z.iso.datetime({ offset: true }).nullable(),
  materialized_at: z.iso.datetime({ offset: true }).nullable(),
  materialized_program_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
function map(input: unknown): CoachDecision {
  const row = rowSchema.parse(input);
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    proposal: coachProposalSchema.parse(row.proposal_snapshot) as CoachProposal,
    rejectionReason: row.rejection_reason,
    rejectionNotes: row.rejection_notes,
    proposedAt: row.proposed_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    staleAt: row.stale_at,
    materializedAt: row.materialized_at,
    materializedProgramId: row.materialized_program_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function fail(error: unknown): never {
  throw new DataAccessError(
    "Não foi possível processar a decisão do Personal.",
    { cause: error },
  );
}
export class SupabaseCoachDecisionRepository implements CoachDecisionRepository {
  private readonly client: AthleteCoachSupabaseClient;
  private readonly userId: string;
  constructor(client: AthleteCoachSupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }
  async create(proposal: CoachProposal) {
    const { data, error } = await this.client.rpc("create_coach_decision", {
      p_user_id: this.userId,
      p_proposal: JSON.parse(JSON.stringify(proposal)) as Json,
    });
    if (error) fail(error);
    return map(data);
  }
  async get(id: string) {
    const { data, error } = await this.client
      .from("coach_decisions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error);
    return data ? map(data) : null;
  }
  async list() {
    const { data, error } = await this.client
      .from("coach_decisions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(map);
  }
  async reject(id: string, reason: string, notes: string | null) {
    const { data, error } = await this.client.rpc("reject_coach_decision", {
      p_user_id: this.userId,
      p_decision_id: id,
      p_reason: reason,
      ...(notes === null ? {} : { p_notes: notes }),
    });
    if (error) fail(error);
    return map(data);
  }
  async materialize(id: string) {
    const { data, error } = await this.client.rpc(
      "materialize_coach_decision",
      { p_user_id: this.userId, p_decision_id: id },
    );
    if (error) fail(error);
    return map(data);
  }
}
