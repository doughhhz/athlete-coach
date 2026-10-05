import assert from "node:assert/strict";
import test from "node:test";
import {
  createRoutingFetch,
  GeminiHttpCoachModelProvider,
  NVIDIA_CHAT_COMPLETIONS_URL,
  providerForModel,
  toGeminiResponse,
  toNvidiaChatRequest,
} from "../src/index.ts";

const NEMOTRON = "nvidia/nemotron-3-ultra-550b-a55b";
const geminiBody = {
  systemInstruction: { parts: [{ text: "SYSTEM" }] },
  contents: [{ role: "user", parts: [{ text: '{"q":1}' }] }],
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 900,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      properties: { a: { type: "string" } },
    },
  },
};
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

test("provider is chosen by the model id", () => {
  assert.equal(providerForModel(NEMOTRON), "nvidia");
  assert.equal(providerForModel("gemini-3.5-flash-lite"), "gemini");
});

test("Gemini request becomes an OpenAI-compatible NVIDIA request", () => {
  assert.deepEqual(toNvidiaChatRequest(NEMOTRON, geminiBody), {
    model: NEMOTRON,
    messages: [
      { role: "system", content: "SYSTEM" },
      { role: "user", content: '{"q":1}' },
    ],
    temperature: 0.2,
    max_tokens: 900,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
    nvext: { guided_json: geminiBody.generationConfig.responseJsonSchema },
  });
});

test("NVIDIA response becomes the Gemini shape (fence stripped)", () => {
  assert.deepEqual(
    toGeminiResponse({
      choices: [
        {
          message: { content: '```json\n{"a":"x"}\n```' },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    {
      candidates: [
        { content: { parts: [{ text: '{"a":"x"}' }] }, finishReason: "STOP" },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    },
  );
  assert.equal(
    toGeminiResponse({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
    }).candidates[0].finishReason,
    "MAX_TOKENS",
  );
});

test("routing: nvidia models go to NVIDIA with the bearer key; others pass through", async () => {
  const calls = [];
  const base = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
      { status: 200 },
    );
  };
  const routed = createRoutingFetch({
    nvidiaApiKey: "nvapi-test",
    baseFetch: base,
  });
  const response = await routed(geminiUrl(NEMOTRON), {
    method: "POST",
    body: JSON.stringify(geminiBody),
  });
  assert.equal(calls[0].url, NVIDIA_CHAT_COMPLETIONS_URL);
  assert.equal(calls[0].init.headers.authorization, "Bearer nvapi-test");
  assert.equal(JSON.parse(calls[0].init.body).model, NEMOTRON);
  assert.equal(
    (await response.json()).candidates[0].content.parts[0].text,
    '{"ok":true}',
  );
  // Gemini untouched.
  await routed(geminiUrl("gemini-3.5-flash-lite"), {
    method: "POST",
    body: "{}",
  });
  assert.match(calls[1].url, /generativelanguage\.googleapis\.com/);
  assert.equal(calls[1].init.body, "{}");
});

test("routing: statuses pass through; a missing key behaves as unavailable", async () => {
  const status = (code) =>
    createRoutingFetch({
      nvidiaApiKey: "k",
      baseFetch: async () => new Response("busy", { status: code }),
    });
  assert.equal(
    (await status(429)(geminiUrl(NEMOTRON), { method: "POST", body: "{}" }))
      .status,
    429,
  );
  assert.equal(
    (await status(400)(geminiUrl(NEMOTRON), { method: "POST", body: "{}" }))
      .status,
    400,
  );
  const noKey = createRoutingFetch({
    nvidiaApiKey: undefined,
    baseFetch: async () => assert.fail("no call"),
  });
  assert.equal(
    (await noKey(geminiUrl(NEMOTRON), { method: "POST", body: "{}" })).status,
    404,
  );
});

test("end to end: Nemotron overloaded, the chain falls back to Gemini", async () => {
  const seen = [];
  const base = async (url) => {
    seen.push(url.includes("nvidia") ? "nvidia" : "gemini");
    if (url.includes("nvidia"))
      return new Response("overloaded", { status: 503 });
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "not-json" }] } }],
      }),
      { status: 200 },
    );
  };
  const provider = new GeminiHttpCoachModelProvider(
    {
      apiKey: "g",
      model: NEMOTRON,
      fallbackModels: ["gemini-3.5-flash-lite"],
      temperature: 0,
      timeoutMs: 1000,
      maxOutputTokens: 100,
      retryDelaysMs: [],
    },
    createRoutingFetch({ nvidiaApiKey: "k", baseFetch: base }),
  );
  // Gemini answered (malformed here): proves the fallback reached it.
  await assert.rejects(
    () => provider.analyze({ dossier: { schemaVersion: "x" } }, "r"),
    (error) => error.code === "invalid_response",
  );
  assert.deepEqual(seen, ["nvidia", "gemini"]);
});
