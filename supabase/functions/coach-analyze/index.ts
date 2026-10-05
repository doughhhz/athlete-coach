import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { AnalyzeAthleteWithCoach, AnalyzeAthleteWithCoachAndGovernance, CoachAnalysisRequestConflictError, PrepareConservativeAutoDraft, GenerateCoachProposal, analysisProgramFrom, coachAnalyzeRequestSchema, memoizeDossier, BuildAthleteTrainingDossier, BuildInterventionContext, BuildInterventionOutcomes, GetExerciseReplacementCandidates, BuildCoachDraftReviews, ListCoachDraftReviewHistory, CoachProviderError, EnsureCurrentAthlete, LoadCurrentAthleteProfile } from "../../../packages/application/src/index.ts";
import { GeminiHttpCoachModelProvider, GeminiHttpCoachProposalProvider, DeterministicCoachSafetyPolicy, createRoutingFetch } from "../../../packages/ai/src/index.ts";
import { SupabaseAthleteGoalRepository, SupabaseAthleteProfileRepository, SupabaseAthleteRepository, SupabaseBodyWeightRepository, SupabaseCoachAnalysisRepository, SupabaseCoachDecisionRepository, SupabaseCoachPreferenceRepository, SupabaseExerciseCatalogRepository, SupabasePerformanceReadRepository, SupabaseTrainingContextRepository, SupabaseTrainingProgramRepository, SupabaseWorkoutSessionRepository } from "../../../packages/data-access/src/index.ts";

