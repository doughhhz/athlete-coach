import assert from "node:assert/strict";
import test from "node:test";
import {
  dayAt,
  emptyDays,
  listDays,
  programStructureInputSchema,
  programToStructureInput,
  structureEdits,
} from "../src/index.ts";

// Corrective pass after Implementation Phase 18: viewport is never the save
// scope; every untouched node must survive an edit of one visible day.
const set = (lineageId, sequence, change = {}) => ({
  id: `row-${lineageId}`,
  lineageId,
  sequence,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 1,
  rirMax: 3,
  restMinSeconds: 90,
  restMaxSeconds: 150,
  tempo: "3-1-1-0",
  loadKind: "absolute",
  loadKg: 62.5,
  ...change,
});
const prescription = (lineageId, sequence, exerciseId, sets) => ({
  id: `row-${lineageId}`,
  lineageId,
  exerciseId,
  exerciseName: exerciseId,
  sequence,
  instructions: `instr-${lineageId}`,
  athleteCues: `cue-${lineageId}`,
  sets,
});
const day = (lineageId, sequence, name, prescriptions) => ({
  id: `row-${lineageId}`,
  lineageId,
  sequence,
  name,
  preferredWeekday: sequence,
  notes: `notes-${lineageId}`,
  prescriptions,
});
// 2 blocks, 3 weeks, 5 days.
const program = {
  id: "program",
  athleteId: "athlete",
  athleteGoalId: null,
  name: "P",
  description: null,
  status: "draft",
  revision: 2,
  supersedesProgramId: "source",
  createdAt: "",
  updatedAt: "",
  activatedAt: null,
  completedAt: null,
  archivedAt: null,
  lineageTracked: true,
  blocks: [
    {
      id: "row-B1",
      lineageId: "B1",
      sequence: 1,
      name: "Bloco A",
      description: "desc",
      weeks: [
        {
          id: "row-W1",
          lineageId: "W1",
          sequence: 1,
          name: "Semana 1",
          notes: null,
          days: [
            day("D1", 1, "Dia 1", [
              prescription("P1", 1, "bench", [set("S1", 1), set("S2", 2)]),
              prescription("P2", 2, "row", [set("S3", 1)]),
            ]),
            day("D2", 2, "Dia 2", [
              prescription("P3", 1, "squat", [set("S4", 1)]),
            ]),
          ],
        },
        {
          id: "row-W2",
          lineageId: "W2",
          sequence: 2,
          name: null,
          notes: "w2",
          days: [
            day("D3", 1, "Dia 3", [
              prescription("P4", 1, "deadlift", [set("S5", 1)]),
            ]),
          ],
        },
      ],
    },
    {
      id: "row-B2",
      lineageId: "B2",
      sequence: 2,
      name: "Bloco B",
      description: null,
      weeks: [
        {
          id: "row-W3",
          lineageId: "W3",
          sequence: 1,
          name: "Semana 1",
          notes: null,
          days: [
            day("D4", 1, "Dia 4", [
              prescription("P5", 1, "press", [set("S6", 1)]),
            ]),
            day("D5", 2, "Dia 5", [
              prescription("P6", 1, "pullup", [set("S7", 1)]),
            ]),
          ],
        },
      ],
    },
  ],
};
/** Maps readable fixture ids to UUIDs for schema validation. */
const asUuids = (structure) => {
  const ids = new Map();
  const uuid = (value) => {
    if (!ids.has(value))
      ids.set(
        value,
        `00000000-0000-4000-8000-${String(ids.size + 1).padStart(12, "0")}`,
      );
    return ids.get(value);
  };
  return JSON.parse(
    JSON.stringify(structure, (key, value) =>
      (key === "lineageId" || key === "exerciseId") && typeof value === "string"
        ? uuid(value)
        : value,
    ),
  );
};
const D1 = { block: 0, week: 0, day: 0 };
const D3 = { block: 0, week: 1, day: 0 };
const others = (structure, except) =>
  listDays(structure)
    .filter(
      (item) =>
        !except.some(
          (path) => JSON.stringify(path) === JSON.stringify(item.path),
        ),
    )
    .map((item) => dayAt(structure, item.path));

test("loader converts the whole tree losslessly (no first-node truncation)", () => {
  const structure = programToStructureInput(program);
  assert.equal(structure.blocks.length, 2);
  assert.equal(structure.blocks.flatMap((b) => b.weeks).length, 3);
  assert.equal(listDays(structure).length, 5);
  const first = structure.blocks[0].weeks[0].days[0];
  assert.equal(first.lineageId, "D1");
  assert.equal(first.notes, "notes-D1");
  assert.equal(first.preferredWeekday, 1);
  assert.equal(first.prescriptions[0].instructions, "instr-P1");
  assert.equal(first.prescriptions[0].athleteCues, "cue-P1");
  assert.deepEqual(
    [
      first.prescriptions[0].sets[0].rirMin,
      first.prescriptions[0].sets[0].rirMax,
    ],
    [1, 3],
    "ranges are not collapsed",
  );
  assert.equal(structure.blocks[0].weeks[1].notes, "w2");
  assert.equal(
    programStructureInputSchema.safeParse(asUuids(structure)).success,
    true,
  );
  assert.equal(
    JSON.stringify(structure).includes("row-"),
    false,
    "row ids are not sent",
  );
});

