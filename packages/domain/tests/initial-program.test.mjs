import assert from "node:assert/strict";
import test from "node:test";
import {
  BASIC_INITIAL_PROGRAM_VERSION,
  buildBasicInitialProgram,
  chooseTemplateWeekdays,
  computeInitialProgramEnvelope,
  deriveExperienceLevel,
  estimateSessionMinutes,
  INITIAL_PROGRAM_ENVELOPE_VERSION,
  InitialProgramUnavailableError,
  isExerciseAvailable,
  resolveAvailableEquipment,
  validateInitialProgramPlan,
} from "../src/index.ts";

// Mirrors the seeded catalog (movement pattern, mechanics, difficulty and
// equipment slugs) closely enough for the template rules.
const rows = [
  [
    "barbell-bench-press",
    "horizontal_push",
    "compound",
    "intermediate",
    ["barbell", "bench"],
  ],
  [
    "dumbbell-bench-press",
    "horizontal_push",
    "compound",
    "beginner",
    ["dumbbell", "bench"],
  ],
  ["push-up", "horizontal_push", "compound", "beginner", ["bodyweight"]],
  ["cable-chest-fly", "horizontal_push", "isolation", "beginner", ["cable"]],
  [
    "lat-pulldown",
    "vertical_pull",
    "compound",
    "beginner",
    ["selectorized-machine"],
  ],
  [
    "pull-up",
    "vertical_pull",
    "compound",
    "intermediate",
    ["pullup-bar", "bodyweight"],
  ],
  ["seated-cable-row", "horizontal_pull", "compound", "beginner", ["cable"]],
  [
    "one-arm-dumbbell-row",
    "horizontal_pull",
    "compound",
    "beginner",
    ["dumbbell", "bench"],
  ],
  [
    "barbell-overhead-press",
    "vertical_push",
    "compound",
    "intermediate",
    ["barbell"],
  ],
  [
    "seated-dumbbell-shoulder-press",
    "vertical_push",
    "compound",
    "beginner",
    ["dumbbell", "bench"],
  ],
  [
    "dumbbell-lateral-raise",
    "shoulder_abduction",
    "isolation",
    "beginner",
    ["dumbbell"],
  ],
  [
    "alternating-dumbbell-curl",
    "elbow_flexion",
    "isolation",
    "beginner",
    ["dumbbell"],
  ],
  [
    "cable-triceps-pushdown",
    "elbow_extension",
    "isolation",
    "beginner",
    ["cable"],
  ],
  [
    "bench-dip",
    "elbow_extension",
    "compound",
    "intermediate",
    ["bench", "bodyweight"],
  ],
  ["barbell-back-squat", "squat", "compound", "advanced", ["barbell"]],
  ["leg-press", "squat", "compound", "beginner", ["plate-loaded-machine"]],
  [
    "bulgarian-split-squat",
    "lunge",
    "compound",
    "intermediate",
    ["dumbbell", "bench"],
  ],
  [
    "leg-extension",
    "knee_extension",
    "isolation",
    "beginner",
    ["selectorized-machine"],
  ],
  [
    "barbell-romanian-deadlift",
    "hinge",
    "compound",
    "intermediate",
    ["barbell"],
  ],
  ["bodyweight-glute-bridge", "hinge", "compound", "beginner", ["bodyweight"]],
  [
    "seated-leg-curl",
    "knee_flexion",
    "isolation",
    "beginner",
    ["selectorized-machine"],
  ],
  [
    "standing-calf-raise",
    "calf_raise",
    "isolation",
    "beginner",
    ["selectorized-machine"],
  ],
  ["front-plank", "anti_extension", "isolation", "beginner", ["bodyweight"]],
  ["dead-bug", "anti_extension", "isolation", "beginner", ["bodyweight"]],
  ["pallof-press", "anti_rotation", "isolation", "beginner", ["cable"]],
];
const catalog = rows.map(
  ([slug, movementPattern, mechanics, difficulty, equipmentSlugs], index) => ({
    id: `ex-${index}-${slug}`,
    slug,
    namePt: slug,
    movementPattern,
    mechanics,
    laterality: "bilateral",
    difficulty,
    equipmentSlugs,
  }),
);
const byId = new Map(catalog.map((item) => [item.id, item]));

