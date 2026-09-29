import type {
  CoachAnalysisMode,
  CoachConversationMessage,
} from "@athlete-coach/domain";
import { MAX_COACH_CONTEXT_MESSAGES } from "./use-cases.ts";

export const ANALYSIS_REQUEST_FINGERPRINT_VERSION =
  "coach-analysis-request-fingerprint-v1" as const;

/** Same analysisRequestId bound to a different request: never reused (ADR-0085). */
export class CoachAnalysisRequestConflictError extends Error {
  constructor() {
    super("Esta análise já foi registrada para outra pergunta.");
  }
}

export type CanonicalAnalysisRequestInput = Readonly<{
  userRequest: string;
  analysisMode: CoachAnalysisMode;
  conversationContext?: readonly CoachConversationMessage[];
}>;

/**
 * Deterministic canonical form of the validated request, mirroring exactly
 * what the analysis uses (trimmed question, last bounded context messages).
 * Arrays only, so object key order in the raw body never matters. No tokens,
 * keys, timestamps or random metadata.
 */
export function canonicalizeAnalysisRequest(
  input: CanonicalAnalysisRequestInput,
): string {
  const context = [...(input.conversationContext ?? [])]
    .slice(-MAX_COACH_CONTEXT_MESSAGES)
    .map((message) => [message.role, message.content]);
  return JSON.stringify([
    ANALYSIS_REQUEST_FINGERPRINT_VERSION,
    input.analysisMode,
    input.userRequest.trim(),
    context,
  ]);
}

/**
 * SHA-256 (runtime-native Web Crypto) of the canonical request. Request
 * identity integrity only; it is not authentication and not a secret.
 */
export async function fingerprintAnalysisRequest(
  input: CanonicalAnalysisRequestInput,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalizeAnalysisRequest(input)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