test("editing one day preserves every untouched block, week, day, prescription and set", () => {
  const structure = programToStructureInput(program);
  const edited = structureEdits.updateSet(structure, D1, 0, 0, {
    rirMin: 2,
    rirMax: 2,
  });
  assert.deepEqual(others(edited, [D1]), others(structure, [D1]));
  assert.deepEqual(edited.blocks[1], structure.blocks[1]);
  const setA = edited.blocks[0].weeks[0].days[0].prescriptions[0].sets[0];
  assert.deepEqual(
    [setA.rirMin, setA.rirMax, setA.restMinSeconds, setA.restMaxSeconds],
    [2, 2, 90, 150],
  );
  assert.deepEqual(
    edited.blocks[0].weeks[0].days[0].prescriptions[0].sets[1],
    structure.blocks[0].weeks[0].days[0].prescriptions[0].sets[1],
  );
});

test("edits on two days accumulate before one save; a third day is untouched", () => {
  const structure = programToStructureInput(program);
  let edited = structureEdits.updateSet(structure, D1, 0, 0, { loadKg: 60 });
  edited = structureEdits.updateSet(edited, D3, 0, 0, {
    targetMin: 5,
    targetMax: 5,
  });
  assert.equal(
    edited.blocks[0].weeks[0].days[0].prescriptions[0].sets[0].loadKg,
    60,
  );
  assert.equal(
    edited.blocks[0].weeks[1].days[0].prescriptions[0].sets[0].targetMin,
    5,
  );
  assert.deepEqual(
    dayAt(edited, { block: 0, week: 0, day: 1 }),
    dayAt(structure, { block: 0, week: 0, day: 1 }),
  );
  assert.deepEqual(edited.blocks[1], structure.blocks[1]);
});

test("reorder within one day keeps lineage and leaves other days alone", () => {
  const structure = programToStructureInput(program);
  const moved = structureEdits.movePrescription(structure, D1, 0, 1);
  const prescriptions = moved.blocks[0].weeks[0].days[0].prescriptions;
  assert.deepEqual(
    prescriptions.map((item) => [item.lineageId, item.sequence]),
    [
      ["P2", 1],
      ["P1", 2],
    ],
  );
  assert.deepEqual(others(moved, [D1]), others(structure, [D1]));
  assert.deepEqual(
    structureEdits.movePrescription(structure, D1, 0, -1),
    structure,
    "no-op at edge",
  );
});

test("add and remove sets only touch that prescription", () => {
  const structure = programToStructureInput(program);
  const added = structureEdits.addSet(structure, D1, 1, 0);
  const target = added.blocks[0].weeks[0].days[0].prescriptions[1].sets;
  assert.deepEqual(
    target.map((item) => [item.lineageId, item.sequence]),
    [
      ["S3", 1],
      [undefined, 2],
    ],
  );
  assert.deepEqual(
    added.blocks[0].weeks[0].days[0].prescriptions[0],
    structure.blocks[0].weeks[0].days[0].prescriptions[0],
  );
  const removed = structureEdits.removeSet(structure, D1, 0, 0);
  assert.deepEqual(
    removed.blocks[0].weeks[0].days[0].prescriptions[0].sets.map((item) => [
      item.lineageId,
      item.sequence,
    ]),
    [["S2", 1]],
  );
  assert.deepEqual(others(removed, [D1]), others(structure, [D1]));
  const single = structureEdits.removeSet(structure, D1, 1, 0);
  assert.equal(
    single.blocks[0].weeks[0].days[0].prescriptions[1].sets.length,
    1,
    "last set is kept",
  );
});

test("exercise swap keeps the prescription lineage and sets", () => {
  const structure = programToStructureInput(program);
  const swapped = structureEdits.replaceExercise(
    structure,
    D1,
    0,
    "dumbbell_bench",
  );
  const target = swapped.blocks[0].weeks[0].days[0].prescriptions[0];
  assert.equal(target.lineageId, "P1");
  assert.equal(target.exerciseId, "dumbbell_bench");
  assert.deepEqual(
    target.sets,
    structure.blocks[0].weeks[0].days[0].prescriptions[0].sets,
  );
  assert.deepEqual(others(swapped, [D1]), others(structure, [D1]));
});

test("nodes disappear only through explicit removal; new nodes carry no lineage", () => {
  const structure = programToStructureInput(program);
  const withNew = structureEdits.addPrescription(structure, D1, "curl");
  assert.equal(
    withNew.blocks[0].weeks[0].days[0].prescriptions[2].lineageId,
    undefined,
  );
  const removed = structureEdits.removePrescription(withNew, D1, 0);
  assert.deepEqual(
    removed.blocks[0].weeks[0].days[0].prescriptions.map((item) => [
      item.lineageId,
      item.sequence,
    ]),
    [
      ["P2", 1],
      [undefined, 2],
    ],
  );
  const extraDay = structureEdits.addDay(structure, D1, "Treino C");
  assert.equal(extraDay.blocks[0].weeks[0].days.length, 3);
  assert.deepEqual(emptyDays(extraDay), ["Bloco A · Semana 1 · Treino C"]);
  assert.equal(
    programStructureInputSchema.safeParse(asUuids(extraDay)).success,
    false,
    "an empty day cannot be saved",
  );
  assert.throws(() =>
    structureEdits.updateSet(
      structure,
      { block: 9, week: 0, day: 0 },
      0,
      0,
      {},
    ),
  );
});
