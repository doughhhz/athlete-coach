import type {
  ExerciseCatalogFacets,
  ExerciseCatalogFilters,
  ExerciseDetails,
  ExerciseSummary,
} from "@athlete-coach/domain";

export interface ExerciseCatalogRepository {
  list(filters?: ExerciseCatalogFilters): Promise<readonly ExerciseSummary[]>;
  getBySlug(slug: string): Promise<ExerciseDetails | null>;
}

export interface AnatomyRepository {
  listCatalogFacets(): Promise<ExerciseCatalogFacets>;
}
