import {
  collectDossierEvidenceIds,
  validateCoachProposal,
  type CoachAnalysis,
  type CoachDecision,
  type CoachProposal,
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
export class CoachProposalValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super("A proposta não passou pela validação determinística.");
    this.issues = issues;
  }
}
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
  async execute(analysis: CoachAnalysis): Promise<CoachDecision | null> {
    if (analysis.safetyFlags.some((flag) => flag.blocksTrainingAdvice))
      throw new CoachProposalValidationError([
        "Safety bloqueou proposta de treinamento.",
      ]);
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
    });
    if (!result.valid)
      throw new CoachProposalValidationError(
        result.issues.map((issue) => issue.message),
      );
    return this.decisions.create(proposal);
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
export class ApproveCoachProposal {
  private readonly repository: CoachDecisionRepository;
  constructor(repository: CoachDecisionRepository) {
    this.repository = repository;
  }
  async execute(id: string): Promise<CoachDecision> {
    return this.repository.materialize(id);
  }
}
