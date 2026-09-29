import type { ExerciseRelationType, ExerciseSummary } from "./exercise.ts";
import { exerciseRelationTypes } from "./exercise.ts";

/**
 * One stored, directed row of `exercise_relations`: "source is <type> of
 * target". Symmetric relations exist as two rows; nothing here synthesizes
 * the reverse of a one-way relation (ADR-0069).
 */
export type ExerciseRelationEdge = Readonly<{
  sourceExerciseId: string;
  targetExerciseId: string;
  relationType: ExerciseRelationType;
}>;

/**
 * A stored relation between the current (source) exercise and a candidate,
 * with the stored direction preserved:
 * - `candidate_to_source`: "candidate is <type> of source";
 * - `source_to_candidate`: "source is <type> of candidate".
 * Context only, never equivalence or suitability.
 */
export type ReplacementRelationContext = Readonly<{
  relationType: ExerciseRelationType;
  direction: "candidate_to_source" | "source_to_candidate";
}>;

export type ReplaceExerciseCandidate = Readonly<{
  exerciseId: string;
  slug: string;
  namePt: string;
  movementPattern: ExerciseSummary["movementPattern"];
  mechanics: ExerciseSummary["mechanics"];
  laterality: ExerciseSummary["laterality"];
  equipment: readonly string[];
  relations: readonly ReplacementRelationContext[];
}>;

export type ExerciseReplacementCandidateSet = Readonly<{
  sourceExerciseId: string;
  sourceExerciseName: string;
  totalAvailable: number;
  included: number;
  hasMore: boolean;
  candidates: readonly ReplaceExerciseCandidate[];
}>;

export const REPLACEMENT_CANDIDATE_LIMIT = 6;
export const REPLACEMENT_SOURCE_LIMIT = 12;

const directionOrder = ["candidate_to_source", "source_to_candidate"] as const;

function sortRelations(
  relations: readonly ReplacementRelationContext[],
): readonly ReplacementRelationContext[] {
  const unique = new Map<string, ReplacementRelationContext>();
  for (const relation of relations)
    unique.set(`${relation.relationType}|${relation.direction}`, relation);
  return [...unique.values()].sort(
    (a, b) =>
      exerciseRelationTypes.indexOf(a.relationType) -
        exerciseRelationTypes.indexOf(b.relationType) ||
      directionOrder.indexOf(a.direction) - directionOrder.indexOf(b.direction),
  );
}

/** Stored relations between two exercises, in deterministic order. */
export function relationsBetween(
  sourceExerciseId: string,
  candidateExerciseId: string,
  edges: readonly ExerciseRelationEdge[],
): readonly ReplacementRelationContext[] {
  if (sourceExerciseId === candidateExerciseId) return [];
  return sortRelations(
    edges.flatMap((edge): ReplacementRelationContext[] =>
      edge.sourceExerciseId === candidateExerciseId &&
      edge.targetExerciseId === sourceExerciseId
        ? [
            {
              relationType: edge.relationType,
              direction: "candidate_to_source" as const,
            },
          ]
        : edge.sourceExerciseId === sourceExerciseId &&
            edge.targetExerciseId === candidateExerciseId
          ? [
              {
                relationType: edge.relationType,
                direction: "source_to_candidate" as const,
              },
            ]
          : [],
    ),
  );
}

export function sameRelationContext(
  a: readonly ReplacementRelationContext[],
  b: readonly ReplacementRelationContext[],
): boolean {
  return JSON.stringify(sortRelations(a)) === JSON.stringify(sortRelations(b));
}

/**
 * Candidates are catalog exercises with at least one explicit stored relation
 * to the source, in either stored direction. Missing catalog entries are
 * dropped (never invented). Ordered by Portuguese name, then ID.
 */
export function deriveReplacementCandidates(
  sourceExerciseId: string,
  edges: readonly ExerciseRelationEdge[],
  catalog: readonly ExerciseSummary[],
  limit: number | null = REPLACEMENT_CANDIDATE_LIMIT,
): ExerciseReplacementCandidateSet {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const related = new Set(
    edges.flatMap((edge) =>
      edge.sourceExerciseId === sourceExerciseId
        ? [edge.targetExerciseId]
        : edge.targetExerciseId === sourceExerciseId
          ? [edge.sourceExerciseId]
          : [],
    ),
  );
  const all = [...related]
    .filter((id) => id !== sourceExerciseId && byId.has(id))
    .map((id) => {
      const exercise = byId.get(id)!;
      return {
        exerciseId: exercise.id,
        slug: exercise.slug,
        namePt: exercise.namePt,
        movementPattern: exercise.movementPattern,
        mechanics: exercise.mechanics,
        laterality: exercise.laterality,
        equipment: [...exercise.equipment].sort(),
        relations: relationsBetween(sourceExerciseId, exercise.id, edges),
      };
    })
    .sort(
      (a, b) =>
        a.namePt.localeCompare(b.namePt) ||
        a.exerciseId.localeCompare(b.exerciseId),
    );
  const candidates = limit === null ? all : all.slice(0, limit);
  return {
    sourceExerciseId,
    sourceExerciseName: byId.get(sourceExerciseId)?.namePt ?? sourceExerciseId,
    totalAvailable: all.length,
    included: candidates.length,
    hasMore: all.length > candidates.length,
    candidates,
  };
}

export type ExerciseReplacementContext = Readonly<{
  totalAvailable: number;
  included: number;
  hasMore: boolean;
  items: readonly ExerciseReplacementCandidateSet[];
}>;

/** Bounded context: only exercises of the given prescriptions, never the catalog. */
export function buildExerciseReplacementContext(
  sourceExerciseIds: readonly string[],
  edges: readonly ExerciseRelationEdge[],
  catalog: readonly ExerciseSummary[],
  sourceLimit = REPLACEMENT_SOURCE_LIMIT,
): ExerciseReplacementContext {
  const sources = [...new Set(sourceExerciseIds)].sort();
  const items = sources
    .slice(0, sourceLimit)
    .map((id) => deriveReplacementCandidates(id, edges, catalog));
  return {
    totalAvailable: sources.length,
    included: items.length,
    hasMore: sources.length > items.length,
    items,
  };
}
