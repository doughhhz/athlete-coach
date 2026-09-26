import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPrescriptionSet,
  canTransitionProgram,
  assertActivatable,
} from "../src/index.ts";
const valid = {
  sequence: 1,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 1,
  rirMax: 2,
  restMinSeconds: 90,
  restMaxSeconds: 120,
  tempo: "3-1-X-0",
  loadKind: "absolute",
  loadKg: 30,
};
test("accepts structured planned targets", () =>
  assert.doesNotThrow(() => assertPrescriptionSet(valid)));
for (const [name, change] of [
  ["reversed target", { targetMax: 7 }],
  ["negative target", { targetMin: -1 }],
  ["RIR bounds", { rirMin: 3, rirMax: 2 }],
  ["rest bounds", { restMinSeconds: 120, restMaxSeconds: 60 }],
  ["tempo", { tempo: "slow" }],
  ["load consistency", { loadKind: "unprescribed", loadKg: 30 }],
  ["sequence", { sequence: 0 }],
])
  test(`rejects ${name}`, () =>
    assert.throws(() => assertPrescriptionSet({ ...valid, ...change })));
test("defines explicit lifecycle transitions", () => {
  assert.equal(canTransitionProgram("draft", "active"), true);
  assert.equal(canTransitionProgram("active", "draft"), false);
  assert.equal(canTransitionProgram("completed", "archived"), true);
});
test("activation requires a complete hierarchy", () => {
  const base = {
    id: "p",
    athleteId: "a",
    athleteGoalId: null,
    name: "P",
    description: null,
    status: "draft",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "",
    updatedAt: "",
    activatedAt: null,
    completedAt: null,
    archivedAt: null,
    blocks: [],
  };
  assert.throws(() => assertActivatable(base));
  assert.doesNotThrow(() =>
    assertActivatable({
      ...base,
      blocks: [
        {
          id: "b",
          sequence: 1,
          name: "B",
          description: null,
          weeks: [
            {
              id: "w",
              sequence: 1,
              name: null,
              notes: null,
              days: [
                {
                  id: "d",
                  sequence: 1,
                  name: "D",
                  preferredWeekday: null,
                  notes: null,
                  prescriptions: [
                    {
                      id: "e",
                      exerciseId: "x",
                      exerciseName: "X",
                      sequence: 1,
                      instructions: null,
                      athleteCues: null,
                      sets: [{ id: "s", ...valid }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  );
});
