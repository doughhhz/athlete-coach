/**
 * Idempotency key for one user-initiated analysis (UUID v4). It is not an
 * authority: the backend validates it and scopes it to the athlete; a retry of
 * the same question reuses it so no duplicate proposal is created. Shared
 * generator: `presentation/idempotency-key.ts` (also used by new-program
 * creation).
 */
export { newIdempotencyKey as newAnalysisRequestId } from "@/presentation/idempotency-key";
