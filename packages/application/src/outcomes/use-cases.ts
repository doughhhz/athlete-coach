import {
  buildIndividualResponseEvidence,
  buildInterventionHistory,
  buildInterventionOutcome,
  sortInterventionOutcomes,
  type CoachDecision,
  type IndividualResponseEvidence,
  type InterventionHistory,
  type InterventionOutcomeEvaluation,
  type TrainingProgram,
} from "@athlete-coach/domain";
import type { PerformanceReadRepository } from "../performance/ports.ts";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type { BodyWeightHistoryReader, CoachDecisionReader } from "./ports.ts";

/**
 * Rebuilds every outcome projection on demand from the decision ledger,
 * program revisions, activation timestamps and raw workouts. Nothing is
 * persisted and nothing here mutates programs, prompts or proposals.
 */
export class BuildInterventionOutcomes {
  private readonly decisions: CoachDecisionReader;
  private readonly programs: Pick<TrainingProgramRepository, "get">;
  private readonly performance: PerformanceReadRepository;
  private readonly bodyWeights: BodyWeightHistoryReader;
  private readonly now: () => Date;
  constructor(
    decisions: CoachDecisionReader,
    programs: Pick<TrainingProgramRepository, "get">,
    performance: PerformanceReadRepository,
    bodyWeights: BodyWeightHistoryReader,
    now: () => Date = () => new Date(),
  ) {
    this.decisions = decisions;
    this.programs = programs;
    this.performance = performance;
    this.bodyWeights = bodyWeights;
    this.now = now;
  }
  async execute(
    filter?: (decision: CoachDecision) => boolean,
  ): Promise<readonly InterventionOutcomeEvaluation[]> {
    const all = await this.decisions.list();
    const decisions = filter ? all.filter(filter) : all;
    if (!decisions.length) return [];
    const [sessions, bodyWeights] = await Promise.all([
      this.performance.listHistoricalSessions(),
      this.bodyWeights.list(),
    ]);
    const programIds = [
      ...new Set(
        decisions.flatMap((decision) => [
          decision.proposal.sourceProgramId,
          ...(decision.materializedProgramId
            ? [decision.materializedProgramId]
            : []),
        ]),
      ),
    ].sort();
    const programs = new Map<string, TrainingProgram | null>(
      await Promise.all(
        programIds.map(
          async (id) => [id, await this.programs.get(id)] as const,
        ),
      ),
    );
    const owned = (id: string | null, athleteId: string) => {
      const program = id ? (programs.get(id) ?? null) : null;
      return program && program.athleteId === athleteId ? program : null;
    };
    const interventionProgramIds = new Set(
      all
        .map((decision) => decision.materializedProgramId)
        .filter((id): id is string => id !== null),
    );
    const generatedAt = this.now().toISOString();
    return sortInterventionOutcomes(
      decisions.map((decision) =>
        buildInterventionOutcome({
          decision,
          sourceProgram: owned(
            decision.proposal.sourceProgramId,
            decision.athleteId,
          ),
          interventionProgram: owned(
            decision.materializedProgramId,
            decision.athleteId,
          ),
          sessions,
          bodyWeights,
          interventionProgramIds,
          generatedAt,
        }),
      ),
    );
  }
}

/** Materialized decisions only: proposals never materialized are not interventions. */
export class ListInterventionOutcomes {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  execute(): Promise<readonly InterventionOutcomeEvaluation[]> {
    return this.outcomes.execute(
      (decision) => decision.status === "materialized",
    );
  }
}

export class GetCoachDecisionOutcome {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(
    decisionId: string,
  ): Promise<InterventionOutcomeEvaluation | null> {
    const [result] = await this.outcomes.execute(
      (decision) => decision.id === decisionId,
    );
    return result ?? null;
  }
}

export class GetIndividualResponseEvidence {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(): Promise<readonly IndividualResponseEvidence[]> {
    return buildIndividualResponseEvidence(
      await this.outcomes.execute(
        (decision) => decision.status === "materialized",
      ),
    );
  }
}

/** Bounded dossier section: latest decisions of any status, newest first. */
export class BuildInterventionHistory {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(): Promise<InterventionHistory> {
    return buildInterventionHistory(await this.outcomes.execute());
  }
}
