import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { ApproveCoachProposal, CoachDecisionNotFoundError, CoachProposalBlockedError, ElevatedReviewConfirmationRequiredError } from "../../../packages/application/src/index.ts";
import { SupabaseCoachDecisionRepository, SupabaseTrainingProgramRepository } from "../../../packages/data-access/src/index.ts";
const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed" } });
  const requestId = crypto.randomUUID();
  const started = Date.now();
  let operation: unknown = null;
  // Metadata-only outcome log (ADR-0114): operation, codes and DB error codes,
  // never proposal content, notes or ids beyond the request id.
  const outcome = (level: "log" | "error", fields: Record<string, unknown>) =>
    console[level](JSON.stringify({ requestId, operation, latencyMs: Date.now() - started, ...fields }));
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
    const body = JSON.parse(rawBody) as { operation?: string; decisionId?: string; reason?: string; notes?: string | null; confirmElevatedReview?: unknown };
    operation = (body as { operation?: unknown })?.operation ?? null;
    if (body.operation === "list") return reply(200, { decisions: await new SupabaseCoachDecisionRepository(authClient, auth.user.id).list() });
    if (!body.decisionId) return reply(400, { error: { code: "invalid_request", requestId } });
    const repository = new SupabaseCoachDecisionRepository(createClient(url, service, { auth: { persistSession: false } }), auth.user.id);
    // Governance is recomputed server-side (reads with the caller JWT); a client-sent review class is ignored.
    // Elevated review needs the explicit human confirmation flag; nothing is ever activated here (ADR-0076).
    const decision = body.operation === "materialize" ? await new ApproveCoachProposal(new SupabaseCoachDecisionRepository(authClient, auth.user.id), new SupabaseTrainingProgramRepository(authClient), repository).execute(body.decisionId, { confirmElevatedReview: body.confirmElevatedReview === true }) : body.operation === "reject" && body.reason ? await repository.reject(body.decisionId, body.reason, body.notes ?? null) : null;
    if (decision) outcome("log", { success: true, decisionStatus: decision.status, materializationOrigin: decision.materializationOrigin ?? null });
    return decision ? reply(200, { decision }) : reply(400, { error: { code: "invalid_request", requestId } });
  } catch (error) {
    const cause = (error as { cause?: { code?: unknown; message?: unknown } }).cause;
    outcome("error", {
      success: false,
      errorName: error instanceof Error ? error.name : typeof error,
      errorCategory: error instanceof ElevatedReviewConfirmationRequiredError ? "elevated_review_confirmation_required"
        : error instanceof CoachDecisionNotFoundError ? "decision_not_found"
        : error instanceof CoachProposalBlockedError ? "proposal_blocked"
        : "decision_conflict",
      reasons: error instanceof CoachProposalBlockedError ? error.reasons : undefined,
      // Postgres error code/message from the RPC (e.g. P0002, 23514), no row data.
      dbCode: typeof cause?.code === "string" ? cause.code : undefined,
      dbMessage: typeof cause?.message === "string" ? cause.message.slice(0, 160) : undefined,
    });
    if (error instanceof ElevatedReviewConfirmationRequiredError) return reply(409, { error: { code: "elevated_review_confirmation_required", requestId } });
    if (error instanceof CoachDecisionNotFoundError) return reply(404, { error: { code: "decision_not_found", requestId } });
    if (error instanceof CoachProposalBlockedError) return reply(422, { error: { code: "proposal_blocked", requestId } });
    return reply(409, { error: { code: "decision_conflict", requestId } });
  }
});
