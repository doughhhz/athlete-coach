import type { BodyWeightEntry, CoachDecision } from "@athlete-coach/domain";

/** Read side of the runtime Coaching Decision Ledger, scoped by RLS/session. */
export interface CoachDecisionReader {
  list(): Promise<readonly CoachDecision[]>;
}

/** Raw body-weight history, read-only; used only as factual outcome context. */
export interface BodyWeightHistoryReader {
  list(): Promise<readonly BodyWeightEntry[]>;
}
