import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { SupabaseCoachDecisionRepository } from "../../../packages/data-access/src/index.ts";
const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed" } });
  const requestId = crypto.randomUUID();
  try {
    const authorization = request.headers.get("authorization"), url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization) return reply(401, { error: { code: "unauthenticated", requestId } });
    // Only the platform prerequisites to verify the JWT are checked before auth (ADR-0073).
    if (!url || !anon) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error } = await authClient.auth.getUser();
    if (error || !auth.user) return reply(401, { error: { code: "unauthenticated", requestId } });
    if (!service) return reply(503, { error: { code: "coach_unavailable", requestId } });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) return reply(413, { error: { code: "request_too_large", requestId } });
    const body = JSON.parse(rawBody) as { operation?: string; decisionId?: string; reason?: string; notes?: string | null };
    if (body.operation === "list") return reply(200, { decisions: await new SupabaseCoachDecisionRepository(authClient, auth.user.id).list() });
    if (!body.decisionId) return reply(400, { error: { code: "invalid_request", requestId } });
    const repository = new SupabaseCoachDecisionRepository(createClient(url, service, { auth: { persistSession: false } }), auth.user.id);
    const decision = body.operation === "materialize" ? await repository.materialize(body.decisionId) : body.operation === "reject" && body.reason ? await repository.reject(body.decisionId, body.reason, body.notes ?? null) : null;
    return decision ? reply(200, { decision }) : reply(400, { error: { code: "invalid_request", requestId } });
  } catch { return reply(409, { error: { code: "decision_conflict", requestId } }); }
});
