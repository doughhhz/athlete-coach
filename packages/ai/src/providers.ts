import {
  CoachProviderError,
  schemaIssuePaths,
  coachAnalysisSchema,
  coachAnalysisModelOutputJsonSchema,
  type CoachModelProvider,
  type CoachProviderResult,
} from "@athlete-coach/application";
import {
  collectDossierEvidenceIds,
  type AthleteTrainingDossier,
  type CoachAnalysis,
  type CoachAnalysisRequest,
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
  /**
   * Models tried in order when the previous one is unavailable (quota 429,
   * not found 404, overload 5xx after the transient retries). ADR-0115.
   */
  fallbackModels?: readonly string[] | undefined;
}>;
/** Availability failures that move to the next model; never content/schema ones. */
const MODEL_FALLBACK_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
/** Primary model first, then the configured fallbacks, without duplicates. */
export function modelChain(config: GeminiCoachConfiguration): string[] {
  return [
    ...new Set(
      [config.model, ...(config.fallbackModels ?? [])]
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ];
}
/**
 * Runs `attempt` with each model until one succeeds. Only availability
 * failures (HTTP 404/429/5xx) fall through to the next model: invalid output,
 * grounding/safety rejections and timeouts are never retried on another model,
 * so quality problems stay visible and the request stays within the Edge
 * time limit. The final error lists the chain tried (ADR-0115).
 */
export async function withModelFallback<T>(
  models: readonly string[],
  attempt: (model: string) => Promise<T>,
): Promise<T> {
  const attempted: string[] = [];
  for (const [index, model] of models.entries()) {
    try {
      return await attempt(model);
    } catch (error) {
      const status =
        error instanceof CoachProviderError &&
        error.diagnostics?.stage === "http"
          ? error.diagnostics.status
          : undefined;
      attempted.push(
        `${model}:${status ?? (error instanceof CoachProviderError ? error.code : "error")}`,
      );
      const fallThrough =
        index < models.length - 1 &&
        status !== undefined &&
        MODEL_FALLBACK_STATUSES.has(status);
      if (fallThrough) continue;
      if (error instanceof CoachProviderError && attempted.length > 1)
        throw new CoachProviderError(error.code, error.message, {
          cause: error,
          diagnostics: {
            ...(error.diagnostics ?? { stage: "http" }),
            attemptedModels: attempted,
          },
        });
      throw error;
    }
  }
  throw new CoachProviderError("unavailable", "No Gemini model configured.");
}
/**
 * Keywords removed before sending a schema to Gemini. Length/count bounds
 * make Gemini reject the analysis schema with HTTP 400 (verified by
 * elimination, ADR-0111); `pattern` is the long ISO date regex. All of them
 * are still enforced by the Zod contract after parsing.
 */
const GEMINI_UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "pattern",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  // Numeric bounds (proposal schema, ADR-0114): same "too many states" risk.
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);
/**
 * Adapts a JSON Schema to the subset Gemini structured output accepts and
 * turns `const` into a single-value `enum`.
 */
export function toGeminiResponseSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiResponseSchema);
  if (!schema || typeof schema !== "object") return schema;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (GEMINI_UNSUPPORTED_KEYWORDS.has(key)) continue;
    if (key === "const") result["enum"] = [value];
    // Discriminated unions: Gemini documents anyOf, not oneOf (ADR-0114).
    else if (key === "oneOf") result["anyOf"] = toGeminiResponseSchema(value);
    else if (key === "properties" && value && typeof value === "object")
      result[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          toGeminiResponseSchema(child),
        ]),
      );
    else result[key] = toGeminiResponseSchema(value);
  }
  return result;
}
const COACH_ANALYSIS_RESPONSE_SCHEMA = toGeminiResponseSchema(
  coachAnalysisModelOutputJsonSchema,
);
/**
 * Anchors every evidence reference of a response schema to the dossier sent
 * with the request (ADR-0116): each evidence object ({kind, id, version})
 * becomes an `anyOf` with one branch per evidence kind present in the
 * dossier, whose `id` is an `enum` of that kind's ids. The model can no
 * longer cite an id that is not in the dossier (or pair it with the wrong
 * kind). The deterministic grounding check stays in place as the authority.
 */
