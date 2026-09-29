import {
  isReplaceExerciseAction,
  buildIndividualResponseEvidence,
  buildIndividualResponseMemory,
  buildInterventionHistory,
  buildInterventionOutcome,
  sortInterventionOutcomes,
  type CoachDecision,
  type ComparableInterventionGroup,
  type IndividualResponseEvidence,
  type IndividualResponseMemory,
  type InterventionHistory,
  type InterventionOutcomeEvaluation,
  type TrainingProgram,
} from "@athlete-coach/domain";
import type { PerformanceReadRepository } from "../performance/ports.ts";
import type { TrainingProgramRepository } from "../training/ports.ts";
import type {
  BodyWeightHistoryReader,
  CoachDecisionReader,
  ExerciseRelationReader,
} from "./ports.ts";

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
  private readonly relations: ExerciseRelationReader | null;
  constructor(
    decisions: CoachDecisionReader,
    programs: Pick<TrainingProgramRepository, "get">,
    performance: PerformanceReadRepository,
    bodyWeights: BodyWeightHistoryReader,
    now: () => Date = () => new Date(),
    relations: ExerciseRelationReader | null = null,
  ) {
    this.decisions = decisions;
    this.programs = programs;
    this.performance = performance;
    this.bodyWeights = bodyWeights;
    this.now = now;
    this.relations = relations;
  }
  async execute(
    filter?: (decision: CoachDecision) => boolean,
  ): Promise<readonly InterventionOutcomeEvaluation[]> {
    return (await this.build(filter)).evaluations;
  }
  /** Same projection plus the owning athlete and generation instant. */
  async build(filter?: (decision: CoachDecision) => boolean): Promise<
    Readonly<{
      athleteId: string | null;
      generatedAt: string;
      evaluations: readonly InterventionOutcomeEvaluation[];
    }>
  > {
    const all = await this.decisions.list();
    const decisions = filter ? all.filter(filter) : all;
    const generatedAt = this.now().toISOString();
    const athleteId = all[0]?.athleteId ?? null;
    if (!decisions.length) return { athleteId, generatedAt, evaluations: [] };
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
    // Replacement relations are rebuilt from the stored graph for the
    // exercises actually present in the source and activated programs.
    const hasReplacement = decisions.some((decision) =>
      decision.proposal.actions.some(isReplaceExerciseAction),
    );
    const exerciseIds = [...programs.values()].flatMap((program) =>
      program
        ? program.blocks.flatMap((block) =>
            block.weeks.flatMap((week) =>
              week.days.flatMap((day) =>
                day.prescriptions.map(
                  (prescription) => prescription.exerciseId,
                ),
              ),
            ),
          )
        : [],
    );
    const exerciseRelations =
      hasReplacement && this.relations
        ? await this.relations.listRelationEdges([...new Set(exerciseIds)])
        : [];
    const interventionProgramIds = new Set(
      all
        .map((decision) => decision.materializedProgramId)
        .filter((id): id is string => id !== null),
    );
    return {
      athleteId,
      generatedAt,
      evaluations: sortInterventionOutcomes(
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
            exerciseRelations,
            generatedAt,
          }),
        ),
      ),
    };
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

const materialized = (decision: CoachDecision) =>
  decision.status === "materialized";

/** Full (default-bounded) response memory; derived, never persisted. */
export class BuildIndividualResponseMemory {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(): Promise<IndividualResponseMemory> {
    const { athleteId, generatedAt, evaluations } =
      await this.outcomes.build(materialized);
    return buildIndividualResponseMemory(evaluations, {
      athleteId,
      generatedAt,
    });
  }
}

/** One group with every episode detail (no truncation), for drill-down. */
export class GetResponseMemoryGroup {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(key: string): Promise<ComparableInterventionGroup | null> {
    const { athleteId, generatedAt, evaluations } =
      await this.outcomes.build(materialized);
    return (
      buildIndividualResponseMemory(evaluations, {
        athleteId,
        generatedAt,
        groupLimit: null,
        episodeDetailLimit: null,
      }).groups.items.find((group) => group.key === key) ?? null
    );
  }
}

export type InterventionContext = Readonly<{
  interventionHistory: InterventionHistory;
  responseMemory: IndividualResponseMemory;
}>;

/**
 * Dossier v3 context from a single outcome pass: recent decisions (history)
 * and accumulated observations (memory) without recomputing outcomes twice.
 */
export class BuildInterventionContext {
  private readonly outcomes: BuildInterventionOutcomes;
  constructor(outcomes: BuildInterventionOutcomes) {
    this.outcomes = outcomes;
  }
  async execute(): Promise<InterventionContext> {
    const { athleteId, generatedAt, evaluations } = await this.outcomes.build();
    return {
      interventionHistory: buildInterventionHistory(evaluations),
      responseMemory: buildIndividualResponseMemory(
        evaluations.filter((item) => item.status !== "not_materialized"),
        { athleteId, generatedAt },
      ),
    };
  }
}
