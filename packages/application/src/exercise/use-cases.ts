import {
  buildExerciseReplacementContext,
  type ExerciseCatalogFilters,
  type ExerciseReplacementContext,
  type MovementPattern,
} from "@athlete-coach/domain";
import type { AnatomyRepository, ExerciseCatalogRepository } from "./ports.ts";

export class ListExercises {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(filters: ExerciseCatalogFilters = {}) {
    return this.catalog.list(filters);
  }
}
export class SearchExercises {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(query: string, filters: Omit<ExerciseCatalogFilters, "query"> = {}) {
    return this.catalog.list({ ...filters, query: query.trim() });
  }
}
export class GetExerciseDetails {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(slug: string) {
    return this.catalog.getBySlug(slug);
  }
}
export class ListExercisesByMuscle {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(muscleSlug: string) {
    return this.catalog.list({ muscleSlug });
  }
}
export class ListExercisesByEquipment {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(equipmentSlug: string) {
    return this.catalog.list({ equipmentSlug });
  }
}
export class ListExercisesByMovementPattern {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  execute(movementPattern: MovementPattern) {
    return this.catalog.list({ movementPattern });
  }
}
export class GetExerciseRelations {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  async execute(slug: string) {
    return (await this.catalog.getBySlug(slug))?.relations ?? [];
  }
}
export class ListExerciseCatalogFacets {
  private readonly anatomy: AnatomyRepository;
  constructor(anatomy: AnatomyRepository) {
    this.anatomy = anatomy;
  }
  execute() {
    return this.anatomy.listCatalogFacets();
  }
}

/**
 * Deterministic replacement candidates for the given exercises, derived from
 * the stored relation graph and the canonical catalog (ADR-0069). The model
 * never supplies candidates.
 */
export class GetExerciseReplacementCandidates {
  private readonly catalog: ExerciseCatalogRepository;
  constructor(catalog: ExerciseCatalogRepository) {
    this.catalog = catalog;
  }
  async execute(
    exerciseIds: readonly string[],
  ): Promise<ExerciseReplacementContext> {
    const ids = [...new Set(exerciseIds)];
    if (!ids.length) return buildExerciseReplacementContext([], [], []);
    const [edges, catalog] = await Promise.all([
      this.catalog.listRelationEdges(ids),
      this.catalog.list(),
    ]);
    return buildExerciseReplacementContext(ids, edges, catalog);
  }
}
