import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildIndividualResponseMemory,
  CoachProposalValidationError,
  GenerateCoachProposal,
  GetCoachDecisionOutcome,
  coachProposalSchema,
} from "../src/index.ts";
import {
  A,
  EXERCISE,
  baseline,
  decision,
  harness,
  program,
  session,
  setTarget,
} from "./fixtures/outcome-fixtures.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const evidence = { kind: "training_program", id: uuid(1), version: "1" };
const plannedSet = {
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
const snapshot = (schemaVersion, actions) => ({
  schemaVersion,
  id: uuid(9),
  analysisId: "analysis",
  sourceProgramId: uuid(1),
  sourceProgramRevision: 1,
  createdAt: "2026-09-28T12:00:00.000Z",
  summary: "S",
  rationale: "R",
  evidenceReferences: [evidence],
  actions,
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "m",
    promptVersion: "coach-proposal-prompt-v4",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v5",
  },
});
const addAction = (change = {}) => ({
  kind: "add_prescription_set",
  trainingDayId: uuid(2),
  exercisePrescriptionId: uuid(3),
  position: "end",
  copyFromPrescriptionSetId: uuid(4),
  plannedSet,
  rationale: "r",
  evidence: [evidence],
  ...change,
});
const removeAction = (setId = uuid(4)) => ({
  kind: "remove_prescription_set",
  trainingDayId: uuid(2),
  exercisePrescriptionId: uuid(3),
  prescriptionSetId: setId,
  rationale: "r",
  evidence: [evidence],
});
const rirAction = {
  kind: "adjust_prescription_rir",
  trainingDayId: uuid(2),
  exercisePrescriptionId: uuid(3),
  prescriptionSetId: uuid(4),
  rirMin: 1,
  rirMax: 1,
  rationale: "r",
  evidence: [evidence],
};

test("historical v1 snapshots parse with the v1 schema only", () => {
  assert.equal(
    coachProposalSchema.parse(snapshot("coach-proposal-v1", [rirAction]))
      .schemaVersion,
    "coach-proposal-v1",
  );
  assert.equal(
    coachProposalSchema.safeParse(snapshot("coach-proposal-v1", [addAction()]))
      .success,
    false,
  );
});

test("v2 accepts add/remove and rejects malformed or unsupported actions", () => {
  assert.equal(
    coachProposalSchema.safeParse(
      snapshot("coach-proposal-v2", [addAction(), removeAction(uuid(5))]),
    ).success,
    true,
  );
  for (const bad of [
    addAction({ position: "start" }),
    addAction({ plannedSet: { ...plannedSet, tempo: "fast" } }),
    addAction({ plannedSet: { ...plannedSet, targetMetric: undefined } }),
    { ...removeAction(), prescriptionSetId: "not-a-uuid" },
    { kind: "set_count", exercisePrescriptionId: uuid(3), count: 5 },
    { kind: "replace_exercise", exercisePrescriptionId: uuid(3) },
  ])
    assert.equal(
      coachProposalSchema.safeParse(snapshot("coach-proposal-v2", [bad]))
        .success,
      false,
    );
});

function sourceProgram() {
  return {
    ...program(uuid(1), { sets: [setTarget(uuid(4), 8, 10)] }),
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
                id: uuid(2),
                sequence: 1,
                name: "D",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: uuid(3),
                    exerciseId: EXERCISE,
                    exerciseName: "Supino",
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets: [
                      { ...setTarget(uuid(4), 8, 10), rirMin: 2, rirMax: 2 },
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
}
const dossier = {
  schemaVersion: "athlete-training-dossier-v5",
  activeProgram: { id: uuid(1) },
  evidence: [evidence],
  last28DaysExerciseExposure: [],
  personalBests: [],
  recentSessions: { items: [] },
  interventionHistory: null,
  responseMemory: null,
};
const analysis = { safetyFlags: [] };
function generator(output) {
  const created = [];
  const use = new GenerateCoachProposal(
    { execute: async () => dossier },
    { getActive: async () => sourceProgram() },
    { generate: async () => output },
    {
      create: async (proposal) => (
        created.push(proposal),
        { id: "d", proposal }
      ),
    },
    () => "request",
  );
  return { use, created };
}

test("a valid v2 add-set proposal is validated and persisted as proposed", async () => {
  const { use, created } = generator(
    snapshot("coach-proposal-v2", [addAction()]),
  );
  await use.execute(analysis);
  assert.equal(created.length, 1);
  assert.equal(created[0].schemaVersion, "coach-proposal-v2");
});

test("removing the only set is rejected before persistence", async () => {
  const { use, created } = generator(
    snapshot("coach-proposal-v2", [removeAction()]),
  );
  await assert.rejects(
    () => use.execute(analysis),
    CoachProposalValidationError,
  );
  assert.equal(created.length, 0);
});

test("no-change remains valid with the new vocabulary", async () => {
  const { use, created } = generator(null);
  assert.equal(await use.execute(analysis), null);
  assert.equal(created.length, 0);
});

test("set-count outcome and memory use the activated count, not the proposal", async () => {
  const add = decision("d1", "program-a", "program-b");
  const setDecision = {
    ...add,
    proposal: {
      ...add.proposal,
      schemaVersion: "coach-proposal-v2",
      actions: [
        {
          kind: "add_prescription_set",
          trainingDayId: "program-a-day",
          exercisePrescriptionId: "program-a-p",
          position: "end",
          copyFromPrescriptionSetId: "program-a-set",
          plannedSet,
          rationale: "r",
          evidence: [{ kind: "exercise", id: EXERCISE, version: null }],
        },
      ],
    },
  };
  // Proposed 1 → 2, athlete activated 3 sets.
  const B = program("program-b", {
    revision: 2,
    activatedAt: "2026-09-10T00:00:00.000Z",
    sets: [
      setTarget("program-b-set", 8, 10),
      { ...setTarget("program-b-set-2", 8, 10), sequence: 2 },
      { ...setTarget("program-b-set-3", 8, 10), sequence: 3 },
    ],
  });
  const { outcomes } = harness({
    decisions: [setDecision],
    programs: [A, B],
    sessions: [
      ...baseline,
      session(
        "post-1",
        "2026-09-11T10:00:00.000Z",
        "program-b",
        "program-b-set",
        8,
      ),
    ],
  });
  const outcome = await new GetCoachDecisionOutcome(outcomes).execute("d1");
  const action = outcome.episode.actions[0];
  assert.equal(action.dimension, "set_count");
  assert.equal(action.proposedValue.count, 2);
  assert.equal(action.implementedValue.count, 3);
  const memory = await new BuildIndividualResponseMemory(outcomes).execute();
  const [group] = memory.groups.items;
  assert.equal(group.key, `${EXERCISE}.set_count`);
  assert.deepEqual(
    [
      group.episodes.items[0].signature.changes[0].before.count,
      group.episodes.items[0].signature.changes[0].after.count,
    ],
    [1, 3],
  );
});