function snapshot(change = {}) {
  const {
    context = {},
    weekdays = [1, 3, 5],
    goalType = "hypertrophy",
  } = change;
  return {
    athlete: {
      id: "athlete",
      userId: "user",
      onboardingCompletedAt: "2026-09-01T00:00:00Z",
    },
    profile: {
      athleteId: "athlete",
      birthDate: "1990-06-15",
      heightCm: 178,
      preferredName: "Atleta",
      timezone: "America/Sao_Paulo",
    },
    activeGoal: {
      athleteId: "athlete",
      goalType,
      id: "goal",
      notes: null,
      startedAt: "2026-09-01T00:00:00Z",
      targetWeightKg: null,
    },
    trainingContext: {
      athleteId: "athlete",
      averageSleepMinutes: 420,
      constraintsNotes: null,
      preferredSessionDurationMinutes: 60,
      preferencesNotes: null,
      recentTrainingConsistency: "consistent",
      resistanceTrainingMonths: 12,
      routineSummary: "Escritório",
      trainingEnvironment: "commercial_gym",
      ...context,
    },
    availableWeekdays: weekdays,
    latestWeight: null,
  };
}
const intake = (change = {}) => ({
  athleteId: "athlete",
  currentPainOrInjury: false,
  painOrInjuryNotes: null,
  medicalExerciseRestriction: false,
  preferredExercisesNotes: null,
  avoidedExercisesNotes: null,
  otherSportsNotes: null,
  availableEquipment: null,
  updatedAt: "2026-10-01T00:00:00Z",
  ...change,
});
const asOf = new Date("2026-10-01T12:00:00Z");
const envelopeFor = (change = {}, intakeChange = null) =>
  computeInitialProgramEnvelope({
    snapshot: snapshot(change),
    intake: intakeChange ? intake(intakeChange) : null,
    catalog,
    asOf,
  });

test("experience level: month boundaries and consistency lowering", () => {
  assert.equal(deriveExperienceLevel(0, "consistent"), "beginner");
  assert.equal(deriveExperienceLevel(5, "consistent"), "beginner");
  assert.equal(deriveExperienceLevel(6, "consistent"), "intermediate");
  assert.equal(deriveExperienceLevel(24, "consistent"), "intermediate");
  assert.equal(deriveExperienceLevel(25, "consistent"), "advanced");
  assert.equal(deriveExperienceLevel(60, "restarting"), "intermediate");
  assert.equal(deriveExperienceLevel(12, "irregular"), "beginner");
  assert.equal(deriveExperienceLevel(2, "restarting"), "beginner");
});

test("equipment: informed list wins; otherwise assumed from environment", () => {
  assert.deepEqual(
    resolveAvailableEquipment(
      intake({ availableEquipment: ["dumbbell", "bench"] }),
      "commercial_gym",
    ),
    { slugs: ["bench", "bodyweight", "dumbbell"], assumed: false },
  );
  assert.deepEqual(resolveAvailableEquipment(null, "commercial_gym"), {
    slugs: null,
    assumed: true,
  });
  assert.deepEqual(
    resolveAvailableEquipment(intake({ availableEquipment: [] }), "home_gym"),
    {
      slugs: ["bench", "bodyweight", "dumbbell", "kettlebell"],
      assumed: true,
    },
  );
  assert.deepEqual(resolveAvailableEquipment(null, "mixed").slugs, null);
  assert.deepEqual(resolveAvailableEquipment(null, "other").assumed, true);
  const home = resolveAvailableEquipment(null, "home_gym");
  const exercise = (slug) => catalog.find((item) => item.slug === slug);
  assert.equal(
    isExerciseAvailable(exercise("dumbbell-bench-press"), home),
    true,
  );
  // Every listed equipment is required.
  assert.equal(isExerciseAvailable(exercise("pull-up"), home), false);
  assert.equal(isExerciseAvailable(exercise("leg-press"), home), false);
  assert.equal(
    isExerciseAvailable(exercise("push-up"), { slugs: [], assumed: false }),
    true,
  );
});

