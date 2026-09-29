import {
  assessCoachAutoDraftEligibility,
  assessCoachProposalGovernance,
  coachDraftAuthorityModes,
  isAutoDraftAuthorityEnabled,
  type CoachAutoDraftReason,
  type CoachDecision,
  type CoachDraftAuthorityMode,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type {
  CoachAnalysisRecord,
  CoachDecisionRepository,
  CoachPreferenceRepository,
} from "./proposal-ports.ts";

export const coachDraftAuthorityModeSchema = z.enum(coachDraftAuthorityModes);

export class GetCoachDraftAuthorityMode {
  private readonly preferences: CoachPreferenceRepository;
  constructor(preferences: CoachPreferenceRepository) {
    this.preferences = preferences;
  }
  execute(): Promise<CoachDraftAuthorityMode> {
    return this.preferences.getDraftAuthorityMode();
  }
}
/** Explicit opt-in/opt-out; independent from the autonomy mode (ADR-0082). */
export class SetCoachDraftAuthorityMode {
  private readonly preferences: CoachPreferenceRepository;
  constructor(preferences: CoachPreferenceRepository) {
    this.preferences = preferences;
  }
  async execute(input: unknown): Promise<CoachDraftAuthorityMode> {
    return this.preferences.setDraftAuthorityMode(
      coachDraftAuthorityModeSchema.parse(input),
    );
  }
}

export const autoDraftStatuses = [
  "not_applicable",
  "not_enabled",
  "ineligible",
  "blocked",
  "stale",
  "existing_draft",
  "materialized",
  "failed",
] as const;
export type AutoDraftStatus = (typeof autoDraftStatuses)[number];
export type AutoDraftResult = Readonly<{
  status: AutoDraftStatus;
  policyVersion: string | null;
  reasons: readonly CoachAutoDraftReason[];
  decision: CoachDecision | null;
  /** The new inactive revision, only when status is `materialized`. */
  draftProgramId: string | null;
}>;
const outcome = (
  status: AutoDraftStatus,
  extra: Partial<AutoDraftResult> = {},
): AutoDraftResult => ({
  status,
  policyVersion: null,
  reasons: [],
  decision: null,
  draftProgramId: null,
  ...extra,
});
export const autoDraftNotApplicable = outcome("not_applicable");

/**
 * Conservative Auto-Draft (coach-auto-draft-v1). Runs server-side right after a
 * proactive decision is persisted: re-reads the preferences, recomputes
 * governance and eligibility, revalidates the source program and asks the
 * ledger for a draft through the single materialization engine. It has no path
 * to activation or to the active program (ADR-0086). Failures are isolated:
 * the decision stays reviewable.
 */
export class PrepareConservativeAutoDraft {
  private readonly preferences: CoachPreferenceRepository;
  private readonly programs: Pick<TrainingProgramRepository, "get">;
  private readonly ledger: Pick<CoachDecisionRepository, "autoDraft">;
  constructor(
    preferences: CoachPreferenceRepository,
    programs: Pick<TrainingProgramRepository, "get">,
    ledger: Pick<CoachDecisionRepository, "autoDraft">,
  ) {
    this.preferences = preferences;
    this.programs = programs;
    this.ledger = ledger;
  }
  async execute(
    decision: CoachDecision,
    record: CoachAnalysisRecord,
  ): Promise<AutoDraftResult> {
    try {
      if (decision.status === "materialized")
        return decision.materializationOrigin === "auto_draft"
          ? outcome("materialized", {
              decision,
              draftProgramId: decision.materializedProgramId,
              policyVersion: decision.autoDraft?.policyVersion ?? null,
              reasons: decision.autoDraft?.reasons ?? [],
            })
          : outcome("not_applicable", { decision });
      // Preference re-read (the database re-reads it again in the transaction).
      const [autonomyMode, draftAuthorityMode] = await Promise.all([
        this.preferences.getAutonomyMode(),
        this.preferences.getDraftAuthorityMode(),
      ]);
      if (!isAutoDraftAuthorityEnabled({ autonomyMode, draftAuthorityMode }))
        return outcome("not_enabled", { decision });
      const source = await this.programs.get(decision.proposal.sourceProgramId);
      const baseline =
        source?.status === "active" &&
        source.revision === decision.proposal.sourceProgramRevision
          ? source
          : null;
      // Recompute both policies server-side; stored classifications are not
      // the sole authority.
      const governance = assessCoachProposalGovernance({
        proposal: decision.proposal,
        sourceProgram: baseline,
        origin: decision.proposalOrigin,
        safetyBlocksTrainingAdvice: record.trainingAdviceBlocked,
        proposalValid: true,
      });
      const assessment = assessCoachAutoDraftEligibility({
        proposal: decision.proposal,
        origin: decision.proposalOrigin,
        governance,
        trainingAdviceBlocked: record.trainingAdviceBlocked,
        proposalValid: true,
      });
      const assessed = {
        decision,
        policyVersion: assessment.policyVersion,
        reasons: assessment.reasons,
      };
      if (assessment.eligibility === "blocked")
        return outcome("blocked", assessed);
      if (!baseline) return outcome("stale", assessed);
      if (
        assessment.eligibility !== "eligible" ||
        decision.autoDraft?.eligibility !== "eligible"
      )
        return outcome("ineligible", assessed);
      const result = await this.ledger.autoDraft(decision.id);
      const status: AutoDraftStatus =
        result.status === "materialized"
          ? "materialized"
          : result.status === "existing_draft"
            ? "existing_draft"
            : result.status === "stale"
              ? "stale"
              : result.status === "not_enabled"
                ? "not_enabled"
                : result.status === "blocked"
                  ? "blocked"
                  : "ineligible";
      return outcome(status, {
        ...assessed,
        decision: result.decision,
        draftProgramId:
          status === "materialized"
            ? result.decision.materializedProgramId
            : null,
      });
    } catch {
      return outcome("failed", { decision });
    }
  }
}
