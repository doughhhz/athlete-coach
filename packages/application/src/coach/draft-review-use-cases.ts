import {
  DRAFT_REVIEW_HISTORY_DEFAULT_LIMIT,
  buildCoachDraftReviewEvidence,
  buildCoachDraftReviewHistory,
  type CoachDecision,
  type CoachDraftReviewEvidence,
  type CoachDraftReviewHistory,
  type TrainingProgram,
} from "@athlete-coach/domain";
import type { TrainingProgramRepository } from "../training/ports.ts";

/**
 * Implementation Phase 17 (ADR-0087..0090): derived-only review evidence of
 * materialized drafts, rebuilt from the ledger and program lifecycle. No
 * storage, no score, and never an input of any authority policy.
 */
export class BuildCoachDraftReviews {
  private readonly decisions: Readonly<{
    list(): Promise<readonly CoachDecision[]>;
  }>;
  private readonly programs: Pick<TrainingProgramRepository, "get">;
  constructor(
    decisions: Readonly<{ list(): Promise<readonly CoachDecision[]> }>,
    programs: Pick<TrainingProgramRepository, "get">,
  ) {
    this.decisions = decisions;
    this.programs = programs;
  }
  async execute(): Promise<readonly CoachDraftReviewEvidence[]> {
    const materialized = (await this.decisions.list()).filter(
      (decision) =>
        decision.status === "materialized" && decision.materializedProgramId,
    );
    const cache = new Map<string, Promise<TrainingProgram | null>>();
    const load = (id: string) => {
      let pending = cache.get(id);
      if (!pending) {
        pending = this.programs.get(id).catch(() => null);
        cache.set(id, pending);
      }
      return pending;
    };
    const items = await Promise.all(
      materialized.map(async (decision) =>
        buildCoachDraftReviewEvidence(
          decision,
          await load(decision.proposal.sourceProgramId),
          await load(decision.materializedProgramId as string),
        ),
      ),
    );
    return items.filter((item) => item !== null);
  }
}

export class GetCoachDraftReviewEvidence {
  private readonly reviews: Pick<BuildCoachDraftReviews, "execute">;
  constructor(reviews: Pick<BuildCoachDraftReviews, "execute">) {
    this.reviews = reviews;
  }
  async execute(decisionId: string): Promise<CoachDraftReviewEvidence | null> {
    return (
      (await this.reviews.execute()).find(
        (item) => item.decisionId === decisionId,
      ) ?? null
    );
  }
}

export class ListCoachDraftReviewHistory {
  private readonly reviews: Pick<BuildCoachDraftReviews, "execute">;
  constructor(reviews: Pick<BuildCoachDraftReviews, "execute">) {
    this.reviews = reviews;
  }
  async execute(
    limit: number = DRAFT_REVIEW_HISTORY_DEFAULT_LIMIT,
  ): Promise<CoachDraftReviewHistory> {
    return buildCoachDraftReviewHistory(await this.reviews.execute(), limit);
  }
}
