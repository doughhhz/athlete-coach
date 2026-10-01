import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAthleteTrainingDossier,
  collectDossierEvidenceIds,
  deriveProgressionSignals,
  PROGRESSION_SIGNALS_VERSION,
  progressionLoadRuleFor,
  suggestedLoadDecrease,
  suggestedLoadIncrease,
  validateCoachProposal,
} from "../src/index.ts";

const prescriptionSet = (id, sequence, change = {}) => ({
  id,
  sequence,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 1,
  rirMax: 2,
  restMinSeconds: 90,
  restMaxSeconds: 120,
  tempo: null,
  loadKind: "absolute",
  loadKg: 40,
  ...change,
});
function program(sets = [prescriptionSet("s1", 1), prescriptionSet("s2", 2)]) {
  return {
    id: "program",
    athleteId: "athlete",
    athleteGoalId: null,
    name: "P",
    description: null,
    status: "active",
    revision: 2,
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
                  {
                    id: "prescription",
                    exerciseId: "exercise",
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
  };
}
// Recorded set mirrors the planned snapshot of prescriptionSet("s1").
const workoutSet = (sourceId, change = {}) => ({
  id: `w-${sourceId}`,
  sourcePrescriptionSetId: sourceId,
  sequence: 1,
  status: "completed",
  plannedMetric: "reps",
  plannedTargetMin: 8,
  plannedTargetMax: 10,
  plannedRirMin: 1,
  plannedRirMax: 2,
  plannedRestMinSeconds: 90,
  plannedRestMaxSeconds: 120,
  plannedTempo: null,
  plannedLoadKind: "absolute",
  plannedLoadKg: 40,
  actualValue: 12,
  actualLoadKg: 40,
  actualRir: 4,
  performedAt: null,
  restStartedAt: null,
  restEndedAt: null,
  ...change,
});
const EASY = {};
const HARD = { actualValue: 6, actualRir: 0 };
function session(id, day, setChanges = [EASY, EASY], extra = {}) {
  const at = `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`;
  return {
    id,
    athleteId: "athlete",
    sourceTrainingDayId: "day",
    programName: "P",
    dayName: "D",
    status: "completed",
    athleteNotes: null,
    startedAt: at,
    completedAt: at,
    abandonedAt: null,
    createdAt: at,
    updatedAt: at,
    exercises: [
      {
        id: `we-${id}`,
        sourceExercisePrescriptionId: "prescription",
        exerciseId: "exercise",
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: setChanges.map((change, index) => ({
          ...workoutSet(`s${index + 1}`, change),
          id: `${id}-set-${index}`,
        })),
      },
    ],
    ...extra,
  };
}
const three = (changes) => [
  session("a", 10, changes),
  session("b", 12, changes),
  session("c", 14, changes),
];

test("load increase: +2.5%..+5% in 0.5 kg steps with at least +1 kg", () => {
  assert.deepEqual(suggestedLoadIncrease(40), { min: 41, max: 42 });
  assert.deepEqual(suggestedLoadIncrease(100), { min: 102.5, max: 105 });
  assert.deepEqual(suggestedLoadIncrease(41), { min: 42.5, max: 43 });
  // Percentages below 1 kg collapse to the +1 kg floor.
  assert.deepEqual(suggestedLoadIncrease(20), { min: 21, max: 21 });
  assert.deepEqual(suggestedLoadIncrease(10), { min: 11, max: 11 });
  assert.throws(() => suggestedLoadIncrease(0));
  assert.throws(() => suggestedLoadIncrease(Number.NaN));
});

test("load decrease: -5%..-10% in 0.5 kg steps, never zero", () => {
  assert.deepEqual(suggestedLoadDecrease(40), { min: 36, max: 38 });
  assert.deepEqual(suggestedLoadDecrease(100), { min: 90, max: 95 });
  assert.deepEqual(suggestedLoadDecrease(5), { min: 4.5, max: 4.5 });
  // Band narrower than a step: nearest valid load below the current one.
  assert.deepEqual(suggestedLoadDecrease(2), { min: 1.5, max: 1.5 });
  assert.equal(suggestedLoadDecrease(0.5), null);
  assert.throws(() => suggestedLoadDecrease(-1));
});

test("above plan in the 3 most recent sessions proposes a load range", () => {
  const [signal, ...rest] = deriveProgressionSignals(
    program(),
    three([EASY, EASY]),
  );
  assert.equal(rest.length, 0);
  assert.equal(signal.version, PROGRESSION_SIGNALS_VERSION);
  assert.equal(signal.direction, "above_plan");
  assert.equal(signal.recommendation, "program_load_change");
  assert.deepEqual(signal.sessionIds, ["c", "b", "a"]);
  assert.equal(signal.completedSetCount, 6);
  assert.deepEqual(
    signal.sets.map((set) => [set.prescriptionSetId, set.suggestedLoadKg]),
    [
      ["s1", { min: 41, max: 42 }],
      ["s2", { min: 41, max: 42 }],
    ],
  );
});

test("above plan boundaries: value = target max and RIR = planned max + 1", () => {
  const edge = { actualValue: 10, actualRir: 3 };
  assert.equal(
    deriveProgressionSignals(program(), three([edge, edge]))[0].direction,
    "above_plan",
  );
  for (const notAbove of [
    { actualValue: 9, actualRir: 4 },
    { actualValue: 12, actualRir: 2 },
    { actualRir: null },
    { plannedRirMax: null, plannedRirMin: null },
    // A lighter load than prescribed is not evidence the plan is easy.
    { actualLoadKg: 37.5 },
    { actualLoadKg: null },
  ])
    assert.deepEqual(
      deriveProgressionSignals(program(), three([EASY, notAbove])),
      [],
      JSON.stringify(notAbove),
    );
});

test("below plan in every set proposes a load reduction range", () => {
  const [signal] = deriveProgressionSignals(program(), three([HARD, HARD]));
  assert.equal(signal.direction, "below_plan");
  assert.equal(signal.recommendation, "program_load_change");
  assert.deepEqual(signal.sets[0].suggestedLoadKg, { min: 36, max: 38 });
  for (const notBelow of [
    { actualValue: 8, actualRir: 0 },
    { actualValue: 6, actualRir: 1 },
    // Failing with more than the prescribed load says nothing about the plan.
    { ...HARD, actualLoadKg: 42.5 },
  ])
    assert.deepEqual(
      deriveProgressionSignals(program(), three([HARD, notBelow])),
      [],
      JSON.stringify(notBelow),
    );
});

test("fewer than 3 sessions, mixed sessions or no program: no signal", () => {
  assert.deepEqual(
    deriveProgressionSignals(program(), three([EASY, EASY]).slice(1)),
    [],
  );
  assert.deepEqual(
    deriveProgressionSignals(program(), [
      session("a", 10, [HARD, HARD]),
      session("b", 12),
      session("c", 14),
    ]),
    [],
  );
  assert.deepEqual(deriveProgressionSignals(null, three([EASY, EASY])), []);
});

test("only the 3 most recent completed sessions count", () => {
  const older = session("old", 2, [HARD, HARD]);
  const abandoned = session("x", 15, [HARD, HARD], {
    status: "abandoned",
    completedAt: null,
  });
  assert.deepEqual(
    deriveProgressionSignals(program(), [
      older,
      abandoned,
      ...three([EASY, EASY]),
    ])[0].sessionIds,
    ["c", "b", "a"],
  );
  // A newer mixed session breaks the signal.
  assert.deepEqual(
    deriveProgressionSignals(program(), [
      ...three([EASY, EASY]),
      session("d", 16, [EASY, HARD]),
    ]),
    [],
  );
  // Skipped sets are ignored; a session without completed sets is not counted.
  const skipped = { status: "skipped", actualValue: null, actualRir: null };
  assert.equal(
    deriveProgressionSignals(program(), three([EASY, skipped]))[0]
      .completedSetCount,
    3,
  );
  assert.deepEqual(
    deriveProgressionSignals(program(), [
      ...three([EASY, EASY]).slice(1),
      session("s", 16, [skipped, skipped]),
    ]),
    [],
  );
});

test("athlete-selected load yields guidance only, without a load range", () => {
  const selected = program([
    prescriptionSet("s1", 1, { loadKind: "athlete_selected", loadKg: null }),
  ]);
  const chosen = { plannedLoadKind: "athlete_selected", plannedLoadKg: null };
  const [signal] = deriveProgressionSignals(selected, three([chosen]));
  assert.equal(signal.direction, "above_plan");
  assert.equal(signal.recommendation, "athlete_guidance");
  assert.equal(signal.sets[0].suggestedLoadKg, null);
  assert.deepEqual(progressionLoadRuleFor([signal], "s1"), {
    covered: true,
    direction: "above_plan",
    range: null,
  });
  assert.deepEqual(progressionLoadRuleFor([signal], "other"), {
    covered: false,
  });
});

const snapshot = {
  athlete: { id: "athlete", userId: "user", onboardingCompletedAt: null },
  profile: {
    athleteId: "athlete",
    birthDate: null,
    heightCm: null,
    preferredName: null,
    timezone: "UTC",
  },
  activeGoal: null,
  trainingContext: null,
  availableWeekdays: [],
  latestWeight: null,
};
test("dossier v8 carries the signals and their evidence", () => {
  const dossier = buildAthleteTrainingDossier({
    snapshot,
    activeProgram: program(),
    sessions: three([EASY, EASY]),
    generatedAt: "2026-09-20T12:00:00.000Z",
  });
  assert.equal(dossier.schemaVersion, "athlete-training-dossier-v8");
  assert.equal(dossier.progressionSignals.length, 1);
  assert.ok(
    dossier.evidence.some(
      (item) =>
        item.id === "progression_signals" &&
        item.version === PROGRESSION_SIGNALS_VERSION,
    ),
  );
  const ids = collectDossierEvidenceIds(dossier);
  for (const id of [
    "workout_session:a",
    "workout_session:b",
    "workout_session:c",
    "exercise:exercise",
    "derived_calculation:progression_signals",
  ])
    assert.ok(ids.has(id), id);
  const empty = buildAthleteTrainingDossier({
    snapshot,
    activeProgram: program(),
    sessions: [],
    generatedAt: "2026-09-20T12:00:00.000Z",
  });
  assert.deepEqual(empty.progressionSignals, []);
});

const evidence = { kind: "workout_session", id: "c", version: null };
const loadProposal = (loadKg, setId = "s1") => ({
  schemaVersion: "coach-proposal-v1",
  id: "proposal",
  analysisId: "analysis",
  sourceProgramId: "program",
  sourceProgramRevision: 2,
  createdAt: "2026-09-27T12:00:00Z",
  summary: "Subir carga",
  rationale: "Sinal de progressão.",
  evidenceReferences: [evidence],
  actions: [
    {
      kind: "adjust_absolute_load_target",
      trainingDayId: "day",
      exercisePrescriptionId: "prescription",
      prescriptionSetId: setId,
      loadKg,
      rationale: "Dentro da faixa.",
      evidence: [evidence],
    },
  ],
  limitations: [],
  requiresHumanApproval: true,
  analysisSnapshot: {
    summary: "S",
    provider: "fixture",
    model: "deterministic",
    promptVersion: "coach-system-v6",
    policyVersion: "coach-safety-v1",
    dossierSchemaVersion: "athlete-training-dossier-v8",
  },
});
const validationContext = (progressionSignals, source = program()) => ({
  athleteId: "athlete",
  sourceProgram: source,
  activeProgramId: "program",
  evidenceIds: new Set(["workout_session:c"]),
  progressionSignals,
});
test("validation keeps absolute load inside the system range", () => {
  const signals = deriveProgressionSignals(program(), three([EASY, EASY]));
  for (const loadKg of [41, 41.5, 42])
    assert.equal(
      validateCoachProposal(loadProposal(loadKg), validationContext(signals))
        .valid,
      true,
      String(loadKg),
    );
  for (const loadKg of [40.5, 42.5, 45, 38]) {
    const result = validateCoachProposal(
      loadProposal(loadKg),
      validationContext(signals),
    );
    assert.equal(result.valid, false, String(loadKg));
    assert.match(result.issues[0].message, /fora da faixa/);
  }
  // Without a signal for the set, earlier rules apply unchanged.
  assert.equal(
    validateCoachProposal(loadProposal(45), validationContext([])).valid,
    true,
  );
  assert.equal(
    validateCoachProposal(loadProposal(45), {
      ...validationContext([]),
      progressionSignals: undefined,
    }).valid,
    true,
  );
});

test("validation rejects program load changes on athlete guidance", () => {
  const selected = program([
    prescriptionSet("s1", 1, { loadKind: "athlete_selected", loadKg: null }),
  ]);
  const signals = deriveProgressionSignals(
    selected,
    three([{ plannedLoadKind: "athlete_selected", plannedLoadKg: null }]),
  );
  const result = validateCoachProposal(
    loadProposal(42),
    validationContext(signals, selected),
  );
  assert.equal(result.valid, false);
  assert.match(result.issues[0].message, /orientação/);
});
