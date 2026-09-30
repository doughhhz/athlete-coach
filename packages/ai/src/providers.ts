import {
  CoachProviderError,
  schemaIssuePaths,
  coachAnalysisSchema,
  type CoachModelProvider,
  type CoachProviderResult,
} from "@athlete-coach/application";
import type {
  CoachAnalysis,
  CoachAnalysisRequest,
} from "@athlete-coach/domain";
import {
  COACH_POLICY_VERSION,
  COACH_PROMPT_VERSION,
  COACH_SYSTEM_PROMPT_V6,
} from "./prompt.ts";

export type GeminiCoachConfiguration = Readonly<{
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
  /** Pauses before retrying a transient provider error (default 1 s, 3 s). */
  retryDelaysMs?: readonly number[] | undefined;
}>;
/** HTTP statuses Google uses for temporary overload/outage (not quota: 429). */
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
/**
 * Calls the provider and retries only transient server errors, within the
 * same abort signal (the overall timeout still bounds every attempt and
 * pause). Generation is read-only, so a retry has no side effects; the
 * analysis record is idempotent by analysisRequestId (ADR-0109).
 */
export async function fetchWithTransientRetry(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  delaysMs: readonly number[] = [1000, 3000],
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetcher(url, init);
    const delay = delaysMs[attempt];
    if (!TRANSIENT_STATUSES.has(response.status) || delay === undefined)
      return response;
    await new Promise<void>((resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }
}
export class FixtureCoachModelProvider implements CoachModelProvider {
  private readonly response: CoachAnalysis | Error;
  constructor(response: CoachAnalysis | Error) {
    this.response = response;
  }
  async analyze(
    _request: CoachAnalysisRequest,
    _requestId: string,
  ): Promise<CoachProviderResult> {
    if (this.response instanceof Error) throw this.response;
    return {
      analysis: structuredClone(this.response),
      provider: "fixture",
      model: "deterministic",
      inputTokens: null,
      outputTokens: null,
    };
  }
}
export class GeminiHttpCoachModelProvider implements CoachModelProvider {
  private readonly config: GeminiCoachConfiguration;
  private readonly fetcher: typeof fetch;
  constructor(config: GeminiCoachConfiguration, fetcher: typeof fetch = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }
  async analyze(
    request: CoachAnalysisRequest,
    requestId: string,
  ): Promise<CoachProviderResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetchWithTransientRetry(
        this.fetcher,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: COACH_SYSTEM_PROMPT_V6 }] },
            contents: [
              {
                role: "user",
                parts: [
                  { text: JSON.stringify({ dataTrust: "untrusted", request }) },
                ],
              },
            ],
            generationConfig: {
              temperature: this.config.temperature,
              maxOutputTokens: this.config.maxOutputTokens,
              responseMimeType: "application/json",
            },
          }),
        },
        this.config.retryDelaysMs,
      );
      if (!response.ok)
        throw new CoachProviderError(
          "unavailable",
          "Coach provider unavailable.",
          { diagnostics: { stage: "http", status: response.status } },
        );
      const payload = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: string;
        }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      const finishReason = payload.candidates?.[0]?.finishReason;
      if (!text)
        throw new CoachProviderError(
          "invalid_response",
          "Coach provider returned no structured content.",
          { diagnostics: { stage: "empty", finishReason } },
        );
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new CoachProviderError(
          "invalid_response",
          "Coach provider returned malformed JSON.",
          { cause: error, diagnostics: { stage: "json", finishReason } },
        );
      }
      const usage = payload.usageMetadata;
      const validation = coachAnalysisSchema.safeParse({
        ...(parsed as object),
        requestId,
        metadata: {
          ...((parsed as { metadata?: object }).metadata ?? {}),
          dossierSchemaVersion: request.dossier.schemaVersion,
          promptVersion: COACH_PROMPT_VERSION,
          policyVersion: COACH_POLICY_VERSION,
          provider: "gemini",
          model: this.config.model,
          inputTokens: usage?.promptTokenCount ?? null,
          outputTokens: usage?.candidatesTokenCount ?? null,
        },
      });
      if (!validation.success)
        throw new CoachProviderError(
          "invalid_response",
          "Coach provider response failed schema validation.",
          {
            diagnostics: {
              stage: "schema",
              finishReason,
              issuePaths: schemaIssuePaths(validation.error.issues),
            },
          },
        );
      return {
        analysis: validation.data,
        provider: "gemini",
        model: this.config.model,
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
      };
    } catch (error) {
      if (error instanceof CoachProviderError) throw error;
      if (controller.signal.aborted)
        throw new CoachProviderError("timeout", "Coach provider timed out.", {
          cause: error,
        });
      throw new CoachProviderError(
        "unavailable",
        "Coach provider unavailable.",
        { cause: error, diagnostics: { stage: "network" } },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
