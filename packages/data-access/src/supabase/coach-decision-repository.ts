import {
  DEFAULT_COACH_AUTONOMY_MODE,
  coachAutonomyModes,
  coachGovernanceReasons,
  coachProposalOrigins,
  coachProposalStatuses,
  coachRejectionReasons,
  persistedReviewClasses,
  type CoachAutonomyMode,
  type CoachDecision,
  type CoachProposal,
} from "@athlete-coach/domain";
import {
  coachProposalSchema,
  type CoachDecisionEnvelope,
  type CoachDecisionRepository,
  type CoachPreferenceRepository,
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
  proposal_origin: z.enum(coachProposalOrigins),
  autonomy_mode_at_creation: z.enum(coachAutonomyModes).nullable(),
  analysis_request_id: z.uuid().nullable(),
  governance_policy_version: z.string().nullable(),
  review_class: z.enum(persistedReviewClasses).nullable(),
  governance_reasons: z.array(z.enum(coachGovernanceReasons)),
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
    proposalOrigin: row.proposal_origin,
    autonomyModeAtCreation: row.autonomy_mode_at_creation,
    analysisRequestId: row.analysis_request_id,
    governance:
      row.governance_policy_version && row.review_class
        ? {
            policyVersion: row.governance_policy_version,
            reviewClass: row.review_class,
            reasons: row.governance_reasons,
          }
        : null,
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
  async create(proposal: CoachProposal, envelope: CoachDecisionEnvelope) {
    const { data, error } = await this.client.rpc("create_coach_decision", {
      p_user_id: this.userId,
      p_proposal: JSON.parse(JSON.stringify(proposal)) as Json,
      p_envelope: {
        proposalOrigin: envelope.proposalOrigin,
        autonomyModeAtCreation: envelope.autonomyModeAtCreation,
        analysisRequestId: envelope.analysisRequestId,
        governancePolicyVersion: envelope.governance.policyVersion,
        reviewClass: envelope.governance.reviewClass,
        governanceReasons: [...envelope.governance.reasons],
      },
    });
    if (error) fail(error);
    return map(data);
  }
  /** Explicitly athlete-scoped, so it is safe with RLS or service clients. */
  async findByAnalysisRequestId(analysisRequestId: string) {
    const { data, error } = await this.client
      .from("coach_decisions")
      .select("*, athletes!inner(user_id)")
      .eq("analysis_request_id", analysisRequestId)
      .eq("athletes.user_id", this.userId)
      .maybeSingle();
    if (error) fail(error);
    return data ? map(data) : null;
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

const preferenceSchema = z.object({
  autonomy_mode: z.enum(coachAutonomyModes),
});
/** Uses the caller JWT: RLS restricts reads and writes to the own athlete. */
export class SupabaseCoachPreferenceRepository implements CoachPreferenceRepository {
  private readonly client: AthleteCoachSupabaseClient;
  constructor(client: AthleteCoachSupabaseClient) {
    this.client = client;
  }
  async getAutonomyMode(): Promise<CoachAutonomyMode> {
    const { data, error } = await this.client
      .from("athlete_coach_preferences")
      .select("autonomy_mode")
      .maybeSingle();
    if (error) fail(error);
    return data
      ? preferenceSchema.parse(data).autonomy_mode
      : DEFAULT_COACH_AUTONOMY_MODE;
  }
  async setAutonomyMode(mode: CoachAutonomyMode): Promise<CoachAutonomyMode> {
    const athlete = await this.client
      .from("athletes")
      .select("id")
      .maybeSingle();
    if (athlete.error || !athlete.data) fail(athlete.error);
    const { data, error } = await this.client
      .from("athlete_coach_preferences")
      .upsert(
        { athlete_id: athlete.data.id, autonomy_mode: mode },
        { onConflict: "athlete_id" },
      )
      .select("autonomy_mode")
      .single();
    if (error) fail(error);
    return preferenceSchema.parse(data).autonomy_mode;
  }
}
