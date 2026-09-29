import {
  DEFAULT_COACH_AUTONOMY_MODE,
  DEFAULT_COACH_DRAFT_AUTHORITY_MODE,
  coachAutoDraftEligibilities,
  coachAutoDraftReasons,
  coachDraftAuthorityModes,
  coachAutonomyModes,
  coachGovernanceReasons,
  coachProposalOrigins,
  coachProposalStatuses,
  coachRejectionReasons,
  persistedReviewClasses,
  type CoachAnalysis,
  type CoachAutonomyMode,
  type CoachDraftAuthorityMode,
  type CoachDecision,
  type CoachProposal,
} from "@athlete-coach/domain";
import {
  CoachAnalysisRequestConflictError,
  coachAnalysisSchema,
  coachProposalSchema,
  type AutoDraftLedgerResult,
  type CoachAnalysisRecord,
  type CoachAnalysisRepository,
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
  auto_draft_policy_version: z.string().nullable(),
  auto_draft_eligibility: z.enum(coachAutoDraftEligibilities).nullable(),
  auto_draft_reasons: z.array(z.enum(coachAutoDraftReasons)),
  materialization_origin: z.enum(["human", "auto_draft"]).nullable(),
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
    autoDraft:
      row.auto_draft_policy_version && row.auto_draft_eligibility
        ? {
            policyVersion: row.auto_draft_policy_version,
            eligibility: row.auto_draft_eligibility,
            reasons: row.auto_draft_reasons,
          }
        : null,
    materializationOrigin: row.materialization_origin,
  };
}
const autoDraftResultSchema = z.object({
  status: z.enum([
    "materialized",
    "already_materialized",
    "existing_draft",
    "stale",
    "not_enabled",
    "not_authorized",
    "blocked",
  ]),
  decision: z.unknown(),
});
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
    // Handoff through the server-owned analysis record (ADR-0080).
    const { data, error } = await this.client.rpc(
      "create_coach_decision_for_analysis",
      {
        p_user_id: this.userId,
        p_proposal: JSON.parse(JSON.stringify(proposal)) as Json,
        p_envelope: {
          proposalOrigin: envelope.proposalOrigin,
          autonomyModeAtCreation: envelope.autonomyModeAtCreation,
          analysisRequestId: envelope.analysisRequestId,
          governancePolicyVersion: envelope.governance.policyVersion,
          reviewClass: envelope.governance.reviewClass,
          governanceReasons: [...envelope.governance.reasons],
          autoDraft: envelope.autoDraft
            ? {
                policyVersion: envelope.autoDraft.policyVersion,
                eligibility: envelope.autoDraft.eligibility,
                reasons: [...envelope.autoDraft.reasons],
              }
            : null,
        },
      },
    );
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
  /** Backend-only: the database decides origin=auto_draft; never activates. */
  async autoDraft(id: string): Promise<AutoDraftLedgerResult> {
    const { data, error } = await this.client.rpc("auto_draft_coach_decision", {
      p_user_id: this.userId,
      p_decision_id: id,
    });
    if (error) fail(error);
    const result = autoDraftResultSchema.parse(data);
    return { status: result.status, decision: map(result.decision) };
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
const draftAuthoritySchema = z.object({
  draft_authority_mode: z.enum(coachDraftAuthorityModes),
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
  async getDraftAuthorityMode(): Promise<CoachDraftAuthorityMode> {
    const { data, error } = await this.client
      .from("athlete_coach_preferences")
      .select("draft_authority_mode")
      .maybeSingle();
    if (error) fail(error);
    return data
      ? draftAuthoritySchema.parse(data).draft_authority_mode
      : DEFAULT_COACH_DRAFT_AUTHORITY_MODE;
  }
  async setDraftAuthorityMode(
    mode: CoachDraftAuthorityMode,
  ): Promise<CoachDraftAuthorityMode> {
    const athlete = await this.client
      .from("athletes")
      .select("id")
      .maybeSingle();
    if (athlete.error || !athlete.data) fail(athlete.error);
    const { data, error } = await this.client
      .from("athlete_coach_preferences")
      .upsert(
        { athlete_id: athlete.data.id, draft_authority_mode: mode },
        { onConflict: "athlete_id" },
      )
      .select("draft_authority_mode")
      .single();
    if (error) fail(error);
    return draftAuthoritySchema.parse(data).draft_authority_mode;
  }
}

const analysisRunSchema = z.object({
  analysis_request_id: z.uuid(),
  analysis_snapshot: z.unknown(),
  training_advice_blocked: z.boolean(),
  source_program_id: z.uuid().nullable(),
  source_program_revision: z.number().int().positive().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  request_fingerprint: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});
function mapAnalysisRun(input: unknown): CoachAnalysisRecord {
  const row = analysisRunSchema.parse(input);
  return {
    analysisRequestId: row.analysis_request_id,
    analysis: coachAnalysisSchema.parse(row.analysis_snapshot) as CoachAnalysis,
    trainingAdviceBlocked: row.training_advice_blocked,
    sourceProgram:
      row.source_program_id && row.source_program_revision
        ? { id: row.source_program_id, revision: row.source_program_revision }
        : null,
    createdAt: row.created_at,
    requestFingerprint: row.request_fingerprint,
  };
}
/**
 * Backend-only (service client): the table has no client grants. Every read
 * is explicitly scoped to the authenticated user, so an id owned by another
 * athlete is indistinguishable from an unknown id.
 */
export class SupabaseCoachAnalysisRepository implements CoachAnalysisRepository {
  private readonly client: AthleteCoachSupabaseClient;
  private readonly userId: string;
  constructor(client: AthleteCoachSupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }
  async findByRequestId(analysisRequestId: string) {
    const { data, error } = await this.client
      .from("coach_analysis_runs")
      .select("*, athletes!inner(user_id)")
      .eq("analysis_request_id", analysisRequestId)
      .eq("athletes.user_id", this.userId)
      .maybeSingle();
    if (error) fail(error);
    return data ? mapAnalysisRun(data) : null;
  }
  async recordCompleted(
    input: Parameters<CoachAnalysisRepository["recordCompleted"]>[0],
  ) {
    const { data, error } = await this.client.rpc("record_coach_analysis_run", {
      p_user_id: this.userId,
      p_analysis_request_id: input.analysisRequestId,
      p_request_fingerprint: input.requestFingerprint,
      p_analysis: JSON.parse(JSON.stringify(input.analysis)) as Json,
      ...(input.sourceProgram
        ? {
            p_source_program_id: input.sourceProgram.id,
            p_source_program_revision: input.sourceProgram.revision,
          }
        : {}),
    });
    // The database refuses to bind one id to two requests (race-safe).
    if (error?.message === "Analysis request conflict")
      throw new CoachAnalysisRequestConflictError();
    if (error) fail(error);
    return mapAnalysisRun(data);
  }
}
