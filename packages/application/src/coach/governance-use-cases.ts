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
import type {
  CoachAnalysisRepository,
  CoachPreferenceRepository,
} from "./proposal-ports.ts";
import {
  CoachAnalysisRequestConflictError,
  fingerprintAnalysisRequest,
} from "./analysis-request.ts";
import {
  autoDraftNotApplicable,
  type AutoDraftResult,
  type PrepareConservativeAutoDraft,
} from "./auto-draft-use-cases.ts";
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
  /** True when a retry returned the existing authoritative record (no provider call). */
  analysisReused: boolean;
  autonomyMode: CoachAutonomyMode | null;
  proactiveProposal: ProactiveProposalResult;
  /** Factual Conservative Auto-Draft state; never an approval. */
  autoDraft: AutoDraftResult;
}>;
/** Active program represented in the analysis-time dossier. */
export type AnalysisProgramContext = () => Promise<Readonly<{
  id: string;
  revision: number;
}> | null>;
/** Builds the provenance reader from the same memoized dossier as the analysis. */
export function analysisProgramFrom(
  dossier: Readonly<{ execute(): Promise<AthleteTrainingDossier> }>,
): AnalysisProgramContext {
  return async () => {
    const program = (await dossier.execute()).activeProgram;
    return program ? { id: program.id, revision: program.revision } : null;
  };
}
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
  private readonly analyses: CoachAnalysisRepository;
  private readonly analysisProgram: AnalysisProgramContext;
  private readonly propose: Pick<
    GenerateCoachProposal,
    "execute" | "findExisting"
  >;
  private readonly preferences: CoachPreferenceRepository;
  private readonly budget: ProactiveCallBudget;
  private readonly autoDraft: Pick<
    PrepareConservativeAutoDraft,
    "execute"
  > | null;
  private readonly ids: () => string;
  /**
   * `analysisProgram` must read the same (memoized) dossier the analysis used,
   * so the persisted program provenance matches what the athlete saw.
   */
  constructor(
    analyze: AnalyzeAthleteWithCoachAndGovernance["analyze"],
    analyses: CoachAnalysisRepository,
    analysisProgram: AnalysisProgramContext,
    propose: Pick<GenerateCoachProposal, "execute" | "findExisting">,
    preferences: CoachPreferenceRepository,
    budget: ProactiveCallBudget = { tryConsume: () => true },
    autoDraft: Pick<PrepareConservativeAutoDraft, "execute"> | null = null,
    ids: () => string = () => crypto.randomUUID(),
  ) {
    this.autoDraft = autoDraft;
    this.analyze = analyze;
    this.analyses = analyses;
    this.analysisProgram = analysisProgram;
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
    // Idempotent analysis: a retry of the same request returns the stored,
    // validated analysis without rebuilding the dossier or calling the provider.
    // The id is bound to the canonical request (ADR-0085): a different
    // question or context under the same id is a conflict, never a reuse,
    // and the provider is not called.
    const requestFingerprint = await fingerprintAnalysisRequest(input);
    const existingRecord =
      await this.analyses.findByRequestId(analysisRequestId);
    if (
      existingRecord &&
      existingRecord.requestFingerprint !== requestFingerprint
    )
      throw new CoachAnalysisRequestConflictError();
    const record =
      existingRecord ??
      (await this.analyses.recordCompleted({
        analysisRequestId,
        requestFingerprint,
        analysis: await this.analyze.execute(input),
        sourceProgram: await this.analysisProgram(),
      }));
    const analysis = record.analysis;
    const analysisReused = existingRecord !== null;
    let autonomyMode: CoachAutonomyMode;
    try {
      autonomyMode = await this.preferences.getAutonomyMode();
    } catch {
      return {
        analysis,
        analysisRequestId,
        analysisReused,
        autonomyMode: null,
        proactiveProposal: outcome("unavailable", {
          unavailableReason: "preference_unavailable",
        }),
        autoDraft: autoDraftNotApplicable,
      };
    }
    const result = (
      proactiveProposal: ProactiveProposalResult,
      autoDraft: AutoDraftResult = autoDraftNotApplicable,
    ) => ({
      analysis,
      analysisRequestId,
      analysisReused,
      autonomyMode,
      proactiveProposal,
      autoDraft,
    });
    // Conservative Auto-Draft runs only after a proactive decision exists.
    const prepared = async (decision: CoachDecision) =>
      result(
        outcome("prepared", { decision }),
        this.autoDraft
          ? await this.autoDraft.execute(decision, record)
          : autoDraftNotApplicable,
      );
    if (autonomyMode !== "proactive") return result(outcome("not_enabled"));
    if (record.trainingAdviceBlocked)
      return result(
        outcome("blocked", { reasons: ["safety_blocks_training_advice"] }),
      );
    try {
      const existing = await this.propose.findExisting(analysisRequestId);
      if (existing) return prepared(existing);
      if (!this.budget.tryConsume())
        return result(
          outcome("unavailable", { unavailableReason: "rate_limited" }),
        );
      // The freshly persisted server record is handed over directly; the
      // analysis never round-trips through the client (ADR-0078).
      const decision = await this.propose.execute(record, {
        origin: "proactive",
        autonomyModeAtCreation: autonomyMode,
      });
      return decision ? prepared(decision) : result(outcome("no_change"));
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
