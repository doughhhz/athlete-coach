import type {
  CoachAnalysis,
  CoachAnalysisRequest,
} from "@athlete-coach/domain";

export type CoachProviderErrorCode =
  "unavailable" | "timeout" | "invalid_response";
/**
 * Operational metadata about a provider failure, safe to log: HTTP status,
 * the model's finish reason and the PATHS of schema issues. Never prompt,
 * dossier, question or model output content (ADR-0107).
 */
export type CoachProviderDiagnostics = Readonly<{
  stage: "http" | "empty" | "json" | "schema" | "network";
  status?: number | undefined;
  finishReason?: string | undefined;
  issuePaths?: readonly string[] | undefined;
}>;
export class CoachProviderError extends Error {
  readonly code: CoachProviderErrorCode;
  readonly diagnostics: CoachProviderDiagnostics | undefined;
  constructor(
    code: CoachProviderErrorCode,
    message: string,
    options?: ErrorOptions & { diagnostics?: CoachProviderDiagnostics },
  ) {
    super(message, options);
    this.name = "CoachProviderError";
    this.code = code;
    this.diagnostics = options?.diagnostics;
  }
}
/** Field paths of schema issues (no values), capped for log size. */
export function schemaIssuePaths(
  issues: readonly { path: readonly PropertyKey[]; code: string }[],
): string[] {
  return issues
    .slice(0, 12)
    .map(
      (issue) =>
        `${issue.path.map(String).join(".") || "(root)"}:${issue.code}`,
    );
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
