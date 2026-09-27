import type {
  AthleteTrainingDossier,
  CoachAnalysis,
  CoachDecision,
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
  create(proposal: CoachProposal): Promise<CoachDecision>;
  get(id: string): Promise<CoachDecision | null>;
  list(): Promise<readonly CoachDecision[]>;
  reject(
    id: string,
    reason: string,
    notes: string | null,
  ): Promise<CoachDecision>;
  materialize(id: string): Promise<CoachDecision>;
}
