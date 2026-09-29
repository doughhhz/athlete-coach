import {
  coachAutonomyModes,
  type AthleteTrainingDossier,
  type CoachAnalysis,
  type CoachAnalysisMode,
  type CoachAutonomyMode,
  type CoachConversationMessage,
  type CoachDecision,
  type CoachGovernanceReason,
} from "@athlete-coach/domain";
import { z } from "zod";
import type { CoachPreferenceRepository } from "./proposal-ports.ts";
import {
  CoachProposalBlockedError,
  CoachProposalValidationError,
  analysisRequestIdSchema,
  type GenerateCoachProposal,
} from "./proposal-use-cases.ts";

export const coachAutonomyModeSchema = z.enum(coachAutonomyModes);

export class GetCoachAutonomyMode {
  private readonly preferences: CoachPreferenceRepository;
  constructor(preferences: CoachPreferenceRepository) {
    this.preferences = preferences;
  }
  execute(): Promise<CoachAutonomyMode> {
    return this.preferences.getAutonomyMode();
  }
}
/** Explicit opt-in/opt-out by the athlete; the only way to change the mode. */
export class SetCoachAutonomyMode {
  private readonly preferences: CoachPreferenceRepository;
  constructor(preferences: CoachPreferenceRepository) {
    this.preferences = preferences;
  }
  async execute(input: unknown): Promise<CoachAutonomyMode> {
    return this.preferences.setAutonomyMode(
      coachAutonomyModeSchema.parse(input),
    );
  }
}

/** Builds the dossier once per request so analysis and proposal share it. */
export function memoizeDossier(
  builder: Readonly<{ execute(): Promise<AthleteTrainingDossier> }>,
): Readonly<{ execute(): Promise<AthleteTrainingDossier> }> {
  let pending: Promise<AthleteTrainingDossier> | null = null;
  return {
    execute() {
      pending ??= builder.execute().catch((error: unknown) => {
        pending = null;
        throw error;
      });
      return pending;
    },
  };
}

export const proactiveProposalStatuses = [
  "not_enabled",
  "no_change",
  "prepared",
  "blocked",
  "unavailable",
  "invalid",
] as const;
export type ProactiveProposalStatus =
  (typeof proactiveProposalStatuses)[number];
export type ProactiveProposalResult = Readonly<{
  status: ProactiveProposalStatus;
  decision: CoachDecision | null;
  reasons: readonly CoachGovernanceReason[];
  /** Operational cause for `unavailable` (never model text). */
  unavailableReason:
    "rate_limited" | "provider_unavailable" | "preference_unavailable" | null;
}>;
export type AnalyzeWithGovernanceResult = Readonly<{
  analysis: CoachAnalysis;
  analysisRequestId: string;
  autonomyMode: CoachAutonomyMode | null;
  proactiveProposal: ProactiveProposalResult;
}>;
/** Second-call budget (rate limit must count the proactive proposal call). */
export type ProactiveCallBudget = Readonly<{ tryConsume(): boolean }>;

const outcome = (
  status: ProactiveProposalStatus,
  extra: Partial<ProactiveProposalResult> = {},
): ProactiveProposalResult => ({
  status,
  decision: null,
  reasons: [],
  unavailableReason: null,
  ...extra,
});

/**
 * Continues an explicitly user-initiated analysis. In proactive mode it may
 * prepare and persist a proposal for review; it never materializes or
 * activates anything ("Initiative does not imply authority", ADR-0075).
 * Proposal failures are isolated: the analysis is always returned.
 */
export class AnalyzeAthleteWithCoachAndGovernance {
  private readonly analyze: Readonly<{
    execute(
      input: Readonly<{
        userRequest: string;
        analysisMode: CoachAnalysisMode;
        conversationContext?: readonly CoachConversationMessage[];
      }>,
    ): Promise<CoachAnalysis>;
  }>;
  private readonly propose: Pick<
    GenerateCoachProposal,
    "execute" | "findExisting"
  >;
  private readonly preferences: CoachPreferenceRepository;
  private readonly budget: ProactiveCallBudget;
  private readonly ids: () => string;
  constructor(
    analyze: AnalyzeAthleteWithCoachAndGovernance["analyze"],
    propose: Pick<GenerateCoachProposal, "execute" | "findExisting">,
    preferences: CoachPreferenceRepository,
    budget: ProactiveCallBudget = { tryConsume: () => true },
    ids: () => string = () => crypto.randomUUID(),
  ) {
    this.analyze = analyze;
    this.propose = propose;
    this.preferences = preferences;
    this.budget = budget;
    this.ids = ids;
  }
  async execute(
    input: Readonly<{
      userRequest: string;
      analysisMode: CoachAnalysisMode;
      conversationContext?: readonly CoachConversationMessage[];
      analysisRequestId?: string | null;
    }>,
  ): Promise<AnalyzeWithGovernanceResult> {
    const analysisRequestId =
      input.analysisRequestId == null
        ? this.ids()
        : analysisRequestIdSchema.parse(input.analysisRequestId);
    const analysis = await this.analyze.execute(input);
    let autonomyMode: CoachAutonomyMode;
    try {
      autonomyMode = await this.preferences.getAutonomyMode();
    } catch {
      return {
        analysis,
        analysisRequestId,
        autonomyMode: null,
        proactiveProposal: outcome("unavailable", {
          unavailableReason: "preference_unavailable",
        }),
      };
    }
    const result = (proactiveProposal: ProactiveProposalResult) => ({
      analysis,
      analysisRequestId,
      autonomyMode,
      proactiveProposal,
    });
    if (autonomyMode !== "proactive") return result(outcome("not_enabled"));
    if (analysis.safetyFlags.some((flag) => flag.blocksTrainingAdvice))
      return result(
        outcome("blocked", { reasons: ["safety_blocks_training_advice"] }),
      );
    try {
      const existing = await this.propose.findExisting(analysisRequestId);
      if (existing) return result(outcome("prepared", { decision: existing }));
      if (!this.budget.tryConsume())
        return result(
          outcome("unavailable", { unavailableReason: "rate_limited" }),
        );
      const decision = await this.propose.execute(analysis, {
        origin: "proactive",
        autonomyModeAtCreation: autonomyMode,
        analysisRequestId,
      });
      return result(
        decision ? outcome("prepared", { decision }) : outcome("no_change"),
      );
    } catch (error) {
      if (
        error instanceof CoachProposalBlockedError &&
        error.reasons.some((reason) => reason !== "proposal_validation_failed")
      )
        return result(outcome("blocked", { reasons: error.reasons }));
      if (error instanceof CoachProposalBlockedError)
        return result(outcome("invalid", { reasons: error.reasons }));
      if (
        error instanceof CoachProposalValidationError ||
        error instanceof z.ZodError
      )
        return result(outcome("invalid"));
      return result(
        outcome("unavailable", { unavailableReason: "provider_unavailable" }),
      );
    }
  }
}
