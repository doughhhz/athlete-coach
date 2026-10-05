import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { CoachProviderError, CreateTrainingProgramWithStructure, EnsureCurrentAthlete, GenerateInitialProgram, generateInitialProgramRequestSchema, InitialProgramBlockedError, InitialProgramInvalidError, LoadCurrentAthleteProfile, schemaIssuePaths } from "../../../packages/application/src/index.ts";
import { InitialProgramUnavailableError } from "../../../packages/domain/src/index.ts";
import { DeterministicCoachSafetyPolicy, GeminiHttpInitialProgramProvider, createRoutingFetch } from "../../../packages/ai/src/index.ts";
import { SupabaseAthleteGoalRepository, SupabaseAthleteProfileRepository, SupabaseAthleteRepository, SupabaseBodyWeightRepository, SupabaseInitialProgramGenerationLog, SupabaseProgramCatalogReader, SupabaseProgramIntakeRepository, SupabaseTrainingContextRepository, SupabaseTrainingProgramRepository } from "../../../packages/data-access/src/index.ts";

// Implementation Phase 21 (ADR-0119): the Personal (or the basic template)
// prepares the first program as an inactive draft. Never activates.
const cors = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const buckets = new Map<string, number[]>();
function reply(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: cors }); }
function allowed(userId: string, now = Date.now()) { const recent = (buckets.get(userId) ?? []).filter((value) => now - value < 60_000); if (recent.length >= 5) return false; buckets.set(userId, [...recent, now]); return true; }
const unavailableProvider = () => { throw new CoachProviderError("unavailable", "Provider not configured"); };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const requestId = crypto.randomUUID();
  const started = Date.now();
  // Metadata only: never athlete text, intake answers or the generated program.
  const outcome = (level: "log" | "error", fields: Record<string, unknown>) => console[level](JSON.stringify({ requestId, latencyMs: Date.now() - started, ...fields }));
  try {
    if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed", requestId } });
    const authorization = request.headers.get("authorization");
    if (!authorization || Number(request.headers.get("content-length") ?? 0) > 2_048) return reply(authorization ? 413 : 401, { error: { code: authorization ? "request_too_large" : "unauthenticated", requestId } });
    const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !service) return reply(503, { error: { code: "program_unavailable", requestId } });
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply(401, { error: { code: "unauthenticated", requestId } });
    if (!allowed(auth.user.id)) return reply(429, { error: { code: "rate_limited", requestId } });
    // Strict body: only the mode and the stable creation intent.
    const parsed = generateInitialProgramRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: { code: "invalid_request", requestId } });
    const body = parsed.data;
    const athletes = new SupabaseAthleteRepository(client);
    await new EnsureCurrentAthlete(athletes).execute();
    const profile = new LoadCurrentAthleteProfile(athletes, new SupabaseAthleteProfileRepository(client), new SupabaseAthleteGoalRepository(client), new SupabaseTrainingContextRepository(client), new SupabaseBodyWeightRepository(client));
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    // ADR-0128: Nemotron (nvidia/...) via NVIDIA, Gemini via Google; one chain.
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY"), aiConfigured = !!apiKey || !!nvidiaKey;
    const aiFetch = createRoutingFetch({ nvidiaApiKey: nvidiaKey });
    const providerConfig = { apiKey: apiKey ?? "", model: Deno.env.get("AI_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite", fallbackModels: (Deno.env.get("AI_FALLBACK_MODELS") ?? Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-3.6-flash,gemini-3.8-flash").split(","), temperature: Number(Deno.env.get("PROGRAM_TEMPERATURE") ?? "0.3"), timeoutMs: Number(Deno.env.get("PROGRAM_TIMEOUT_MS") ?? "55000"), maxOutputTokens: Number(Deno.env.get("PROGRAM_MAX_OUTPUT_TOKENS") ?? "16384") };
    // Program creation uses the caller JWT (atomic RPC, RLS); only the audit uses the service role.
    const generate = new GenerateInitialProgram({
      profile,
      intakes: new SupabaseProgramIntakeRepository(client),
      catalog: new SupabaseProgramCatalogReader(client),
      provider: aiConfigured ? new GeminiHttpInitialProgramProvider(providerConfig, aiFetch) : { generate: unavailableProvider },
      safety: new DeterministicCoachSafetyPolicy(),
      create: new CreateTrainingProgramWithStructure(new SupabaseTrainingProgramRepository(client)),
      log: new SupabaseInitialProgramGenerationLog(createClient(url, service, { auth: { persistSession: false } }), auth.user.id),
      requestId: () => requestId,
    });
    const result = await generate.execute(body);
    outcome("log", result.status === "created"
      ? { success: true, mode: body.mode, status: result.status, origin: result.origin, reused: result.reused, repaired: result.repaired }
      : { success: true, mode: body.mode, status: result.status });
    return reply(200, result);
  } catch (error) {
    if (error instanceof InitialProgramBlockedError) {
      outcome("error", { success: false, errorCategory: "program_blocked", reason: error.reason });
      return reply(422, { error: { code: "program_blocked", reason: error.reason, requestId } });
    }
    if (error instanceof InitialProgramUnavailableError) {
      outcome("error", { success: false, errorCategory: "program_prerequisite", reason: error.reason });
      return reply(409, { error: { code: "program_prerequisite", reason: error.reason, requestId } });
    }
    if (error instanceof InitialProgramInvalidError) {
      outcome("error", { success: false, errorCategory: "program_invalid", issueCodes: [...new Set(error.issues.map((issue) => issue.code))], issueCount: error.issues.length });
      return reply(422, { error: { code: "program_invalid", requestId } });
    }
    // Metadata only (ADR-0107): provider stage/status/finishReason/issue paths, never content.
    if (error instanceof CoachProviderError) {
      const code = error.code === "timeout" ? "program_timeout" : "program_provider_unavailable";
      outcome("error", { success: false, errorCategory: code, providerErrorCode: error.code, ...error.diagnostics });
      return reply(503, { error: { code, requestId } });
    }
    const zodIssues = (error as { issues?: unknown }).issues;
    outcome("error", {
      success: false,
      errorCategory: "program_failed",
      errorName: error instanceof Error ? error.name : typeof error,
      issuePaths: Array.isArray(zodIssues) && zodIssues.every((issue) => issue && typeof issue === "object" && "path" in issue)
        ? schemaIssuePaths(zodIssues as { path: PropertyKey[]; code: string }[])
        : undefined,
    });
    return reply(500, { error: { code: "program_failed", requestId } });
  }
});
