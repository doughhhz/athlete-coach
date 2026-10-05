import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { BuildAthleteTrainingDossier, BuildInterventionContext, BuildInterventionOutcomes, GetExerciseReplacementCandidates, BuildCoachDraftReviews, ListCoachDraftReviewHistory, GenerateCoachProposal, schemaIssuePaths, GenerateCoachProposalForAnalysisRequest, CoachAnalysisNotFoundError, CoachProposalBlockedError, CoachProviderError, LoadCurrentAthleteProfile, StaleCoachAnalysisError, coachProposalRequestSchema } from "../../../packages/application/src/index.ts";
import { GeminiHttpCoachProposalProvider, createRoutingFetch } from "../../../packages/ai/src/index.ts";
import { SupabaseAthleteGoalRepository, SupabaseAthleteProfileRepository, SupabaseAthleteRepository, SupabaseBodyWeightRepository, SupabaseCoachAnalysisRepository, SupabaseCoachDecisionRepository, SupabaseCoachPreferenceRepository, SupabaseExerciseCatalogRepository, SupabasePerformanceReadRepository, SupabaseTrainingContextRepository, SupabaseTrainingProgramRepository, SupabaseWorkoutSessionRepository } from "../../../packages/data-access/src/index.ts";
const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed" } });
  const requestId = crypto.randomUUID();
  const started = Date.now();
  // Metadata-only outcome log (ADR-0107/0114): codes, counts and paths, never
  // question, analysis, proposal text or model output.
  const outcome = (level: "log" | "error", fields: Record<string, unknown>) =>
    console[level](JSON.stringify({ requestId, latencyMs: Date.now() - started, ...fields }));
  try {
    const authorization = request.headers.get("authorization"), url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization) return reply(401, { error: { code: "unauthenticated", requestId } });
    // Only the platform prerequisites to verify the JWT are checked before auth (ADR-0073).
    if (!url || !anon) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error } = await userClient.auth.getUser();
    if (error || !auth.user) return reply(401, { error: { code: "unauthenticated", requestId } });
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), apiKey = Deno.env.get("GEMINI_API_KEY");
    // ADR-0128: Nemotron (nvidia/...) via NVIDIA, Gemini via Google; one chain.
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY"), aiConfigured = !!apiKey || !!nvidiaKey;
    const aiFetch = createRoutingFetch({ nvidiaApiKey: nvidiaKey });
    if (!service) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) return reply(413, { error: { code: "request_too_large", requestId } });
    // Only `{ analysisRequestId }` is accepted. A client-returned analysis, safety flags,
    // origin or review class is rejected: authority comes from the server-owned record (ADR-0078).
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return reply(400, { error: { code: "invalid_request", requestId } }); }
    if (!coachProposalRequestSchema.safeParse(body).success) return reply(400, { error: { code: "invalid_request", requestId } });
    const athletes = new SupabaseAthleteRepository(userClient), programs = new SupabaseTrainingProgramRepository(userClient), workouts = new SupabaseWorkoutSessionRepository(userClient), performance = new SupabasePerformanceReadRepository(userClient);
    const bodyWeights = new SupabaseBodyWeightRepository(userClient);
    const profile = new LoadCurrentAthleteProfile(athletes, new SupabaseAthleteProfileRepository(userClient), new SupabaseAthleteGoalRepository(userClient), new SupabaseTrainingContextRepository(userClient), bodyWeights);
    // History reads use the caller JWT (RLS); the service client below is only for backend-owned records.
    const catalog = new SupabaseExerciseCatalogRepository(userClient);
    const interventionContext = new BuildInterventionContext(new BuildInterventionOutcomes(new SupabaseCoachDecisionRepository(userClient, auth.user.id), programs, performance, bodyWeights, undefined, catalog));
    // Dossier v6 review evidence: derived from the ledger and program lifecycle with the caller JWT (read-only).
    const draftReviews = new ListCoachDraftReviewHistory(new BuildCoachDraftReviews(new SupabaseCoachDecisionRepository(userClient, auth.user.id), programs));
    const dossier = new BuildAthleteTrainingDossier(profile, programs, workouts, performance, undefined, interventionContext, new GetExerciseReplacementCandidates(catalog), draftReviews);
    const serviceClient = createClient(url, service, { auth: { persistSession: false } });
    const analyses = new SupabaseCoachAnalysisRepository(serviceClient, auth.user.id);
    const decisions = new SupabaseCoachDecisionRepository(serviceClient, auth.user.id);
    // Safety, existing-decision reuse and staleness are resolved before the provider is needed.
    const provider = aiConfigured ? new GeminiHttpCoachProposalProvider({ apiKey: apiKey ?? "", model: Deno.env.get("AI_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite", fallbackModels: (Deno.env.get("AI_FALLBACK_MODELS") ?? Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-3.6-flash,gemini-3.8-flash").split(","), temperature: Number(Deno.env.get("COACH_TEMPERATURE") ?? "0.2"), timeoutMs: Number(Deno.env.get("COACH_TIMEOUT_MS") ?? "60000"), maxOutputTokens: Number(Deno.env.get("COACH_MAX_OUTPUT_TOKENS") ?? "8192") }, aiFetch) : { generate: () => { throw new CoachProviderError("unavailable", "Provider not configured"); } };
    const autonomyMode = await new SupabaseCoachPreferenceRepository(userClient).getAutonomyMode();
    const decision = await new GenerateCoachProposalForAnalysisRequest(analyses, new GenerateCoachProposal(dossier, programs, provider, decisions, () => requestId)).execute(body, { autonomyModeAtCreation: autonomyMode });
    outcome("log", decision
      ? { success: true, decisionStatus: decision.status, actionCount: decision.proposal.actions.length, reviewClass: decision.governance?.reviewClass ?? null }
      : { success: true, decision: null, reason: "no_concrete_proposal_or_no_active_program" });
    return reply(200, { decision });
  } catch (error) {
    if (error instanceof CoachAnalysisNotFoundError) outcome("error", { success: false, errorCategory: "analysis_not_found" });
    if (error instanceof StaleCoachAnalysisError) outcome("error", { success: false, errorCategory: "stale_analysis" });
    if (error instanceof CoachProposalBlockedError) outcome("error", { success: false, errorCategory: "proposal_blocked", reasons: error.reasons, issueCount: error.issues.length });
    if (error instanceof CoachAnalysisNotFoundError) return reply(404, { error: { code: "analysis_not_found", requestId } });
    if (error instanceof StaleCoachAnalysisError) return reply(409, { error: { code: "stale_analysis", requestId } });
    if (error instanceof CoachProposalBlockedError && error.reasons.some((reason) => reason !== "proposal_validation_failed")) return reply(422, { error: { code: "proposal_blocked", requestId } });
    // Metadata only (ADR-0107): provider stage/status/finishReason/issue paths, never content.
    if (error instanceof CoachProviderError) outcome("error", { success: false, errorCategory: error.code === "timeout" ? "coach_timeout" : "coach_unavailable", providerErrorCode: error.code, ...error.diagnostics });
    if (error instanceof CoachProviderError) return reply(503, { error: { code: error.code === "timeout" ? "coach_timeout" : "coach_unavailable", requestId } });
    // Contract re-parse (Zod: paths/codes only) or deterministic validation (count only).
    const zodIssues = (error as { issues?: unknown }).issues;
    outcome("error", {
      success: false,
      errorCategory: "proposal_invalid",
      errorName: error instanceof Error ? error.name : typeof error,
      issuePaths: Array.isArray(zodIssues) && zodIssues.every((issue) => issue && typeof issue === "object" && "path" in issue)
        ? schemaIssuePaths(zodIssues as { path: PropertyKey[]; code: string }[])
        : undefined,
      issueCount: Array.isArray(zodIssues) ? zodIssues.length : undefined,
    });
    return reply(422, { error: { code: "proposal_invalid", requestId } });
  }
});
