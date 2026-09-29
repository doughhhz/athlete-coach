import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_PROPOSAL_SCHEMA_VERSION,
  materializeProposalPrescription,
  summarizeSetCountChanges,
  validateCoachProposal,
} from "../src/index.ts";

const set = (id, sequence, change = {}) => ({
  id,
  sequence,
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
  ...change,
});
const prescription = (id, sets, exerciseId = "bench") => ({
  id,
  exerciseId,
  exerciseName: "Supino reto",
  sequence: id === "p1" ? 1 : 2,
  instructions: null,
  athleteCues: null,
  sets,
});
const program = {
  id: "program",
  athleteId: "athlete",
  athleteGoalId: null,
  name: "P",
  description: null,
  status: "active",
  revision: 1,
  supersedesProgramId: null,
  createdAt: "",
  updatedAt: "",
  activatedAt: "",
  completedAt: null,
  archivedAt: null,
  blocks: [
    {
      id: "block",
      sequence: 1,
      name: "B",
      description: null,
      weeks: [
        {
          id: "week",
          sequence: 1,
          name: null,
          notes: null,
          days: [
            {
              id: "day",
              sequence: 1,
              name: "D",
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                prescription("p1", [
                  set("s1", 1),
                  set("s2", 2, { targetMin: 6, targetMax: 8 }),
                  set("s3", 3, { targetMin: 10, targetMax: 12 }),
                ]),
                prescription("p2", [set("t1", 1)], "row"),
              ],
            },
          ],
        },
      ],
    },
  ],
};
const evidence = { kind: "training_program", id: "program", version: "1" };
const planned = (change = {}) => {
  const { id: _id, sequence: _sequence, ...rest } = set("x", 1, change);
  return rest;
};
const add = (change = {}) => ({
  kind: "add_prescription_set",
  trainingDayId: "day",
  exercisePrescriptionId: "p1",
  position: "end",
  copyFromPrescriptionSetId: null,
  plannedSet: planned(),
  rationale: "Considerar uma série adicional.",
  evidence: [evidence],
  ...change,
});
const remove = (setId, prescriptionId = "p1") => ({
  kind: "remove_prescription_set",
  trainingDayId: "day",
  exercisePrescriptionId: prescriptionId,
  prescriptionSetId: setId,
  rationale: "Considerar uma série a menos.",
  evidence: [evidence],
});
const proposal = (actions, change = {}) => ({
  schemaVersion: "coach-proposal-v2",
  id: "proposal",
  analysisId: "analysis",
  sourceProgramId: "program",
  sourceProgramRevision: 1,
  createdAt: "2026-09-28T12:00:00Z",
  summary: "S",
  rationale: "R",
  evidenceReferences: [evidence],
  actions,
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-proposal-prompt-v4",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
  ...change,
});
const context = {
  athleteId: "athlete",
  sourceProgram: program,
  activeProgramId: "program",
  evidenceIds: new Set(["training_program:program"]),
};
const validate = (actions, change) =>
  validateCoachProposal(proposal(actions, change), context);
const codes = (result) => result.issues.map((issue) => issue.code);

// ADD ---------------------------------------------------------------------

test("contract v3 is the current proposal version; v2 set-count proposals stay valid", () =>
  assert.equal(COACH_PROPOSAL_SCHEMA_VERSION, "coach-proposal-v3"));

test("valid add-set action (with explicit snapshot and copy provenance)", () => {
  assert.equal(validate([add()]).valid, true);
  assert.equal(
    validate([add({ copyFromPrescriptionSetId: "s3" })]).valid,
    true,
  );
});

for (const [name, plannedSet] of [
  ["invalid metric", planned({ targetMetric: "calories" })],
  ["different metric than prescription", planned({ targetMetric: "seconds" })],
  ["invalid target", planned({ targetMin: 10, targetMax: 8 })],
  ["invalid RIR", planned({ rirMin: 3, rirMax: 11 })],
  ["half-specified RIR", planned({ rirMin: 2, rirMax: null })],
  ["invalid rest", planned({ restMinSeconds: 120, restMaxSeconds: 60 })],
  ["invalid load", planned({ loadKind: "absolute", loadKg: null })],
  ["invalid tempo", planned({ tempo: "fast" })],
])
  test(`add set rejects ${name}`, () =>
    assert.deepEqual(codes(validate([add({ plannedSet })])), [
      "invalid_structure",
    ]));

