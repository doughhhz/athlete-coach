import type {
  ExerciseCatalogFacets,
  ExerciseCatalogFilters,
  ExerciseDetails,
  ExerciseRelationEdge,
  ExerciseSummary,
} from "@athlete-coach/domain";

export interface ExerciseCatalogRepository {
  list(filters?: ExerciseCatalogFilters): Promise<readonly ExerciseSummary[]>;
  getBySlug(slug: string): Promise<ExerciseDetails | null>;
  /** Stored, directed relation rows touching any of the given exercises. */
  listRelationEdges(
    exerciseIds: readonly string[],
  ): Promise<readonly ExerciseRelationEdge[]>;
}

export interface AnatomyRepository {
  listCatalogFacets(): Promise<ExerciseCatalogFacets>;
}
