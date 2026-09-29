import type {
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
          : code === "stale_analysis" || code === "analysis_not_found"
            ? "Seu programa ou a análise mudou. Faça uma nova análise para ver uma proposta."
            : code === "analysis_request_conflict"
              ? "Esta análise já foi registrada para outra pergunta. Envie a pergunta novamente."
              : code === "proposal_blocked"
                ? "Por segurança, nenhuma proposta de treino pode ser preparada para esta análise."
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
      analysisReused: payload.analysisReused ?? false,
      autonomyMode: payload.autonomyMode ?? null,
      proactiveProposal: payload.proactiveProposal ?? {
        status: "not_enabled",
        decision: null,
        reasons: [],
        unavailableReason: null,
      },
      autoDraft: payload.autoDraft ?? {
        status: "not_applicable",
        policyVersion: null,
        reasons: [],
        decision: null,
        draftProgramId: null,
      },
    };
  }
  /**
   * Manual request by analysis identity only: the displayed analysis is never
   * sent back (ADR-0078). An existing decision for the same analysis is reused.
   */
  async propose(analysisRequestId: string): Promise<CoachDecision | null> {
    const { data, error } = await this.client.functions.invoke(
      "coach-propose",
      { body: { analysisRequestId } },
    );
    if (error)
      throw new MobileCoachError(await errorCode(error, "proposal_failed"));
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