test("add set rejects wrong prescription, wrong program and foreign copy source", () => {
  assert.deepEqual(codes(validate([add({ exercisePrescriptionId: "nope" })])), [
    "missing_entity",
  ]);
  assert.deepEqual(codes(validate([add({ trainingDayId: "other-day" })])), [
    "missing_entity",
  ]);
  assert.deepEqual(
    codes(validate([add({ copyFromPrescriptionSetId: "t1" })])),
    ["missing_entity"],
  );
  assert.ok(
    codes(validate([add()], { sourceProgramId: "other" })).includes(
      "wrong_source_program",
    ),
  );
  assert.ok(
    codes(
      validateCoachProposal(proposal([add()]), {
        ...context,
        athleteId: "other",
      }),
    ).includes("wrong_athlete"),
  );
});

test("v1 snapshots never accept set-count actions", () =>
  assert.ok(
    codes(validate([add()], { schemaVersion: "coach-proposal-v1" })).includes(
      "invalid_action",
    ),
  ));

// REMOVE ------------------------------------------------------------------

test("valid removal", () => assert.equal(validate([remove("s2")]).valid, true));

test("removal rejects nonexistent set, wrong prescription and duplicates", () => {
  assert.deepEqual(codes(validate([remove("missing")])), ["missing_entity"]);
  assert.deepEqual(codes(validate([remove("t1")])), ["missing_entity"]);
  assert.deepEqual(codes(validate([remove("s1"), remove("s1")])), [
    "invalid_action",
  ]);
});

test("removing the last set is rejected", () =>
  assert.deepEqual(codes(validate([remove("t1", "p2")])), [
    "invalid_structure",
  ]));

// MULTIPLE ----------------------------------------------------------------

test("remove plus add in the same prescription is valid and keeps count", () => {
  const result = validate([remove("s3"), add()]);
  assert.equal(result.valid, true);
  const [summary] = summarizeSetCountChanges(
    proposal([remove("s3"), add()]),
    program,
  );
  assert.equal(summary.beforeSetCount, 3);
  assert.equal(summary.afterSetCount, 3);
  assert.equal(summary.absoluteDelta, 0);
});

test("conflicting actions are rejected rather than guessed", () => {
  assert.deepEqual(
    codes(validate([remove("s3"), add({ copyFromPrescriptionSetId: "s3" })])),
    ["invalid_action"],
  );
  assert.deepEqual(
    codes(
      validate([
        remove("s2"),
        {
          kind: "adjust_prescription_rir",
          trainingDayId: "day",
          exercisePrescriptionId: "p1",
          prescriptionSetId: "s2",
          rirMin: 1,
          rirMax: 1,
          rationale: "r",
          evidence: [evidence],
        },
      ]),
    ),
    ["invalid_action"],
  );
});

test("final structure invalid when every set of a prescription is removed", () =>
  assert.ok(
    codes(validate([remove("s1"), remove("s2"), remove("s3")])).includes(
      "invalid_structure",
    ),
  ));

// MATERIALIZATION MIRROR --------------------------------------------------

test("mirror removes, renumbers contiguously and appends in action order", () => {
  const result = materializeProposalPrescription(
    program.blocks[0].weeks[0].days[0].prescriptions[0],
    [
      remove("s2"),
      add({ plannedSet: planned({ targetMin: 5, targetMax: 5 }) }),
      add({ plannedSet: planned({ targetMin: 4, targetMax: 4 }) }),
    ],
  );
  assert.deepEqual(
    result.sets.map((item) => [item.sequence, item.targetMin, item.targetMax]),
    [
      [1, 8, 10],
      [2, 10, 12],
      [3, 5, 5],
      [4, 4, 4],
    ],
  );
  assert.deepEqual(
    result.sets.map((item) => item.id),
    ["s1", "s3", "proposed:1", "proposed:2"],
  );
});

test("summary reports 3 → 4 with the explicit new set and 4 → 3 removals", () => {
  const [added] = summarizeSetCountChanges(proposal([add()]), program);
  assert.deepEqual(
    [added.beforeSetCount, added.afterSetCount, added.absoluteDelta],
    [3, 4, 1],
  );
  assert.equal(added.exerciseName, "Supino reto");
  assert.deepEqual(added.addedSets[0], planned());
  const [removed] = summarizeSetCountChanges(proposal([remove("s3")]), program);
  assert.deepEqual([removed.beforeSetCount, removed.afterSetCount], [3, 2]);
  assert.equal(removed.removedSets[0].id, "s3");
  assert.deepEqual(summarizeSetCountChanges(proposal([add()]), null), []);
});