test("envelope: facts, limits and allowed catalog", () => {
  const envelope = envelopeFor();
  assert.equal(envelope.version, INITIAL_PROGRAM_ENVELOPE_VERSION);
  assert.equal(envelope.ageYears, 36);
  assert.equal(envelope.level, "intermediate");
  assert.deepEqual(envelope.availableWeekdays, [1, 3, 5]);
  assert.equal(envelope.maxSessionMinutes, 66);
  assert.equal(envelope.allowedExercises.length, catalog.length);
  const beginner = envelopeFor({ context: { resistanceTrainingMonths: 2 } });
  assert.equal(beginner.limits.minRir, 2);
  assert.equal(beginner.limits.reps.min, 6);
  assert.ok(
    !beginner.allowedExercises.some((item) => item.difficulty === "advanced"),
  );
  const home = envelopeFor({ context: { trainingEnvironment: "home_gym" } });
  assert.ok(home.equipment.assumed);
  assert.ok(
    home.allowedExercises.every((item) =>
      isExerciseAvailable(item, home.equipment),
    ),
  );
  assert.equal(
    envelopeFor({}, { availableEquipment: ["dumbbell"] }).equipment.assumed,
    false,
  );
  assert.equal(envelopeFor({ goalType: undefined }).goalType, "hypertrophy");
});

test("envelope: missing onboarding or no compatible exercise is explicit", () => {
  assert.throws(
    () =>
      computeInitialProgramEnvelope({
        snapshot: { ...snapshot(), trainingContext: null },
        intake: null,
        catalog,
        asOf,
      }),
    (error) =>
      error instanceof InitialProgramUnavailableError &&
      error.reason === "missing_onboarding",
  );
  assert.throws(
    () => envelopeFor({ weekdays: [] }),
    (error) => error.reason === "missing_onboarding",
  );
  assert.throws(
    () =>
      computeInitialProgramEnvelope({
        snapshot: snapshot(),
        intake: intake({ availableEquipment: ["landmine"] }),
        catalog: catalog.filter(
          (item) => !item.equipmentSlugs.every((slug) => slug === "bodyweight"),
        ),
        asOf,
      }),
    (error) => error.reason === "no_exercises",
  );
});

const exercise = (change = {}) => ({
  exerciseId: catalog[1].id,
  sets: 3,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 2,
  rirMax: 2,
  restMinSeconds: 120,
  restMaxSeconds: 180,
  rationale: "r",
  ...change,
});
const day = (change = {}) => ({
  weekday: 1,
  name: "A",
  focus: "f",
  rationale: "r",
  exercises: [exercise()],
  ...change,
});
const plan = (days = [day()]) => ({
  name: "P",
  summary: "S",
  assumptions: [],
  athleteNotes: [],
  days,
});

test("session duration estimate is deterministic", () => {
  // 5 min warm-up + 3 x (10 reps x 4 s + 150 s) + 60 s = 300 + 570 + 60 = 930 s.
  assert.equal(estimateSessionMinutes(day()), 16);
  assert.equal(
    estimateSessionMinutes(
      day({
        exercises: [
          exercise({
            targetMetric: "seconds",
            targetMax: 30,
            sets: 2,
            restMinSeconds: 60,
            restMaxSeconds: 60,
          }),
        ],
      }),
    ),
    // 300 + 2 x (30 + 60) + 60 = 540 s.
    9,
  );
  assert.equal(estimateSessionMinutes(day({ exercises: [] })), 5);
});

test("validation accepts a plan inside the envelope", () =>
  assert.deepEqual(validateInitialProgramPlan(plan(), envelopeFor()), []));

