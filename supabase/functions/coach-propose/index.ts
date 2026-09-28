import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { BuildAthleteTrainingDossier, BuildInterventionContext, BuildInterventionOutcomes, GenerateCoachProposal, LoadCurrentAthleteProfile, coachAnalysisSchema } from "../../../packages/application/src/index.ts";
import { GeminiHttpCoachProposalProvider } from "../../../packages/ai/src/index.ts";
import { SupabaseAthleteGoalRepository, SupabaseAthleteProfileRepository, SupabaseAthleteRepository, SupabaseBodyWeightRepository, SupabaseCoachDecisionRepository, SupabasePerformanceReadRepository, SupabaseTrainingContextRepository, SupabaseTrainingProgramRepository, SupabaseWorkoutSessionRepository } from "../../../packages/data-access/src/index.ts";
const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed" } });
  const requestId = crypto.randomUUID();
  try {
    const authorization = request.headers.get("authorization"), url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!authorization) return reply(401, { error: { code: "unauthenticated", requestId } });
    if (!url || !anon || !service || !apiKey) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error } = await userClient.auth.getUser();
    if (error || !auth.user) return reply(401, { error: { code: "unauthenticated", requestId } });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) return reply(413, { error: { code: "request_too_large", requestId } });
    const body = JSON.parse(rawBody) as { analysis?: unknown };
    const analysis = coachAnalysisSchema.parse(body.analysis);
    const athletes = new SupabaseAthleteRepository(userClient), programs = new SupabaseTrainingProgramRepository(userClient), workouts = new SupabaseWorkoutSessionRepository(userClient), performance = new SupabasePerformanceReadRepository(userClient);
    const bodyWeights = new SupabaseBodyWeightRepository(userClient);
    const profile = new LoadCurrentAthleteProfile(athletes, new SupabaseAthleteProfileRepository(userClient), new SupabaseAthleteGoalRepository(userClient), new SupabaseTrainingContextRepository(userClient), bodyWeights);
    // History reads use the caller JWT (RLS); the service client below is only for ledger writes.
    const interventionContext = new BuildInterventionContext(new BuildInterventionOutcomes(new SupabaseCoachDecisionRepository(userClient, auth.user.id), programs, performance, bodyWeights));
    const dossier = new BuildAthleteTrainingDossier(profile, programs, workouts, performance, undefined, interventionContext);
    const serviceClient = createClient(url, service, { auth: { persistSession: false } });
    const decisions = new SupabaseCoachDecisionRepository(serviceClient, auth.user.id);
    const provider = new GeminiHttpCoachProposalProvider({ apiKey, model: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash", temperature: Number(Deno.env.get("COACH_TEMPERATURE") ?? "0.2"), timeoutMs: Number(Deno.env.get("COACH_TIMEOUT_MS") ?? "20000"), maxOutputTokens: Number(Deno.env.get("COACH_MAX_OUTPUT_TOKENS") ?? "4096") });
    const decision = await new GenerateCoachProposal(dossier, programs, provider, decisions, () => requestId).execute(analysis);
    return reply(200, { decision });
  } catch { return reply(422, { error: { code: "proposal_invalid", requestId } }); }
});