const cors = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const buckets = new Map<string, number[]>();
function reply(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: cors }); }
function allowed(userId: string, now = Date.now()) { const recent = (buckets.get(userId) ?? []).filter((value) => now - value < 60_000); if (recent.length >= 10) return false; buckets.set(userId, [...recent, now]); return true; }
// Without a configured key the provider fails only if actually called: safety-blocked
// questions and retries of stored analyses never need it.
const unavailableProvider = () => { throw new CoachProviderError("unavailable", "Provider not configured"); };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const requestId = crypto.randomUUID();
  const started = Date.now();
  try {
    if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed", requestId } });
    const authorization = request.headers.get("authorization");
    if (!authorization || Number(request.headers.get("content-length") ?? 0) > 16_384) return reply(authorization ? 413 : 401, { error: { code: authorization ? "request_too_large" : "unauthenticated", requestId } });
    const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply(401, { error: { code: "unauthenticated", requestId } });
    if (!allowed(auth.user.id)) return reply(429, { error: { code: "rate_limited", requestId } });
    // Strict body: athlete identity, analyses, safety, origin and review class are rejected (ADR-0078).
    const parsed = coachAnalyzeRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: { code: "invalid_request", requestId } });
    const body = parsed.data;
    const apiKey = Deno.env.get("GEMINI_API_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // ADR-0128: Nemotron (nvidia/...) via NVIDIA, Gemini via Google; one chain.
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY"), aiConfigured = !!apiKey || !!nvidiaKey;
    const aiFetch = createRoutingFetch({ nvidiaApiKey: nvidiaKey });
    if (!service) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const athletes = new SupabaseAthleteRepository(client);
    await new EnsureCurrentAthlete(athletes).execute();
    const bodyWeights = new SupabaseBodyWeightRepository(client), programs = new SupabaseTrainingProgramRepository(client), performance = new SupabasePerformanceReadRepository(client);
    const profile = new LoadCurrentAthleteProfile(athletes, new SupabaseAthleteProfileRepository(client), new SupabaseAthleteGoalRepository(client), new SupabaseTrainingContextRepository(client), bodyWeights);
    // Decision history is read with the caller JWT (RLS), never with the service role.
    const catalog = new SupabaseExerciseCatalogRepository(client);
    const interventionContext = new BuildInterventionContext(new BuildInterventionOutcomes(new SupabaseCoachDecisionRepository(client, auth.user.id), programs, performance, bodyWeights, undefined, catalog));
    // Dossier v6 review evidence: derived from the ledger and program lifecycle with the caller JWT (read-only).
    const draftReviews = new ListCoachDraftReviewHistory(new BuildCoachDraftReviews(new SupabaseCoachDecisionRepository(client, auth.user.id), programs));
    // One dossier per request: provenance and the proactive proposal use the same evidence as the analysis.
    const dossier = memoizeDossier(new BuildAthleteTrainingDossier(profile, programs, new SupabaseWorkoutSessionRepository(client), performance, undefined, interventionContext, new GetExerciseReplacementCandidates(catalog), draftReviews));
    const providerConfig = { apiKey: apiKey ?? "", model: Deno.env.get("AI_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite", fallbackModels: (Deno.env.get("AI_FALLBACK_MODELS") ?? Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-3.6-flash,gemini-3.8-flash").split(","), temperature: Number(Deno.env.get("COACH_TEMPERATURE") ?? "0.2"), timeoutMs: Number(Deno.env.get("COACH_TIMEOUT_MS") ?? "60000"), maxOutputTokens: Number(Deno.env.get("COACH_MAX_OUTPUT_TOKENS") ?? "8192") };
    const analyze = new AnalyzeAthleteWithCoach(dossier, aiConfigured ? new GeminiHttpCoachModelProvider(providerConfig, aiFetch) : { analyze: unavailableProvider }, new DeterministicCoachSafetyPolicy(), () => requestId);
    // The service client is used only for backend-owned writes: the authoritative
    // analysis record and the governed ledger entry (never materialize/activate).
    const serviceClient = createClient(url, service, { auth: { persistSession: false } });
    const analyses = new SupabaseCoachAnalysisRepository(serviceClient, auth.user.id);
    const ledger = new SupabaseCoachDecisionRepository(serviceClient, auth.user.id);
    const propose = new GenerateCoachProposal(dossier, programs, aiConfigured ? new GeminiHttpCoachProposalProvider(providerConfig, aiFetch) : { generate: unavailableProvider }, ledger, () => crypto.randomUUID());
    const userId = auth.user.id;
    const preferences = new SupabaseCoachPreferenceRepository(client);
    // Conservative Auto-Draft (Implementation Phase 16): server policy + persistent opt-in only;
    // creates at most an inactive draft through the backend RPC, never activates (ADR-0086).
    const autoDraft = new PrepareConservativeAutoDraft(preferences, programs, ledger);
    const result = await new AnalyzeAthleteWithCoachAndGovernance(analyze, analyses, analysisProgramFrom(dossier), propose, preferences, { tryConsume: () => allowed(userId) }, autoDraft).execute({ userRequest: body.userRequest, analysisMode: body.analysisMode, conversationContext: body.conversationContext ?? [], analysisRequestId: body.analysisRequestId });
    const { analysis, proactiveProposal } = result;
    // Metadata only: never the analysis snapshot, question or proposal content.
    console.log(JSON.stringify({ requestId, analysisRequestId: result.analysisRequestId, analysisReused: result.analysisReused, provider: analysis.metadata.provider, model: analysis.metadata.model, schemaVersion: analysis.schemaVersion, promptVersion: analysis.metadata.promptVersion, autonomyMode: result.autonomyMode, proactiveStatus: proactiveProposal.status, reviewClass: proactiveProposal.decision?.governance?.reviewClass ?? null, autoDraftStatus: result.autoDraft.status, latencyMs: Date.now() - started, success: true }));
    return reply(200, result);
  } catch (error) {
    if (error instanceof CoachAnalysisRequestConflictError) {
      console.error(JSON.stringify({ requestId, latencyMs: Date.now() - started, success: false, errorCategory: "analysis_request_conflict" }));
      return reply(409, { error: { code: "analysis_request_conflict", requestId } });
    }
    const code = error instanceof CoachProviderError && error.code === "timeout" ? "coach_timeout" : error instanceof CoachProviderError ? "coach_unavailable" : "coach_failed";
    // Metadata only (ADR-0107): provider stage/status/finishReason/issue paths, never content.
    const provider = error instanceof CoachProviderError ? { providerErrorCode: error.code, ...error.diagnostics } : { errorName: error instanceof Error ? error.name : typeof error };
    console.error(JSON.stringify({ requestId, latencyMs: Date.now() - started, success: false, errorCategory: code, ...provider }));
    return reply(code === "coach_failed" ? 422 : 503, { error: { code, requestId } });
  }
});