test("validation names every violated limit", () => {
  const envelope = envelopeFor({ context: { resistanceTrainingMonths: 2 } });
  const codes = (value) =>
    validateInitialProgramPlan(value, envelope).map((issue) => issue.code);
  assert.deepEqual(codes(plan([])), ["no_days"]);
  assert.deepEqual(codes(plan([day({ weekday: 2 })])), [
    "weekday_not_available",
  ]);
  assert.deepEqual(codes(plan([day(), day()])), ["duplicate_weekday"]);
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ exerciseId: "unknown" })] })])),
    ["exercise_not_allowed"],
  );
  const squat = catalog.find((item) => item.slug === "barbell-back-squat").id;
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ exerciseId: squat })] })])),
    ["exercise_not_allowed"],
  );
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise(), exercise()] })])),
    ["duplicate_exercise_in_day"],
  );
  assert.deepEqual(codes(plan([day({ exercises: [] })])), [
    "exercise_count_out_of_range",
  ]);
  assert.deepEqual(codes(plan([day({ exercises: [exercise({ sets: 4 })] })])), [
    "sets_out_of_range",
  ]);
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ sets: 2.5 })] })])),
    ["sets_out_of_range"],
  );
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ targetMin: 5 })] })])),
    ["target_out_of_range"],
  );
  assert.deepEqual(
    codes(
      plan([day({ exercises: [exercise({ targetMin: 12, targetMax: 10 })] })]),
    ),
    ["target_out_of_range"],
  );
  assert.deepEqual(
    codes(
      plan([
        day({
          exercises: [
            exercise({ targetMetric: "seconds", targetMin: 5, targetMax: 30 }),
          ],
        }),
      ]),
    ),
    ["target_out_of_range"],
  );
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ rirMin: 1 })] })])),
    ["rir_out_of_range"],
  );
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ rirMin: 3, rirMax: 6 })] })])),
    ["rir_out_of_range"],
  );
  assert.deepEqual(
    codes(plan([day({ exercises: [exercise({ restMinSeconds: 20 })] })])),
    ["rest_out_of_range"],
  );
  assert.deepEqual(
    codes(
      plan([
        day({
          exercises: [exercise({ restMinSeconds: 200, restMaxSeconds: 100 })],
        }),
      ]),
    ),
    ["rest_out_of_range"],
  );
  const six = catalog
    .filter((item) => item.difficulty === "beginner")
    .slice(0, 6);
  assert.deepEqual(
    codes(
      plan([
        day({
          exercises: six.map((item) => exercise({ exerciseId: item.id })),
        }),
      ]),
    ),
    ["session_sets_exceeded", "session_too_long"],
  );
  const shortSession = envelopeFor({
    context: { preferredSessionDurationMinutes: 10 },
  });
  assert.deepEqual(
    validateInitialProgramPlan(plan(), shortSession).map((issue) => issue.code),
    ["session_too_long"],
  );
});

test("template weekdays are spread over availability, at most 5", () => {
  assert.deepEqual(chooseTemplateWeekdays([5, 1, 3]), [1, 3, 5]);
  assert.deepEqual(
    chooseTemplateWeekdays([1, 2, 3, 4, 5, 6, 7]),
    [1, 2, 3, 5, 6],
  );
  assert.deepEqual(chooseTemplateWeekdays([2]), [2]);
});

test("basic template always fits the envelope", () => {
  let checked = 0;
  for (const weekdays of [
    [1],
    [1, 4],
    [1, 3, 5],
    [1, 2, 4, 5],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5, 6, 7],
  ])
    for (const minutes of [10, 20, 30, 45, 60, 90, 180])
      for (const months of [0, 12, 60])
        for (const goalType of [
          "hypertrophy",
          "fat_loss",
          "recomposition",
          "strength",
          "general_fitness",
        ])
          for (const trainingEnvironment of ["commercial_gym", "home_gym"]) {
            const envelope = envelopeFor({
              weekdays,
              goalType,
              context: {
                preferredSessionDurationMinutes: minutes,
                resistanceTrainingMonths: months,
                trainingEnvironment,
              },
            });
            const result = buildBasicInitialProgram(envelope);
            assert.deepEqual(
              validateInitialProgramPlan(result, envelope),
              [],
              JSON.stringify({
                weekdays,
                minutes,
                months,
                goalType,
                trainingEnvironment,
              }),
            );
            checked += 1;
          }
  assert.equal(checked, 6 * 7 * 3 * 5 * 2);
  assert.equal(BASIC_INITIAL_PROGRAM_VERSION, "basic-initial-program-v1");
});

