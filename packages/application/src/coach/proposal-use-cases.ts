import {
  assessCoachProposalGovernance,
  collectDossierEvidenceIds,
  toDecisionGovernance,
  validateCoachProposal,
  type CoachAnalysis,
  type CoachAutonomyMode,
  type CoachDecision,
  type CoachGovernanceAssessment,
  type CoachGovernanceReason,
  type CoachProposal,
  type CoachProposalOrigin,
  type TrainingProgram,
} from "@athlete-coach/domain";
import type { TrainingProgramRepository } from "../training/ports.ts";
import {
  coachProposalSchema,
  rejectCoachProposalSchema,
} from "./proposal-schemas.ts";
import type {
  CoachDecisionRepository,
  CoachProposalProvider,
} from "./proposal-ports.ts";
import { z } from "zod";
export class CoachProposalValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super("A proposta não passou pela validação determinística.");
    this.issues = issues;
  }
}
/** coach-governance-v1 classified the proposal as `blocked`; nothing persisted. */
export class CoachProposalBlockedError extends CoachProposalValidationError {
  readonly reasons: readonly CoachGovernanceReason[];
  constructor(
    reasons: readonly CoachGovernanceReason[],
    issues: readonly string[] = [],
  ) {
    super(issues.length ? issues : reasons);
    this.reasons = reasons;
  }
}
/** Server-side idempotency key: validated UUID, never authority (ADR-0077). */
export const analysisRequestIdSchema = z.uuid();
export type GenerateCoachProposalOptions = Readonly<{
  origin?: CoachProposalOrigin;
  autonomyModeAtCreation?: CoachAutonomyMode | null;
  analysisRequestId?: string | null;
}>;
export class GenerateCoachProposal {
  private readonly dossier;
  private readonly programs;
  private readonly provider;
  private readonly decisions;
  private readonly ids;
  constructor(
    dossier: Readonly<{
      execute(): Promise<
        import("@athlete-coach/domain").AthleteTrainingDossier
      >;
    }>,
    programs: TrainingProgramRepository,
    provider: CoachProposalProvider,
    decisions: CoachDecisionRepository,
    ids: () => string = () => crypto.randomUUID(),
  ) {
    this.dossier = dossier;
    this.programs = programs;
    this.provider = provider;
    this.decisions = decisions;
    this.ids = ids;
  }
  /** Existing decision for a retried analysis request (no provider call). */
  async findExisting(
    analysisRequestId: string | null | undefined,
  ): Promise<CoachDecision | null> {
    if (!analysisRequestId) return null;
    return this.decisions.findByAnalysisRequestId(
      analysisRequestIdSchema.parse(analysisRequestId),
    );
  }
  async execute(
    analysis: CoachAnalysis,
    options: GenerateCoachProposalOptions = {},
  ): Promise<CoachDecision | null> {
    const origin = options.origin ?? "manual";
    const analysisRequestId = options.analysisRequestId
      ? analysisRequestIdSchema.parse(options.analysisRequestId)
      : null;
    if (analysis.safetyFlags.some((flag) => flag.blocksTrainingAdvice))
      throw new CoachProposalBlockedError(
        ["safety_blocks_training_advice"],
        ["Safety bloqueou proposta de treinamento."],
      );
    const existing = await this.findExisting(analysisRequestId);
    if (existing) return existing;
    const [dossier, sourceProgram] = await Promise.all([
      this.dossier.execute(),
      this.programs.getActive(),
    ]);
    if (!sourceProgram) return null;
    const output = await this.provider.generate(
      { analysis, dossier, sourceProgram },
      this.ids(),
    );
    if (!output) return null;
    const proposal = coachProposalSchema.parse(output) as CoachProposal;
    const result = validateCoachProposal(proposal, {
      athleteId: sourceProgram.athleteId,
      sourceProgram,
      activeProgramId: dossier.activeProgram?.id ?? null,
      evidenceIds: collectDossierEvidenceIds(dossier),
      // Candidates come from the backend-built dossier (stored relation graph),
      // never from the model output (ADR-0069).
      replacementCandidates: dossier.exerciseReplacementCandidates,
    });
    const assessment = assessCoachProposalGovernance({
      proposal,
      sourceProgram,
      origin,
      safetyBlocksTrainingAdvice: false,
      proposalValid: result.valid,
    });
    const governance = toDecisionGovernance(assessment);
    if (!governance)
      throw new CoachProposalBlockedError(
        assessment.reasons,
        result.issues.map((issue) => issue.message),
      );
    return this.decisions.create(proposal, {
      proposalOrigin: origin,
      autonomyModeAtCreation: options.autonomyModeAtCreation ?? null,
      analysisRequestId,
      governance,
    });
  }
}
export class ListCoachDecisions {
  private readonly repository: CoachDecisionRepository;
  constructor(repository: CoachDecisionRepository) {
    this.repository = repository;
  }
  execute() {
    return this.repository.list();
  }
}
export class GetCoachDecision {
  private readonly repository: CoachDecisionRepository;
  constructor(repository: CoachDecisionRepository) {
    this.repository = repository;
  }
  execute(id: string) {
    return this.repository.get(id);
  }
}
export class RejectCoachProposal {
  private readonly repository: CoachDecisionRepository;
  constructor(repository: CoachDecisionRepository) {
    this.repository = repository;
  }
  execute(id: string, input: unknown) {
    const value = rejectCoachProposalSchema.parse(input);
    return this.repository.reject(id, value.reason, value.notes ?? null);
  }
}
export class CoachDecisionNotFoundError extends Error {
  constructor() {
    super("Decisão do Personal não encontrada.");
  }
}
/** Elevated review requires an explicit human confirmation (ADR-0076). */
export class ElevatedReviewConfirmationRequiredError extends Error {
  readonly reasons: readonly CoachGovernanceReason[];
  constructor(reasons: readonly CoachGovernanceReason[]) {
    super("Revisão reforçada exige confirmação explícita.");
    this.reasons = reasons;
  }
}
export type ApproveCoachProposalInput = Readonly<{
  /** Human confirmation of an elevated review. Client review classes are ignored. */
  confirmElevatedReview?: boolean;
}>;
function sameRevision(
  program: TrainingProgram | null,
  proposal: CoachProposal,
): TrainingProgram | null {
  return program?.id === proposal.sourceProgramId &&
    program.revision === proposal.sourceProgramRevision
    ? program
    : null;
}
/**
 * Governance recomputed server-side before materialization. The effective
 * class is never lower than the persisted one (no client downgrade).
 */
