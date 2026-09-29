import type {
  CoachAnalysis,
  CoachAnalysisMode,
  CoachConversationMessage,
  CoachDecision,
  CoachRejectionReason,
} from "@athlete-coach/domain";
import type { AnalyzeWithGovernanceResult } from "@athlete-coach/application";
import type { AthleteCoachSupabaseClient } from "@athlete-coach/data-access";
export class MobileCoachError extends Error {
  constructor(readonly code: string) {
    super(
      code === "coach_unavailable"
        ? "O Personal está temporariamente indisponível."
        : code === "elevated_review_confirmation_required"
          ? "Confirme que revisou as alterações propostas."
          : "Não foi possível obter a análise do Personal.",
    );
  }
}
/** Backend result of a governed analysis; the client never sets these fields. */
export type CoachAnalysisResult = AnalyzeWithGovernanceResult;
async function errorCode(error: unknown, fallback: string): Promise<string> {
  try {
    const context = (error as { context?: { json?: () => Promise<unknown> } })
      .context;
    const body = (await context?.json?.()) as
      { error?: { code?: string } } | undefined;
    return body?.error?.code ?? fallback;
  } catch {
    return fallback;
  }
}
export class SupabaseCoachGateway {
  constructor(private readonly client: AthleteCoachSupabaseClient) {}
  async analyze(
    input: Readonly<{
      userRequest: string;
      analysisMode: CoachAnalysisMode;
      conversationContext: readonly CoachConversationMessage[];
      analysisRequestId: string;
    }>,
  ): Promise<CoachAnalysisResult> {
    const { data, error } = await this.client.functions.invoke(
      "coach-analyze",
      { body: input },
    );
    if (error) throw new MobileCoachError("coach_unavailable");
    const payload = data as Partial<CoachAnalysisResult> & {
      error?: { code?: string };
    };
    if (!payload.analysis)
      throw new MobileCoachError(payload.error?.code ?? "coach_failed");
    return {
      analysis: payload.analysis,
      analysisRequestId: payload.analysisRequestId ?? input.analysisRequestId,
      autonomyMode: payload.autonomyMode ?? null,
      proactiveProposal: payload.proactiveProposal ?? {
        status: "not_enabled",
        decision: null,
        reasons: [],
        unavailableReason: null,
      },
    };
  }
  /** Manual request; an existing decision for the same analysis is reused. */
  async propose(
    analysis: CoachAnalysis,
    analysisRequestId: string | null,
  ): Promise<CoachDecision | null> {
    const { data, error } = await this.client.functions.invoke(
      "coach-propose",
      {
        body: analysisRequestId
          ? { analysis, analysisRequestId }
          : { analysis },
      },
    );
    if (error) throw new MobileCoachError("proposal_failed");
    return (data as { decision: CoachDecision | null }).decision;
  }
  async listDecisions(): Promise<readonly CoachDecision[]> {
    const { data, error } = await this.client.functions.invoke("coach-decide", {
      body: { operation: "list" },
    });
    if (error) throw new MobileCoachError("coach_unavailable");
    return (data as { decisions: CoachDecision[] }).decisions;
  }
  /** Only a human confirmation flag is sent; the review class is recomputed server-side. */
  materialize(
    decisionId: string,
    input: Readonly<{ confirmElevatedReview?: boolean }> = {},
  ) {
    return this.decide({
      operation: "materialize",
      decisionId,
      confirmElevatedReview: input.confirmElevatedReview === true,
    });
  }
  reject(decisionId: string, reason: CoachRejectionReason) {
    return this.decide({ operation: "reject", decisionId, reason });
  }
  private async decide(body: object): Promise<CoachDecision> {
    const { data, error } = await this.client.functions.invoke("coach-decide", {
      body,
    });
    if (error)
      throw new MobileCoachError(await errorCode(error, "decision_conflict"));
    return (data as { decision: CoachDecision }).decision;
  }
}
