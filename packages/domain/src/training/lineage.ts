import type {
  ExercisePrescription,
  PrescriptionSet,
  TrainingProgram,
} from "./training.ts";

/**
 * Implementation Phase 18 (ADR-0091..0094): the single canonical structural
 * matcher between two revisions of a training program.
 * "Revision identity is not sequence identity."
 * "Reordering an existing training element does not make it a new element."
 * "Lineage identifies structural continuity; it does not imply semantic
 * equivalence of changed exercise content."
 */
export const structureMatchingStrategies = [
  "lineage",
  "legacy_position",
] as const;
export type StructureMatchingStrategy =
  (typeof structureMatchingStrategies)[number];

export type StructuralPath = Readonly<{
  blockSequence: number;
  weekSequence: number;
  daySequence: number;
  prescriptionSequence: number;
}>;
export type LocatedPrescription = Readonly<{
  path: StructuralPath;
  prescription: ExercisePrescription;
}>;

export function prescriptionKey(path: StructuralPath): string {
  return `${path.blockSequence}.${path.weekSequence}.${path.daySequence}.${path.prescriptionSequence}`;
}

export function flattenPrescriptions(
  program: TrainingProgram,
): readonly LocatedPrescription[] {
  return program.blocks.flatMap((block) =>
    block.weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.prescriptions.map((prescription) => ({
          path: {
            blockSequence: block.sequence,
            weekSequence: week.sequence,
            daySequence: day.sequence,
            prescriptionSequence: prescription.sequence,
          },
          prescription,
        })),
      ),
    ),
  );
}

function hasCompleteLineage(program: TrainingProgram): boolean {
  return flattenPrescriptions(program).every(
    ({ prescription }) =>
      Boolean(prescription.lineageId) &&
      prescription.sets.every((set) => Boolean(set.lineageId)),
  );
}

/**
 * Lineage matching is valid only when the compared revision was created with
 * lineage continuity from its source and both structures carry lineage.
 * Otherwise the explicit legacy positional fallback is used (never a guess).
 */
export function structureMatchingStrategy(
  source: TrainingProgram | null,
  compared: TrainingProgram | null,
): StructureMatchingStrategy {
  return source &&
    compared &&
    compared.lineageTracked === true &&
    hasCompleteLineage(source) &&
    hasCompleteLineage(compared)
    ? "lineage"
    : "legacy_position";
}

export type PrescriptionMatch = Readonly<{
  pairs: readonly Readonly<{
    expected: LocatedPrescription;
    compared: LocatedPrescription;
  }>[];
  removed: readonly LocatedPrescription[];
  added: readonly LocatedPrescription[];
}>;

/** Matches prescriptions by lineage, or by structural path in legacy mode. */
export function matchPrescriptions(
  expected: readonly LocatedPrescription[],
  compared: readonly LocatedPrescription[],
  strategy: StructureMatchingStrategy,
): PrescriptionMatch {
  const keyOf = (item: LocatedPrescription) =>
    strategy === "lineage"
      ? (item.prescription.lineageId ??
        `no-lineage:${prescriptionKey(item.path)}`)
      : prescriptionKey(item.path);
  const byKey = new Map(compared.map((item) => [keyOf(item), item]));
  const pairs: {
    expected: LocatedPrescription;
    compared: LocatedPrescription;
  }[] = [];
  const removed: LocatedPrescription[] = [];
  const used = new Set<string>();
  for (const item of expected) {
    const key = keyOf(item);
    const counterpart = byKey.get(key);
    if (counterpart && !used.has(key)) {
      used.add(key);
      pairs.push({ expected: item, compared: counterpart });
    } else removed.push(item);
  }
  return {
    pairs,
    removed,
    added: compared.filter((item) => !used.has(keyOf(item))),
  };
}

export type SetMatch = Readonly<{
  pairs: readonly Readonly<{
    expected: PrescriptionSet;
    compared: PrescriptionSet;
  }>[];
  removed: readonly PrescriptionSet[];
  added: readonly PrescriptionSet[];
}>;

/**
 * Matches sets by lineage (sets without lineage in the expectation — added by
 * a proposal — pair in order with new sets of the compared structure), or by
 * sequence in legacy mode.
 */
export function matchSets(
  expected: readonly PrescriptionSet[],
  compared: readonly PrescriptionSet[],
  strategy: StructureMatchingStrategy,
): SetMatch {
  const bySequence = (sets: readonly PrescriptionSet[]) =>
    [...sets].sort((a, b) => a.sequence - b.sequence);
  const ordered = bySequence(expected);
  const others = bySequence(compared);
  const pairs: { expected: PrescriptionSet; compared: PrescriptionSet }[] = [];
  const used = new Set<PrescriptionSet>();
  if (strategy === "legacy_position") {
    for (const set of ordered) {
      const counterpart = others.find((item) => item.sequence === set.sequence);
      if (counterpart) {
        used.add(counterpart);
        pairs.push({ expected: set, compared: counterpart });
      }
    }
  } else {
    const expectedLineages = new Set(
      ordered.map((set) => set.lineageId).filter(Boolean),
    );
    for (const set of ordered.filter((item) => item.lineageId)) {
      const counterpart = others.find(
        (item) => item.lineageId === set.lineageId,
      );
      if (counterpart) {
        used.add(counterpart);
        pairs.push({ expected: set, compared: counterpart });
      }
    }
    const fresh = others.filter(
      (item) => !used.has(item) && !expectedLineages.has(item.lineageId),
    );
    ordered
      .filter((item) => !item.lineageId)
      .forEach((set, index) => {
        const counterpart = fresh[index];
        if (counterpart) {
          used.add(counterpart);
          pairs.push({ expected: set, compared: counterpart });
        }
      });
  }
  const paired = new Set(pairs.map((pair) => pair.expected));
  return {
    pairs,
    removed: ordered.filter((set) => !paired.has(set)),
    added: others.filter((set) => !used.has(set)),
  };
}
