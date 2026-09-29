import assert from "node:assert/strict";
import test from "node:test";
import {
  SaveTrainingProgramStructure,
  ActivateTrainingProgram,
  CloneTrainingProgramAsDraft,
} from "../src/index.ts";
const structure = {
  blocks: [
    {
      sequence: 1,
      name: "Base",
      weeks: [
        {
          sequence: 1,
          days: [
            {
              sequence: 1,
              name: "A",
              prescriptions: [
                {
                  sequence: 1,
                  exerciseId: "50000000-0000-4000-8000-000000000001",
                  sets: [
                    {
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
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const program = {
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
  blocks: [
    {
      id: "b",
      ...structure.blocks[0],
      description: null,
      weeks: [
        {
          id: "w",
          ...structure.blocks[0].weeks[0],
          name: null,
          notes: null,
          days: [
            {
              id: "d",
              ...structure.blocks[0].weeks[0].days[0],
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                {
                  id: "ep",
                  exerciseName: "Supino",
                  instructions: null,
                  athleteCues: null,
                  ...structure.blocks[0].weeks[0].days[0].prescriptions[0],
                  sets: [
                    {
                      id: "s",
                      ...structure.blocks[0].weeks[0].days[0].prescriptions[0]
                        .sets[0],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
function fake() {
  return {
    saveStructure: async () => program,
    get: async () => program,
    activate: async () => ({ ...program, status: "active" }),
    cloneAsDraft: async () => ({
      ...program,
      id: "new",
      revision: 2,
      supersedesProgramId: "p",
    }),
  };
}
// ADR-0103: root creation is only the atomic, idempotent boundary; the
// two-step "create empty draft" use case no longer exists.
test("no empty-draft creation use case remains", async () => {
  const application = await import("../src/index.ts");
  assert.equal("CreateTrainingProgramDraft" in application, false);
  assert.equal("createProgramDraftInputSchema" in application, false);
  assert.equal(
    typeof application.CreateTrainingProgramWithStructure,
    "function",
  );
  assert.equal("createDraft" in fake(), false);
});
test("rejects invalid structure before repository", () =>
  assert.throws(() =>
    new SaveTrainingProgramStructure(fake()).execute("p", { blocks: [] }),
  ));
test("saves and activates complete structure", async () =>
  assert.equal(
    (await new ActivateTrainingProgram(fake()).execute("p")).status,
    "active",
  ));
test("clone creates revision lineage", async () => {
  const clone = await new CloneTrainingProgramAsDraft(fake()).execute("p");
  assert.equal(clone.supersedesProgramId, "p");
  assert.equal(clone.revision, 2);
});
