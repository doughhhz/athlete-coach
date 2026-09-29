import type {
  AthleteTrainingDossier,
  CoachAnalysis,
  CoachAutonomyMode,
  CoachDecision,
  CoachDecisionGovernance,
  CoachProposalOrigin,
  CoachProposal,
  TrainingProgram,
} from "@athlete-coach/domain";
export interface CoachProposalProvider {
  generate(
    input: Readonly<{
      analysis: CoachAnalysis;
      dossier: AthleteTrainingDossier;
      sourceProgram: TrainingProgram;
    }>,
    requestId: string,
  ): Promise<CoachProposal | null>;
}
export interface CoachDecisionRepository {
  /**
   * Persists a governed decision. Idempotent per athlete and
   * `analysisRequestId`: a retry returns the existing decision (ADR-0077).
   */
  create(
    proposal: CoachProposal,
    envelope: CoachDecisionEnvelope,
  ): Promise<CoachDecision>;
  findByAnalysisRequestId(
    analysisRequestId: string,
  ): Promise<CoachDecision | null>;
  get(id: string): Promise<CoachDecision | null>;
  list(): Promise<readonly CoachDecision[]>;
  reject(
    id: string,
    reason: string,
    notes: string | null,
  ): Promise<CoachDecision>;
  materialize(id: string): Promise<CoachDecision>;
}
/** Backend-computed governance envelope; never accepted from the client. */
export type CoachDecisionEnvelope = Readonly<{
  proposalOrigin: CoachProposalOrigin;
  autonomyModeAtCreation: CoachAutonomyMode | null;
  analysisRequestId: string | null;
  governance: CoachDecisionGovernance;
}>;
/** Athlete-scoped (RLS) autonomy preference; absent row means `manual`. */
export interface CoachPreferenceRepository {
  getAutonomyMode(): Promise<CoachAutonomyMode>;
  setAutonomyMode(mode: CoachAutonomyMode): Promise<CoachAutonomyMode>;
}
/**
 * Authoritative, server-owned record of a validated analysis (ADR-0078).
 * Only obtainable from `CoachAnalysisRepository`; a client-returned analysis
 * is display data and never becomes one of these.
 */
export type CoachAnalysisRecord = Readonly<{
  analysisRequestId: string;
  analysis: CoachAnalysis;
  /** Derived by the backend (and the database) from the validated snapshot. */
  trainingAdviceBlocked: boolean;
  /** Active program represented in the analysis-time dossier. */
  sourceProgram: Readonly<{ id: string; revision: number }> | null;
  createdAt: string;
}>;
/** Athlete-scoped by the implementation; writes are backend-only. */
export interface CoachAnalysisRepository {
  findByRequestId(
    analysisRequestId: string,
  ): Promise<CoachAnalysisRecord | null>;
  /** Idempotent: returns the existing record for the same request. */
  recordCompleted(
    input: Readonly<{
      analysisRequestId: string;
      analysis: CoachAnalysis;
      sourceProgram: Readonly<{ id: string; revision: number }> | null;
    }>,
  ): Promise<CoachAnalysisRecord>;
}
