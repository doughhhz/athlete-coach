import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPath,
  dayAt,
  emptyDays,
  listDays,
  programStructureInputSchema,
  programToStructureInput,
  StructuralInvariantError,
  structureEdits,
  structureRemovalRules,
  structureSummaries,
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

// Implementation Phase 19: explicit block/week/day editing (ADR-0097/0098).
const lineages = (structure) =>
  JSON.stringify(structure)
    .match(/"lineageId":"[^"]+"/g)
    .map((item) => item.slice(13, -1));
const sequences = (items) => items.map((item) => item.sequence);
const W3 = { block: 1, week: 0, day: 0 };

test("addBlock appends a block with one week and one empty day, without lineage", () => {
  const structure = programToStructureInput(program);
  const next = structureEdits.addBlock(structure, "Bloco C");
  assert.equal(next.blocks.length, 3);
  assert.deepEqual(sequences(next.blocks), [1, 2, 3]);
  const added = next.blocks[2];
  assert.equal(added.name, "Bloco C");
  assert.equal(added.lineageId, undefined);
  assert.equal(added.weeks.length, 1);
  assert.equal(added.weeks[0].lineageId, undefined);
  assert.equal(added.weeks[0].days.length, 1);
  assert.equal(added.weeks[0].days[0].lineageId, undefined);
  assert.deepEqual(added.weeks[0].days[0].prescriptions, []);
  assert.deepEqual(
    next.blocks.slice(0, 2),
    structure.blocks,
    "existing blocks untouched",
  );
  assert.deepEqual(emptyDays(next), ["Bloco C · Semana 1 · Treino A"]);
  assert.equal(structure.blocks.length, 2, "input is not mutated");
});

test("addWeek appends a week with one empty day to the selected block only", () => {
  const structure = programToStructureInput(program);
  const next = structureEdits.addWeek(structure, D1);
  assert.equal(next.blocks[0].weeks.length, 3);
  assert.deepEqual(sequences(next.blocks[0].weeks), [1, 2, 3]);
  assert.equal(next.blocks[0].weeks[2].name, "Semana 3");
  assert.equal(next.blocks[0].weeks[2].lineageId, undefined);
  assert.equal(next.blocks[0].weeks[2].days.length, 1);
  assert.deepEqual(next.blocks[0].weeks.slice(0, 2), structure.blocks[0].weeks);
  assert.deepEqual(next.blocks[1], structure.blocks[1]);
});

test("addDay appends an empty day without lineage to the selected week only", () => {
  const structure = programToStructureInput(program);
  const next = structureEdits.addDay(structure, W3, "Treino C");
  const days = next.blocks[1].weeks[0].days;
  assert.deepEqual(sequences(days), [1, 2, 3]);
  assert.equal(days[2].lineageId, undefined);
  assert.deepEqual(days.slice(0, 2), structure.blocks[1].weeks[0].days);
  assert.deepEqual(next.blocks[0], structure.blocks[0]);
});

test("removeDay removes the subtree, resequences and keeps every other lineage", () => {
  const structure = programToStructureInput(program);
  const next = structureEdits.removeDay(structure, D1);
  const days = next.blocks[0].weeks[0].days;
  assert.deepEqual(
    days.map((d) => d.lineageId),
    ["D2"],
  );
  assert.deepEqual(sequences(days), [1]);
  const gone = ["D1", "P1", "P2", "S1", "S2", "S3"];
  assert.deepEqual(
    lineages(next),
    lineages(structure).filter((id) => !gone.includes(id)),
    "only the removed subtree lineage disappears",
  );
  assert.deepEqual(next.blocks[1], structure.blocks[1]);
  assert.deepEqual(next.blocks[0].weeks[1], structure.blocks[0].weeks[1]);
});

test("removeWeek and removeBlock remove whole subtrees and resequence", () => {
  const structure = programToStructureInput(program);
  const withoutWeek = structureEdits.removeWeek(structure, D1);
  assert.deepEqual(
    withoutWeek.blocks[0].weeks.map((w) => w.lineageId),
    ["W2"],
  );
  assert.deepEqual(sequences(withoutWeek.blocks[0].weeks), [1]);
  assert.equal(
    withoutWeek.blocks[0].weeks[0].notes,
    "w2",
    "remaining week keeps its data",
  );
  const withoutBlock = structureEdits.removeBlock(structure, D1);
  assert.deepEqual(
    withoutBlock.blocks.map((b) => b.lineageId),
    ["B2"],
  );
  assert.deepEqual(sequences(withoutBlock.blocks), [1]);
  assert.deepEqual(
    { ...withoutBlock.blocks[0], sequence: 2 },
    structure.blocks[1],
    "remaining block identical except for its sequence",
  );
  assert.equal(listDays(withoutBlock).length, 2);
});

test("last-node removals are rejected; rules match the canonical invariants", () => {
  const structure = programToStructureInput(program);
  assert.equal(structureRemovalRules.canRemoveBlock(structure), true);
  assert.equal(
    structureRemovalRules.canRemoveWeek(structure, W3),
    false,
    "block B has one week",
  );
  assert.equal(
    structureRemovalRules.canRemoveDay(structure, D3),
    false,
    "week 2 has one day",
  );
  assert.equal(structureRemovalRules.canRemoveDay(structure, D1), true);
  assert.throws(
    () => structureEdits.removeWeek(structure, W3),
    StructuralInvariantError,
  );
  assert.throws(
    () => structureEdits.removeDay(structure, D3),
    StructuralInvariantError,
  );
  const single = structureEdits.removeBlock(structure, D1);
  assert.equal(structureRemovalRules.canRemoveBlock(single), false);
  assert.throws(
    () => structureEdits.removeBlock(single, D1),
    StructuralInvariantError,
  );
  // Any tree reachable by allowed removals still satisfies the schema.
  assert.equal(
    programStructureInputSchema.safeParse(asUuids(single)).success,
    true,
  );
});

