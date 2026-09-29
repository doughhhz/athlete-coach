import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { AnalyzeAthleteWithCoach, BuildAthleteTrainingDossier, BuildInterventionContext, BuildInterventionOutcomes, GetExerciseReplacementCandidates, CoachProviderError, EnsureCurrentAthlete, LoadCurrentAthleteProfile } from "../../../packages/application/src/index.ts";
import { GeminiHttpCoachModelProvider, DeterministicCoachSafetyPolicy } from "../../../packages/ai/src/index.ts";
import { SupabaseAthleteGoalRepository, SupabaseAthleteProfileRepository, SupabaseAthleteRepository, SupabaseBodyWeightRepository, SupabaseCoachDecisionRepository, SupabaseExerciseCatalogRepository, SupabasePerformanceReadRepository, SupabaseTrainingContextRepository, SupabaseTrainingProgramRepository, SupabaseWorkoutSessionRepository } from "../../../packages/data-access/src/index.ts";

const cors = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const buckets = new Map<string, number[]>();
function reply(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: cors }); }
function allowed(userId: string, now = Date.now()) { const recent = (buckets.get(userId) ?? []).filter((value) => now - value < 60_000); if (recent.length >= 10) return false; buckets.set(userId, [...recent, now]); return true; }

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
    const body = await request.json() as { userRequest?: unknown; analysisMode?: unknown; conversationContext?: unknown; athleteId?: unknown };
    if (body.athleteId !== undefined || typeof body.userRequest !== "string" || !["general_review", "workout_review", "exercise_review", "question"].includes(String(body.analysisMode))) return reply(400, { error: { code: "invalid_request", requestId } });
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const athletes = new SupabaseAthleteRepository(client);
    await new EnsureCurrentAthlete(athletes).execute();
    const bodyWeights = new SupabaseBodyWeightRepository(client), programs = new SupabaseTrainingProgramRepository(client), performance = new SupabasePerformanceReadRepository(client);
    const profile = new LoadCurrentAthleteProfile(athletes, new SupabaseAthleteProfileRepository(client), new SupabaseAthleteGoalRepository(client), new SupabaseTrainingContextRepository(client), bodyWeights);
    // Decision history is read with the caller JWT (RLS), never with the service role.
    const catalog = new SupabaseExerciseCatalogRepository(client);
    const interventionContext = new BuildInterventionContext(new BuildInterventionOutcomes(new SupabaseCoachDecisionRepository(client, auth.user.id), programs, performance, bodyWeights, undefined, catalog));
    const dossier = new BuildAthleteTrainingDossier(profile, programs, new SupabaseWorkoutSessionRepository(client), performance, undefined, interventionContext, new GetExerciseReplacementCandidates(catalog));
    const provider = new GeminiHttpCoachModelProvider({ apiKey, model: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash", temperature: Number(Deno.env.get("COACH_TEMPERATURE") ?? "0.2"), timeoutMs: Number(Deno.env.get("COACH_TIMEOUT_MS") ?? "20000"), maxOutputTokens: Number(Deno.env.get("COACH_MAX_OUTPUT_TOKENS") ?? "4096") });
    const analysis = await new AnalyzeAthleteWithCoach(dossier, provider, new DeterministicCoachSafetyPolicy(), () => requestId).execute({ userRequest: body.userRequest, analysisMode: body.analysisMode as "question", conversationContext: Array.isArray(body.conversationContext) ? body.conversationContext.slice(-6) : [] });
    console.log(JSON.stringify({ requestId, provider: analysis.metadata.provider, model: analysis.metadata.model, schemaVersion: analysis.schemaVersion, latencyMs: Date.now() - started, success: true }));
    return reply(200, { analysis });
  } catch (error) {
    const code = error instanceof CoachProviderError && error.code === "timeout" ? "coach_timeout" : error instanceof CoachProviderError ? "coach_unavailable" : "coach_failed";
    console.error(JSON.stringify({ requestId, latencyMs: Date.now() - started, success: false, errorCategory: code }));
    return reply(code === "coach_failed" ? 422 : 503, { error: { code, requestId } });
  }
});
