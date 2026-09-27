import type {
  CoachAnalysis,
  CoachAnalysisMode,
  CoachConversationMessage,
  CoachDecision,
  CoachRejectionReason,
} from "@athlete-coach/domain";
import type { AthleteCoachSupabaseClient } from "@athlete-coach/data-access";
export class MobileCoachError extends Error {
  constructor(readonly code: string) {
    super(
      code === "coach_unavailable"
        ? "O Personal está temporariamente indisponível."
        : "Não foi possível obter a análise do Personal.",
    );
  }
}
export class SupabaseCoachGateway {
  constructor(private readonly client: AthleteCoachSupabaseClient) {}
  async analyze(
    input: Readonly<{
      userRequest: string;
      analysisMode: CoachAnalysisMode;
      conversationContext: readonly CoachConversationMessage[];
    }>,
  ): Promise<CoachAnalysis> {
    const { data, error } = await this.client.functions.invoke(
      "coach-analyze",
      { body: input },
    );
    if (error) throw new MobileCoachError("coach_unavailable");
    const payload = data as {
      analysis?: CoachAnalysis;
      error?: { code?: string };
    };
    if (!payload.analysis)
      throw new MobileCoachError(payload.error?.code ?? "coach_failed");
    return payload.analysis;
  }
  async propose(analysis: CoachAnalysis): Promise<CoachDecision | null> {
    const { data, error } = await this.client.functions.invoke(
      "coach-propose",
      { body: { analysis } },
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
  materialize(decisionId: string) {
    return this.decide({ operation: "materialize", decisionId });
  }
  reject(decisionId: string, reason: CoachRejectionReason) {
    return this.decide({ operation: "reject", decisionId, reason });
  }
  private async decide(body: object): Promise<CoachDecision> {
    const { data, error } = await this.client.functions.invoke("coach-decide", {
      body,
    });
    if (error) throw new MobileCoachError("decision_conflict");
    return (data as { decision: CoachDecision }).decision;
  }
}
