import { BuildInterventionOutcomes } from "../../src/index.ts";

// Shared synthetic fixtures for outcome/response-memory application tests.
export const ATHLETE = "athlete-1";
export const EXERCISE = "exercise-bench";
export const setTarget = (id, min, max) => ({
  id,
  sequence: 1,
  targetMetric: "reps",
  targetMin: min,
  targetMax: max,
  rirMin: null,
  rirMax: null,
  restMinSeconds: null,
  restMaxSeconds: null,
  tempo: null,
  loadKind: "athlete_selected",
  loadKg: null,
});
export function program(id, change = {}) {
  const {
    sets = [setTarget(`${id}-set`, 8, 10)],
    exerciseId = EXERCISE,
    ...rest
  } = change;
  return {
    id,
    athleteId: ATHLETE,
    athleteGoalId: null,
    name: id,
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    activatedAt: "2026-08-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    blocks: [
      {
        id: `${id}-b`,
        sequence: 1,
        name: "B",
        description: null,
        weeks: [
          {
            id: `${id}-w`,
            sequence: 1,
            name: null,
            notes: null,
            days: [
              {
                id: `${id}-day`,
                sequence: 1,
                name: "D",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: `${id}-p`,
                    exerciseId,
                    exerciseName: "Supino",
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...rest,
  };
}
export function decision(id, sourceId, materializedId, change = {}) {
  return {
    id,
    athleteId: ATHLETE,
    status: materializedId ? "materialized" : "proposed",
    proposal: {
      schemaVersion: "coach-proposal-v1",
      id: `proposal-${id}`,
      analysisId: "analysis",
      sourceProgramId: sourceId,
      sourceProgramRevision: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
      summary: `Proposta ${id}`,
      rationale: "Fixture",
      evidenceReferences: [
        { kind: "training_program", id: sourceId, version: "1" },
      ],
      actions: [
        {
          kind: "adjust_prescription_target",
          trainingDayId: `${sourceId}-day`,
          exercisePrescriptionId: `${sourceId}-p`,
          prescriptionSetId: `${sourceId}-set`,
          targetMetric: "reps",
          targetMin: 6,
          targetMax: 8,
          rationale: "Fixture",
          evidence: [{ kind: "exercise", id: EXERCISE, version: null }],
        },
      ],
      limitations: [],
      requiresHumanApproval: true,
      analysisSnapshot: {
        summary: "S",
        provider: "fixture",
        model: "m",
        promptVersion: "coach-system-v1",
        policyVersion: "coach-safety-v1",
        dossierSchemaVersion: "athlete-training-dossier-v1",
      },
    },
    rejectionReason: null,
    rejectionNotes: null,
    proposedAt: "2026-09-01T00:00:00.000Z",
    approvedAt: materializedId ? "2026-09-01T01:00:00.000Z" : null,
    rejectedAt: null,
    staleAt: null,
    materializedAt: materializedId ? "2026-09-01T01:00:00.000Z" : null,
    materializedProgramId: materializedId,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...change,
  };
}
export function session(
  id,
  startedAt,
  programId,
  setId,
  actualValue,
  athleteId = ATHLETE,
  exerciseId = EXERCISE,
  actualRir = null,
) {
  return {
    id,
    athleteId,
    sourceTrainingDayId: `${programId}-day`,
    sourceProgram: { id: programId, revision: 1, supersedesProgramId: null },
    programName: programId,
    dayName: "D",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      {
        id: `${id}-we`,
        sourceExercisePrescriptionId: `${programId}-p`,
        exerciseId,
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: [
          {
            id: `${id}-ws`,
            sourcePrescriptionSetId: setId,
            sequence: 1,
            status: "completed",
            plannedMetric: "reps",
            plannedTargetMin: 8,
            plannedTargetMax: 10,
            plannedRirMin: null,
            plannedRirMax: null,
            plannedRestMinSeconds: null,
            plannedRestMaxSeconds: null,
            plannedTempo: null,
            plannedLoadKind: "athlete_selected",
            plannedLoadKg: null,
            actualValue,
            actualLoadKg: 60,
            actualRir,
            performedAt: startedAt,
            restStartedAt: null,
            restEndedAt: null,
          },
        ],
      },
    ],
  };
}

export function harness({ decisions, programs, sessions = [], weights = [] }) {
  const calls = [];
  const deps = {
    decisions: { list: async () => decisions },
    programs: {
      get: async (id) => {
        calls.push(id);
        return programs.find((item) => item.id === id) ?? null;
      },
    },
    performance: {
      listHistoricalSessions: async () => sessions,
      getHistoricalSession: async () => null,
    },
    weights: { list: async () => weights },
  };
  const outcomes = new BuildInterventionOutcomes(
    deps.decisions,
    deps.programs,
    deps.performance,
    deps.weights,
    () => new Date("2026-09-30T00:00:00.000Z"),
  );
  return { outcomes, calls };
}

export const A = program("program-a", {
  status: "archived",
  archivedAt: "2026-09-10T00:00:00.000Z",
});
export const B = program("program-b", {
  revision: 2,
  activatedAt: "2026-09-10T00:00:00.000Z",
  sets: [setTarget("program-b-set", 6, 8)],
});
export const baseline = [
  session("pre-1", "2026-09-05T10:00:00.000Z", "program-a", "program-a-set", 9),
];
