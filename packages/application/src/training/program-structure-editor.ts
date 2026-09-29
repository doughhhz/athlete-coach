import type { TrainingProgram } from "@athlete-coach/domain";
import type { ProgramStructureInput } from "./schemas.ts";

/**
 * Corrective pass after Implementation Phase 18 (ADR-0095..0096): the draft
 * editor always holds and saves the WHOLE program structure.
 * "A partial editing surface must never imply a full-aggregate replacement."
 * "Saving one visible training node must preserve every untouched node in
 * the draft."
 * The screen's selected day is only a viewport; every operation below is a
 * pure, typed edit of the full tree (no generic patch), and a node disappears
 * only through an explicit remove operation.
 */
export type StructureInput = ProgramStructureInput;
type BlockInput = StructureInput["blocks"][number];
type WeekInput = BlockInput["weeks"][number];
type DayInput = WeekInput["days"][number];
type PrescriptionInput = DayInput["prescriptions"][number];
export type StructureSetInput = PrescriptionInput["sets"][number];

/** Viewport selection (indices); never a save scope. */
export type DayPath = Readonly<{ block: number; week: number; day: number }>;

const optional = (value: string | null | undefined) => value ?? undefined;

/**
 * Lossless conversion of the loaded aggregate: every block, week, day,
 * prescription and set, with lineage, names, notes, instructions, cues,
 * preferred weekday and exact RIR/rest ranges.
 */
export function programToStructureInput(
  program: TrainingProgram,
): StructureInput {
  return {
    blocks: program.blocks.map((block) => ({
      lineageId: optional(block.lineageId),
      sequence: block.sequence,
      name: block.name,
      description: optional(block.description),
      weeks: block.weeks.map((week) => ({
        lineageId: optional(week.lineageId),
        sequence: week.sequence,
        name: optional(week.name),
        notes: optional(week.notes),
        days: week.days.map((day) => ({
          lineageId: optional(day.lineageId),
          sequence: day.sequence,
          name: day.name,
          preferredWeekday: day.preferredWeekday ?? undefined,
          notes: optional(day.notes),
          prescriptions: day.prescriptions.map((prescription) => ({
            lineageId: optional(prescription.lineageId),
            sequence: prescription.sequence,
            exerciseId: prescription.exerciseId,
            instructions: optional(prescription.instructions),
            athleteCues: optional(prescription.athleteCues),
            sets: prescription.sets.map((set) => ({
              lineageId: optional(set.lineageId),
              sequence: set.sequence,
              targetMetric: set.targetMetric,
              targetMin: set.targetMin,
              targetMax: set.targetMax,
              rirMin: set.rirMin,
              rirMax: set.rirMax,
              restMinSeconds: set.restMinSeconds,
              restMaxSeconds: set.restMaxSeconds,
              tempo: set.tempo,
              loadKind: set.loadKind,
              loadKg: set.loadKg,
            })),
          })),
        })),
      })),
    })),
  };
}

/** A new, empty program: one block, one week, one day (no exercises yet). */
export function emptyStructure(): StructureInput {
  return {
    blocks: [
      {
        sequence: 1,
        name: "Bloco 1",
        weeks: [
          {
            sequence: 1,
            name: "Semana 1",
            days: [{ sequence: 1, name: "Treino A", prescriptions: [] }],
          },
        ],
      },
    ],
  };
}

export function newStructureSet(): StructureSetInput {
  return {
    sequence: 1,
    targetMetric: "reps",
    targetMin: 8,
    targetMax: 10,
    rirMin: 2,
    rirMax: 2,
    restMinSeconds: 120,
    restMaxSeconds: 120,
    tempo: null,
    loadKind: "athlete_selected",
    loadKg: null,
  };
}

const resequence = <T extends { sequence: number }>(items: readonly T[]): T[] =>
  items.map((item, index) => ({ ...item, sequence: index + 1 }));

export function dayAt(
  structure: StructureInput,
  path: DayPath,
): DayInput | null {
  return structure.blocks[path.block]?.weeks[path.week]?.days[path.day] ?? null;
}

/** Replaces exactly one day; every other node is returned unchanged. */
function mapDay(
  structure: StructureInput,
  path: DayPath,
  update: (day: DayInput) => DayInput,
): StructureInput {
  if (!dayAt(structure, path)) throw new Error("Dia selecionado não existe.");
  return {
    blocks: structure.blocks.map((block, blockIndex) =>
      blockIndex !== path.block
        ? block
        : {
            ...block,
            weeks: block.weeks.map((week, weekIndex) =>
              weekIndex !== path.week
                ? week
                : {
                    ...week,
                    days: week.days.map((day, dayIndex) =>
                      dayIndex !== path.day ? day : update(day),
                    ),
                  },
            ),
          },
    ),
  };
}

function mapPrescription(
  structure: StructureInput,
  path: DayPath,
  index: number,
  update: (prescription: PrescriptionInput) => PrescriptionInput,
): StructureInput {
  return mapDay(structure, path, (day) => {
    if (!day.prescriptions[index]) throw new Error("Exercício não existe.");
    return {
      ...day,
      prescriptions: day.prescriptions.map((prescription, i) =>
        i === index ? update(prescription) : prescription,
      ),
    };
  });
}