test("basic template follows the approved rules", () => {
  const four = buildBasicInitialProgram(
    envelopeFor({ weekdays: [1, 2, 4, 5] }),
  );
  assert.deepEqual(
    four.days.map((item) => item.name),
    ["Superior A", "Inferior A", "Superior B", "Inferior B"],
  );
  assert.ok(four.summary.includes("Não foi personalizado pelo Personal"));
  const beginner = buildBasicInitialProgram(
    envelopeFor({ context: { resistanceTrainingMonths: 2 } }),
  );
  assert.ok(
    beginner.days.every((item) =>
      item.exercises.every((entry) => entry.sets === 2 && entry.rirMin === 3),
    ),
  );
  const strength = buildBasicInitialProgram(
    envelopeFor({ goalType: "strength" }),
  );
  const compound = strength.days[0].exercises.find(
    (entry) => byId.get(entry.exerciseId).mechanics === "compound",
  );
  assert.deepEqual(
    [compound.targetMin, compound.targetMax, compound.restMinSeconds],
    [4, 6, 180],
  );
  // Bodyweight only: the core slot is reached and is timed.
  const bodyweight = buildBasicInitialProgram(
    envelopeFor({}, { availableEquipment: ["bodyweight"] }),
  );
  const timed = bodyweight.days
    .flatMap((item) => item.exercises)
    .filter(
      (entry) =>
        byId.get(entry.exerciseId).movementPattern === "anti_extension",
    );
  assert.ok(
    timed.length && timed.every((entry) => entry.targetMetric === "seconds"),
  );
  const home = buildBasicInitialProgram(
    envelopeFor({ context: { trainingEnvironment: "home_gym" } }),
  );
  const homeEquipment = new Set([
    "bodyweight",
    "dumbbell",
    "bench",
    "kettlebell",
  ]);
  assert.ok(
    home.days.every((item) =>
      item.exercises.every((entry) =>
        byId
          .get(entry.exerciseId)
          .equipmentSlugs.every((slug) => homeEquipment.has(slug)),
      ),
    ),
  );
  assert.ok(home.assumptions.some((text) => text.includes("assumidos")));
  // Deterministic: same input, same plan.
  assert.deepEqual(
    buildBasicInitialProgram(envelopeFor()),
    buildBasicInitialProgram(envelopeFor()),
  );
});

test("exercise reasons must explain, not repeat the exercise name", async () => {
  const { reviewInitialProgramRationales, MIN_RATIONALE_CHARACTERS } =
    await import("../src/index.ts");
  const envelope = envelopeFor();
  const target = catalog[1]; // dumbbell-bench-press, namePt = slug
  const withReason = (rationale) =>
    plan([
      day({ exercises: [exercise({ exerciseId: target.id, rationale })] }),
    ]);
  assert.equal(MIN_RATIONALE_CHARACTERS, 30);
  // Only the name (any case or punctuation) is insufficient.
  for (const rationale of [
    "dumbbell-bench-press",
    "Dumbbell bench press.",
    "Dumbbell bench press para peito",
  ])
    assert.deepEqual(
      reviewInitialProgramRationales(withReason(rationale), envelope).map(
        (issue) => [issue.code, issue.dayIndex, issue.exerciseIndex],
      ),
      [["rationale_insufficient", 0, 0]],
      rationale,
    );
  assert.deepEqual(
    reviewInitialProgramRationales(
      withReason(
        "Empurrar horizontal principal do dia, com halteres por você treinar em casa e ainda ser iniciante.",
      ),
      envelope,
    ),
    [],
  );
  // Accents and case do not matter when removing the name.
  const accented = {
    ...envelope,
    allowedExercises: [{ ...target, namePt: "Supino reto com halteres" }],
  };
  assert.equal(
    reviewInitialProgramRationales(
      withReason("SUPINO RETO COM HALTERES — supino"),
      accented,
    ).length,
    1,
  );
});
