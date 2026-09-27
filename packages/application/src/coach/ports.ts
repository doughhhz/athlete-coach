import type {
  CoachAnalysis,
  CoachAnalysisRequest,
} from "@athlete-coach/domain";

export type CoachProviderErrorCode =
  "unavailable" | "timeout" | "invalid_response";
export class CoachProviderError extends Error {
  readonly code: CoachProviderErrorCode;
  constructor(
    code: CoachProviderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachProviderError";
    this.code = code;
  }
}
export type CoachProviderResult = Readonly<{
  analysis: CoachAnalysis;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}>;
export interface CoachModelProvider {
  analyze(
    request: CoachAnalysisRequest,
    requestId: string,
  ): Promise<CoachProviderResult>;
}
export interface CoachSafetyPolicy {
  evaluateInput(
    text: string,
  ): Readonly<{ flags: CoachAnalysis["safetyFlags"]; blockProvider: boolean }>;
  evaluateOutput(analysis: CoachAnalysis): CoachAnalysis;
}
