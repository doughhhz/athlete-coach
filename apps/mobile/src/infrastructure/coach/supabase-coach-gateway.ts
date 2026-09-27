import type {
  CoachAnalysis,
  CoachAnalysisMode,
  CoachConversationMessage,
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
}