test("moveBlock/moveWeek/moveDay reorder with the same lineage and normalized sequences", () => {
  const structure = programToStructureInput(program);
  const blocks = structureEdits.moveBlock(structure, D1, 1);
  assert.deepEqual(
    blocks.blocks.map((b) => b.lineageId),
    ["B2", "B1"],
  );
  assert.deepEqual(sequences(blocks.blocks), [1, 2]);
  assert.deepEqual({ ...blocks.blocks[1], sequence: 1 }, structure.blocks[0]);
  const weeks = structureEdits.moveWeek(structure, D3, -1);
  assert.deepEqual(
    weeks.blocks[0].weeks.map((w) => w.lineageId),
    ["W2", "W1"],
  );
  assert.deepEqual(sequences(weeks.blocks[0].weeks), [1, 2]);
  const days = structureEdits.moveDay(structure, D1, 1);
  assert.deepEqual(
    days.blocks[0].weeks[0].days.map((d) => d.lineageId),
    ["D2", "D1"],
  );
  assert.deepEqual(sequences(days.blocks[0].weeks[0].days), [1, 2]);
  assert.deepEqual(days.blocks[1], structure.blocks[1]);
  assert.deepEqual(
    [...lineages(days)].sort(),
    [...lineages(structure)].sort(),
    "no lineage lost",
  );
  assert.deepEqual(
    structureEdits.moveDay(structure, D1, -1),
    structure,
    "boundary move is a no-op",
  );
});

test("summaries give factual counts for confirmations", () => {
  const structure = programToStructureInput(program);
  assert.deepEqual(structureSummaries.block(structure, D1), {
    name: "Bloco A",
    weeks: 2,
    days: 3,
    exercises: 4,
    sets: 5,
  });
  assert.deepEqual(structureSummaries.week(structure, D3), {
    name: "Semana 2",
    weeks: 1,
    days: 1,
    exercises: 1,
    sets: 1,
  });
  assert.deepEqual(structureSummaries.day(structure, D1), {
    name: "Dia 1",
    weeks: 0,
    days: 1,
    exercises: 2,
    sets: 3,
  });
  assert.equal(
    structureSummaries.day(structure, { block: 9, week: 0, day: 0 }),
    null,
  );
});

test("clampPath keeps the viewport inside the tree after removals", () => {
  const structure = programToStructureInput(program);
  const withoutBlock = structureEdits.removeBlock(structure, W3);
  assert.deepEqual(clampPath(withoutBlock, { block: 1, week: 0, day: 1 }), {
    block: 0,
    week: 0,
    day: 1,
  });
  const withoutDay = structureEdits.removeDay(structure, {
    block: 1,
    week: 0,
    day: 1,
  });
  assert.deepEqual(clampPath(withoutDay, { block: 1, week: 0, day: 1 }), W3);
  assert.deepEqual(clampPath(structure, { block: 0, week: 5, day: 5 }), {
    block: 0,
    week: 1,
    day: 0,
  });
});

test("structural edits keep Coach/Auto-Draft changes on other days intact", () => {
  // A Coach or auto-draft revision changed D4 (RIR increase) and D5 (rest
  // increase); the athlete then adds/removes/reorders elsewhere.
  const coach = structureEdits.updateSet(
    structureEdits.updateSet(programToStructureInput(program), W3, 0, 0, {
      rirMin: 3,
      rirMax: 4,
    }),
    { block: 1, week: 0, day: 1 },
    0,
    0,
    { restMinSeconds: 150, restMaxSeconds: 210 },
  );
  let next = structureEdits.addWeek(coach, D1);
  next = structureEdits.removeDay(next, D1);
  next = structureEdits.moveWeek(next, D3, -1);
  next = structureEdits.addBlock(next, "Bloco C");
  assert.deepEqual(
    next.blocks[1],
    coach.blocks[1],
    "Coach-changed block B identical",
  );
  const set = next.blocks[1].weeks[0].days[0].prescriptions[0].sets[0];
  assert.deepEqual([set.rirMin, set.rirMax, set.lineageId], [3, 4, "S6"]);
});

test("draft edit session: dirty on edit, clean only after save success or discard", async () => {
  const {
    cleanDraftEditSession,
    draftEditTransition,
    shouldGuardDraftLeave,
    draftLeaveOptions,
  } = await import("../src/index.ts");
  const clean = cleanDraftEditSession;
  assert.equal(
    shouldGuardDraftLeave(clean),
    false,
    "clean draft leaves without a prompt",
  );
  const edited = draftEditTransition(clean, "edited");
  assert.equal(shouldGuardDraftLeave(edited), true);
  const saving = draftEditTransition(edited, "save_started");
  assert.deepEqual(
    saving,
    { dirty: true, saving: true },
    "still dirty while saving",
  );
  const failed = draftEditTransition(saving, "save_failed");
  assert.deepEqual(
    failed,
    { dirty: true, saving: false },
    "failure keeps dirty",
  );
  assert.equal(shouldGuardDraftLeave(failed), true);
  assert.deepEqual(draftEditTransition(saving, "save_succeeded"), clean);
  assert.deepEqual(draftEditTransition(edited, "discarded"), clean);
  assert.deepEqual(
    draftLeaveOptions.map((option) => option.label),
    ["Continuar editando", "Descartar alterações"],
  );
});
