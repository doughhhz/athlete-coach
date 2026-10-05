/**
 * NVIDIA (Nemotron) as a second provider (ADR-0128). The Coach providers
 * build Gemini-shaped requests; this transport sends models named
 * "nvidia/..." to NVIDIA's OpenAI-compatible Chat Completions API and
 * answers in the Gemini response shape, so prompts, contracts, the schema
 * ladder, validation, grounding and the model fallback chain stay identical.
 * Any other model goes to Google unchanged.
 */
export const NVIDIA_CHAT_COMPLETIONS_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";

/** Which provider serves a model id (metadata and routing). */
export function providerForModel(model: string): "nvidia" | "gemini" {
  return model.startsWith("nvidia/") ? "nvidia" : "gemini";
}

type GeminiRequest = Readonly<{
  systemInstruction?: { parts?: { text?: string }[] };
  contents?: { role?: string; parts?: { text?: string }[] }[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseJsonSchema?: unknown;
  };
}>;

/** Gemini request body -> OpenAI-compatible body for NVIDIA. */
export function toNvidiaChatRequest(model: string, body: GeminiRequest) {
  const system = body.systemInstruction?.parts
    ?.map((part) => part.text ?? "")
    .join("\n");
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...(body.contents ?? []).map((content) => ({
      role: content.role === "model" ? "assistant" : "user",
      content: (content.parts ?? []).map((part) => part.text ?? "").join("\n"),
    })),
  ];
  const schema = body.generationConfig?.responseJsonSchema;
  return {
    model,
    messages,
    temperature: body.generationConfig?.temperature,
    max_tokens: body.generationConfig?.maxOutputTokens,
    stream: false,
    // Direct answers: the reasoning trace is off (latency, token budget).
    chat_template_kwargs: { enable_thinking: false },
    // NIM structured generation: the output must follow the JSON Schema.
    ...(schema ? { nvext: { guided_json: schema } } : {}),
  };
}

type ChatCompletion = Readonly<{
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}>;
/** Removes a Markdown code fence some models wrap JSON in. */
function stripFence(text: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return match ? match[1]! : text;
}
/** OpenAI-compatible response -> the Gemini response shape. */
export function toGeminiResponse(completion: ChatCompletion) {
  const choice = completion.choices?.[0];
  const text = choice?.message?.content;
  return {
    candidates: [
      {
        content: { parts: text ? [{ text: stripFence(text) }] : [] },
        finishReason:
          choice?.finish_reason === "length"
            ? "MAX_TOKENS"
            : choice?.finish_reason === "stop"
              ? "STOP"
              : (choice?.finish_reason ?? undefined),
      },
    ],
    usageMetadata: {
      promptTokenCount: completion.usage?.prompt_tokens,
      candidatesTokenCount: completion.usage?.completion_tokens,
    },
  };
}

/**
 * A fetch that routes "nvidia/..." Gemini-shaped calls to NVIDIA and leaves
 * every other request untouched. HTTP statuses pass through, so 429/5xx
 * still fall back to the next model and 400 to the next schema rung.
 */
export function createRoutingFetch(
  options: Readonly<{
    nvidiaApiKey: string | undefined;
    baseFetch?: typeof fetch;
    nvidiaUrl?: string;
  }>,
): typeof fetch {
  const base = options.baseFetch ?? fetch;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = /\/models\/([^/:]+):generateContent/.exec(url);
    const model = match ? decodeURIComponent(match[1]!) : null;
    if (!model || providerForModel(model) !== "nvidia")
      return base(input, init);
    if (!options.nvidiaApiKey)
      // Treated like a missing model: the chain moves on to the next one.
      return new Response(JSON.stringify({ error: "NVIDIA key not set" }), {
        status: 404,
      });
    const body = JSON.parse(String(init?.body ?? "{}")) as GeminiRequest;
    const response = await base(
      options.nvidiaUrl ?? NVIDIA_CHAT_COMPLETIONS_URL,
      {
        method: "POST",
        ...(init?.signal ? { signal: init.signal } : {}),
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${options.nvidiaApiKey}`,
        },
        body: JSON.stringify(toNvidiaChatRequest(model, body)),
      },
    );
    if (!response.ok)
      return new Response(await response.text(), { status: response.status });
    return new Response(
      JSON.stringify(
        toGeminiResponse((await response.json()) as ChatCompletion),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}