export function effectiveGovernance(
  decision: CoachDecision,
  sourceProgram: TrainingProgram | null,
): CoachGovernanceAssessment {
  const assessment = assessCoachProposalGovernance({
    proposal: decision.proposal,
    sourceProgram: sameRevision(sourceProgram, decision.proposal),
    origin: decision.proposalOrigin,
    safetyBlocksTrainingAdvice: false,
    proposalValid: true,
  });
  if (
    assessment.reviewClass === "standard_review" &&
    decision.governance?.reviewClass === "elevated_review"
  )
    return {
      ...assessment,
      reviewClass: "elevated_review",
      reasons: [
        ...new Set([...decision.governance.reasons, ...assessment.reasons]),
      ],
    };
  return assessment;
}
export class ApproveCoachProposal {
  private readonly repository: Pick<CoachDecisionRepository, "get">;
  private readonly programs: Pick<TrainingProgramRepository, "get">;
  private readonly ledger: Pick<CoachDecisionRepository, "materialize">;
  /**
   * `repository` and `programs` read with the caller identity (RLS);
   * `ledger` performs the controlled transition (backend only).
   */
  constructor(
    repository: Pick<CoachDecisionRepository, "get" | "materialize">,
    programs: Pick<TrainingProgramRepository, "get">,
    ledger: Pick<CoachDecisionRepository, "materialize"> = repository,
  ) {
    this.repository = repository;
    this.programs = programs;
    this.ledger = ledger;
  }
  async execute(
    id: string,
    input: ApproveCoachProposalInput = {},
  ): Promise<CoachDecision> {
    const decision = await this.repository.get(id);
    if (!decision) throw new CoachDecisionNotFoundError();
    const assessment = effectiveGovernance(
      decision,
      await this.programs.get(decision.proposal.sourceProgramId),
    );
    if (assessment.reviewClass === "blocked")
      throw new CoachProposalBlockedError(assessment.reasons);
    if (
      assessment.reviewClass === "elevated_review" &&
      input.confirmElevatedReview !== true
    )
      throw new ElevatedReviewConfirmationRequiredError(assessment.reasons);
    return this.ledger.materialize(id);
  }
}
