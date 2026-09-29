import {
  collectDossierEvidenceIds,
  type AthleteTrainingDossier,
  type CoachAnalysis,
  type CoachAnalysisMode,
  type CoachConversationMessage,
} from "@athlete-coach/domain";
import type { CoachModelProvider, CoachSafetyPolicy } from "./ports.ts";
import { coachAnalysisSchema } from "./schemas.ts";

export const MAX_COACH_QUESTION_LENGTH = 2000;
export const MAX_COACH_CONTEXT_MESSAGES = 6;
export class InvalidCoachEvidenceError extends Error {}

function assertGrounding(
  analysis: CoachAnalysis,
  dossier: AthleteTrainingDossier,
): void {
  const allowed = collectDossierEvidenceIds(dossier);
  const refs = [
    ...analysis.evidenceUsed,
    ...analysis.observations.flatMap((item) => item.evidence),
    ...analysis.hypotheses.flatMap((item) => item.evidence),
    ...analysis.recommendations.flatMap((item) => item.evidence),
    ...analysis.uncertainties.flatMap((item) => item.relatedEvidence),
  ];
  const invalid = refs.find((ref) => !allowed.has(`${ref.kind}:${ref.id}`));
  if (invalid)
    throw new InvalidCoachEvidenceError(
      "A análise citou evidência ausente do dossier enviado.",
    );
}
export class AnalyzeAthleteWithCoach {
  private readonly buildDossier: Readonly<{
    execute(): Promise<AthleteTrainingDossier>;
  }>;
  private readonly provider: CoachModelProvider;
  private readonly safety: CoachSafetyPolicy;
  private readonly ids: () => string;
  constructor(
    buildDossier: Readonly<{
      execute(): Promise<AthleteTrainingDossier>;
    }>,
    provider: CoachModelProvider,
    safety: CoachSafetyPolicy,
    ids: () => string = () => crypto.randomUUID(),
  ) {
    this.buildDossier = buildDossier;
    this.provider = provider;
    this.safety = safety;
    this.ids = ids;
  }
  async execute(
    input: Readonly<{
      userRequest: string;
      analysisMode: CoachAnalysisMode;
      conversationContext?: readonly CoachConversationMessage[];
    }>,
  ): Promise<CoachAnalysis> {
    const question = input.userRequest.trim();
    if (!question || question.length > MAX_COACH_QUESTION_LENGTH)
      throw new Error("Pergunta inválida.");
    const context = [...(input.conversationContext ?? [])].slice(
      -MAX_COACH_CONTEXT_MESSAGES,
    );
    const dossier = await this.buildDossier.execute();
    const requestId = this.ids();
    const pre = this.safety.evaluateInput(question);
    if (pre.blockProvider) {
      return {
        schemaVersion: "coach-analysis-v1",
        analysisId: this.ids(),
        requestId,
        createdAt: new Date().toISOString(),
        summary:
          pre.flags[0]?.message ??
          "Esta situação precisa de avaliação profissional.",
        observations: [],
        hypotheses: [],
        recommendations: [],
        questions: [],
        uncertainties: [],
        evidenceUsed: [],
        safetyFlags: pre.flags,
        metadata: {
          dossierSchemaVersion: dossier.schemaVersion,
          promptVersion: "coach-system-v5",
          policyVersion: "coach-safety-v1",
          provider: "safety-policy",
          model: "deterministic",
          inputTokens: null,
          outputTokens: null,
        },
      };
    }
    const result = await this.provider.analyze(
      {
        schemaVersion: "coach-request-v1",
        dossier,
        userRequest: question,
        analysisMode: input.analysisMode,
        conversationContext: context,
      },
      requestId,
    );
    const analysis = coachAnalysisSchema.parse({
      ...result.analysis,
      requestId,
      metadata: {
        ...result.analysis.metadata,
        dossierSchemaVersion: dossier.schemaVersion,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
    assertGrounding(analysis, dossier);
    return this.safety.evaluateOutput(analysis);
  }
}