export const structureEdits = {
  renameBlock(structure: StructureInput, path: DayPath, name: string) {
    return {
      blocks: structure.blocks.map((block, index) =>
        index === path.block ? { ...block, name } : block,
      ),
    };
  },
  renameWeek(structure: StructureInput, path: DayPath, name: string) {
    return {
      blocks: structure.blocks.map((block, blockIndex) =>
        blockIndex !== path.block
          ? block
          : {
              ...block,
              weeks: block.weeks.map((week, weekIndex) =>
                weekIndex === path.week ? { ...week, name } : week,
              ),
            },
      ),
    };
  },
  renameDay(structure: StructureInput, path: DayPath, name: string) {
    return mapDay(structure, path, (day) => ({ ...day, name }));
  },
  /** Adds a day at the end of the selected week (new lineage server-side). */
  addDay(structure: StructureInput, path: DayPath, name: string) {
    return {
      blocks: structure.blocks.map((block, blockIndex) =>
        blockIndex !== path.block
          ? block
          : {
              ...block,
              weeks: block.weeks.map((week, weekIndex) =>
                weekIndex !== path.week
                  ? week
                  : {
                      ...week,
                      days: resequence([
                        ...week.days,
                        { sequence: 0, name, prescriptions: [] },
                      ]),
                    },
              ),
            },
      ),
    };
  },
  addPrescription(
    structure: StructureInput,
    path: DayPath,
    exerciseId: string,
  ) {
    return mapDay(structure, path, (day) => ({
      ...day,
      prescriptions: resequence([
        ...day.prescriptions,
        { sequence: 0, exerciseId, sets: [newStructureSet()] },
      ]),
    }));
  },
  /** Explicit deletion only. */
  removePrescription(structure: StructureInput, path: DayPath, index: number) {
    return mapDay(structure, path, (day) => ({
      ...day,
      prescriptions: resequence(
        day.prescriptions.filter((_, i) => i !== index),
      ),
    }));
  },
  /** Same prescription lineage; only the exercise identity changes. */
  replaceExercise(
    structure: StructureInput,
    path: DayPath,
    index: number,
    exerciseId: string,
  ) {
    return mapPrescription(structure, path, index, (prescription) => ({
      ...prescription,
      exerciseId,
    }));
  },
  /** Reorder within the day: sequence changes, lineage stays. */
  movePrescription(
    structure: StructureInput,
    path: DayPath,
    index: number,
    offset: -1 | 1,
  ) {
    return mapDay(structure, path, (day) => {
      const target = index + offset;
      if (target < 0 || target >= day.prescriptions.length) return day;
      const items = [...day.prescriptions];
      [items[index], items[target]] = [items[target]!, items[index]!];
      return { ...day, prescriptions: resequence(items) };
    });
  },
  addSet(structure: StructureInput, path: DayPath, index: number) {
    return mapPrescription(structure, path, index, (prescription) => ({
      ...prescription,
      sets: resequence([...prescription.sets, newStructureSet()]),
    }));
  },
  /** Explicit deletion only; a prescription keeps at least one set. */
  removeSet(
    structure: StructureInput,
    path: DayPath,
    index: number,
    setIndex: number,
  ) {
    return mapPrescription(structure, path, index, (prescription) =>
      prescription.sets.length <= 1
        ? prescription
        : {
            ...prescription,
            sets: resequence(
              prescription.sets.filter((_, i) => i !== setIndex),
            ),
          },
    );
  },
  /** Only the provided fields change; untouched ranges are preserved. */
  updateSet(
    structure: StructureInput,
    path: DayPath,
    index: number,
    setIndex: number,
    changes: Partial<Omit<StructureSetInput, "sequence" | "lineageId">>,
  ) {
    return mapPrescription(structure, path, index, (prescription) => ({
      ...prescription,
      sets: prescription.sets.map((set, i) =>
        i === setIndex ? { ...set, ...changes } : set,
      ),
    }));
  },
} as const;

/** Every day in the tree with its viewport path, for day selection. */
export function listDays(structure: StructureInput): readonly Readonly<{
  path: DayPath;
  label: string;
  exerciseCount: number;
}>[] {
  return structure.blocks.flatMap((block, blockIndex) =>
    block.weeks.flatMap((week, weekIndex) =>
      week.days.map((day, dayIndex) => ({
        path: { block: blockIndex, week: weekIndex, day: dayIndex },
        label: `${block.name} · ${week.name ?? `Semana ${week.sequence}`} · ${day.name}`,
        exerciseCount: day.prescriptions.length,
      })),
    ),
  );
}

/** Days that cannot be saved yet (every day needs at least one exercise). */
export function emptyDays(structure: StructureInput): readonly string[] {
  return listDays(structure)
    .filter((item) => item.exerciseCount === 0)
    .map((item) => item.label);
}
