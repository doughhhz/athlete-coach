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