export function groundEvidenceSchema(
  schema: unknown,
  allowedEvidence: ReadonlySet<string>,
  /** Only ground evidence under these property names (e.g. "evidenceUsed"). */
  onlyUnder?: readonly string[],
): unknown {
  const idsByKind = new Map<string, Set<string>>();
  for (const reference of allowedEvidence) {
    const separator = reference.indexOf(":");
    if (separator < 1) continue;
    const kind = reference.slice(0, separator);
    const ids = idsByKind.get(kind) ?? new Set<string>();
    ids.add(reference.slice(separator + 1));
    idsByKind.set(kind, ids);
  }
  if (!idsByKind.size) return schema;
  const isEvidence = (node: Record<string, unknown>) =>
    node["type"] === "object" &&
    !!node["properties"] &&
    typeof node["properties"] === "object" &&
    Object.keys(node["properties"] as object)
      .sort()
      .join(",") === "id,kind,version";
  const walk = (node: unknown, active = !onlyUnder): unknown => {
    if (Array.isArray(node)) return node.map((item) => walk(item, active));
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    if (active && isEvidence(record)) {
      const properties = record["properties"] as Record<string, unknown>;
      return {
        anyOf: [...idsByKind].map(([kind, ids]) => ({
          ...record,
          properties: {
            ...properties,
            kind: { type: "string", enum: [kind] },
            id: { type: "string", enum: [...ids].sort() },
          },
        })),
      };
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        walk(value, active || (onlyUnder?.includes(key) ?? false)),
      ]),
    );
  };
  return walk(schema);
}
/**
 * Response schemas to try, strictest first (ADR-0117): evidence anchored
 * everywhere, then only in the top-level evidence lists, then not anchored.
 * Gemini rejects schemas that become too complex (HTTP 400) as the dossier
 * grows; the next rung is then used. Duplicates are skipped. The
 * deterministic grounding check applies to every rung.
 */
export function evidenceSchemaLadder(
  schema: unknown,
  allowedEvidence: ReadonlySet<string>,
): unknown[] {
  const rungs = [
    groundEvidenceSchema(schema, allowedEvidence),
    groundEvidenceSchema(schema, allowedEvidence, [
      "evidenceUsed",
      "evidenceReferences",
    ]),
    schema,
  ];
  const seen = new Set<string>();
  return rungs.filter((rung) => {
    const key = JSON.stringify(rung);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/**
 * Posts with each response schema of the ladder until Gemini accepts the
 * request shape: only HTTP 400 (schema rejected) moves to the next rung;
 * every other status is returned as is (transient 5xx already retried).
 */
export async function fetchWithSchemaLadder(
  fetcher: typeof fetch,
  url: string,
  init: (responseJsonSchema: unknown) => RequestInit,
  ladder: readonly unknown[],
  delaysMs?: readonly number[],
): Promise<Response> {
  for (const [index, schema] of ladder.entries()) {
    const response = await fetchWithTransientRetry(
      fetcher,
      url,
      init(schema),
      delaysMs,
    );
    if (response.status !== 400 || index === ladder.length - 1) return response;
  }
  throw new CoachProviderError("unavailable", "Empty response schema ladder.");
}
/** Evidence allowed by a dossier, or none when it cannot be read (tests/fixtures). */
export function dossierEvidence(dossier: unknown): ReadonlySet<string> {
  try {
    return collectDossierEvidenceIds(dossier as AthleteTrainingDossier);
  } catch {
    return new Set();
  }
}
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
  analyze(
    request: CoachAnalysisRequest,
    requestId: string,
  ): Promise<CoachProviderResult> {
    return withModelFallback(modelChain(this.config), (model) =>
      this.analyzeWith(model, request, requestId),
    );
  }
  private async analyzeWith(
    model: string,
    request: CoachAnalysisRequest,
    requestId: string,
  ): Promise<CoachProviderResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetchWithSchemaLadder(
        this.fetcher,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        (responseJsonSchema) => ({
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
              // Structured output: the model must follow the canonical contract.
              responseJsonSchema,
            },
          }),
        }),
        evidenceSchemaLadder(
          COACH_ANALYSIS_RESPONSE_SCHEMA,
          dossierEvidence(request.dossier),
        ),
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
          model,
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
        model,
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
