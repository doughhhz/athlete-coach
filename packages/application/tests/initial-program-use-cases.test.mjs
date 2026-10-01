import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateTrainingProgramWithStructure,
  GenerateInitialProgram,
  generateInitialProgramRequestSchema,
  InitialProgramBlockedError,
  InitialProgramInvalidError,
  initialProgramOutputJsonSchema,
  initialProgramToStructure,
  PERSONAL_SPEC_VERSION,
  ProgramCreationConflictError,
  programIntakeInputSchema,
  SaveProgramIntake,
} from "../src/index.ts";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const catalog = [
  [
    "dumbbell-bench-press",
    "horizontal_push",
    "compound",
    ["dumbbell", "bench"],
  ],
  ["seated-cable-row", "horizontal_pull", "compound", ["cable"]],
  ["leg-press", "squat", "compound", ["plate-loaded-machine"]],
  ["bodyweight-glute-bridge", "hinge", "compound", ["bodyweight"]],
  ["dumbbell-lateral-raise", "shoulder_abduction", "isolation", ["dumbbell"]],
  ["seated-leg-curl", "knee_flexion", "isolation", ["selectorized-machine"]],
].map(([slug, movementPattern, mechanics, equipmentSlugs], index) => ({
  id: uuid(100 + index),
  slug,
  namePt: slug,
  movementPattern,
  mechanics,
  laterality: "bilateral",
  difficulty: "beginner",
  equipmentSlugs,
}));
const snapshot = {
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
    timezone: "UTC",
  },
  activeGoal: {
    athleteId: "athlete",
    goalType: "hypertrophy",
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
  },
  availableWeekdays: [1, 4],
  latestWeight: {
    athleteId: "athlete",
    id: "w",
    measuredAt: "2026-09-01T00:00:00Z",
    source: "manual",
    weightKg: 80,
  },
};
const intake = (change = {}) => ({
  athleteId: "athlete",
  currentPainOrInjury: false,
  painOrInjuryNotes: null,
  medicalExerciseRestriction: false,
  preferredExercisesNotes: "Gosto de supino",
  avoidedExercisesNotes: null,
  otherSportsNotes: "Futebol aos sábados",
  availableEquipment: null,
  updatedAt: "2026-10-01T00:00:00Z",
  ...change,
});
const planExercise = (exerciseId, change = {}) => ({
  exerciseId,
  sets: 3,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 2,
  rirMax: 2,
  restMinSeconds: 120,
  restMaxSeconds: 150,
  rationale:
    "Composto principal do dia, escolhido pelo seu objetivo e experiência.",
  ...change,
});
const validPlan = {
  name: "Programa do Personal",
  summary: "Superior e inferior em dois dias.",
  assumptions: ["Equipamentos de academia."],
  athleteNotes: ["Escolha a carga pelo RIR."],
  days: [
    {
      weekday: 4,
      name: "Inferior",
      focus: "Pernas",
      rationale: "Longe do futebol.",
      exercises: [planExercise(catalog[2].id), planExercise(catalog[3].id)],
    },
    {
      weekday: 1,
      name: "Superior",
      focus: "Tronco",
      rationale: "Empurrar e puxar.",
      exercises: [planExercise(catalog[0].id), planExercise(catalog[1].id)],
    },
  ],
};
const output = (program = validPlan) => ({
  schemaVersion: "initial-program-v1",
  outcome: "program",
  program,
  cannotBuildReason: null,
});

function harness({
  outputs = [output()],
  intakeValue = intake(),
  createError = null,
} = {}) {
  const calls = { provider: [], created: [], logged: [] };
  const queue = [...outputs];
  const useCase = new GenerateInitialProgram({
    profile: { execute: async () => snapshot },
    intakes: {
      getCurrent: async () => intakeValue,
      saveCurrent: async () => intakeValue,
    },
    catalog: { listForProgram: async () => catalog },
    provider: {
      generate: async (request) => {
        calls.provider.push(request);
        return {
          output: queue.shift(),
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          promptVersion: "initial-program-prompt-v1",
        };
      },
    },
    safety: {
      evaluateInput: (text) => ({
        flags: [],
        blockProvider: /dor no peito/i.test(text),
      }),
      evaluateOutput: (value) => value,
    },
    create: new CreateTrainingProgramWithStructure({
      createWithStructure: async (input) => {
        calls.created.push(input);
        if (createError) throw createError;
        return { id: uuid(900) };
      },
    }),
    log: { record: async (entry) => calls.logged.push(entry) },
    requestId: () => "request",
    now: () => new Date("2026-10-01T12:00:00Z"),
  });
  return { useCase, calls };
}
const request = (mode) => ({ mode, creationRequestId: uuid(1) });

test("intake: pain needs a description; empty notes become absent", () => {
  assert.throws(() =>
    programIntakeInputSchema.parse({
      currentPainOrInjury: true,
      medicalExerciseRestriction: false,
    }),
  );
  const parsed = programIntakeInputSchema.parse({
    currentPainOrInjury: false,
    medicalExerciseRestriction: false,
    otherSportsNotes: "  ",
  });
  assert.equal(parsed.otherSportsNotes, undefined);
  assert.throws(() =>
    programIntakeInputSchema.parse({
      currentPainOrInjury: false,
      medicalExerciseRestriction: false,
      availableEquipment: ["Halter!"],
    }),
  );
  const saved = [];
  return new SaveProgramIntake({
    saveCurrent: async (value) => (saved.push(value), value),
    getCurrent: async () => null,
  })
    .execute({ currentPainOrInjury: false, medicalExerciseRestriction: false })
    .then(() => assert.equal(saved.length, 1));
});

test("request is strict: only mode and creation intent", () => {
  assert.ok(
    generateInitialProgramRequestSchema.safeParse(request("personal")).success,
  );
  assert.equal(
    generateInitialProgramRequestSchema.safeParse({
      ...request("basic"),
      athleteId: "x",
    }).success,
    false,
  );
  assert.equal(
    generateInitialProgramRequestSchema.safeParse({
      mode: "auto",
      creationRequestId: uuid(1),
    }).success,
    false,
  );
});

test("personal mode: valid plan becomes an inactive draft with provenance", async () => {
  const { useCase, calls } = harness();
  const result = await useCase.execute(request("personal"));
  assert.deepEqual(result, {
    status: "created",
    programId: uuid(900),
    origin: "personal",
    reused: false,
    repaired: false,
  });
  assert.equal(calls.provider.length, 1);
  const sent = calls.provider[0];
  // Every athlete datum reaches the Personal; the name never does.
  assert.equal(sent.facts.ageYears, 36);
  assert.equal(sent.facts.latestBodyWeightKg, 80);
  assert.equal(sent.athleteNotes.otherSportsNotes, "Futebol aos sábados");
  assert.equal(sent.envelope.level, "intermediate");
  assert.ok(!JSON.stringify(sent).includes("Atleta"));
  const created = calls.created[0];
  assert.equal(created.creationRequestId, uuid(1));
  assert.equal(created.name, "Programa do Personal");
  assert.match(created.description, /Suposições: Equipamentos de academia\./);
  const week = created.structure.blocks[0].weeks[0];
  assert.deepEqual(
    week.days.map((day) => [day.sequence, day.preferredWeekday, day.name]),
    [
      [1, 1, "Superior"],
      [2, 4, "Inferior"],
    ],
  );
  const sets = week.days[0].prescriptions[0].sets;
  assert.equal(sets.length, 3);
  assert.ok(
    sets.every(
      (set) => set.loadKind === "athlete_selected" && set.loadKg === null,
    ),
  );
  assert.deepEqual(calls.logged, [
    {
      programId: uuid(900),
      origin: "personal",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      promptVersion: "initial-program-prompt-v1",
      envelopeVersion: "initial-program-envelope-v1",
      specVersion: PERSONAL_SPEC_VERSION,
      repaired: false,
    },
  ]);
});

test("personal mode: one repair attempt with the system issues", async () => {
  const outside = {
    ...validPlan,
    days: [{ ...validPlan.days[0], weekday: 2 }],
  };
  const repairedRun = harness({ outputs: [output(outside), output()] });
  const result = await repairedRun.useCase.execute(request("personal"));
  assert.equal(result.repaired, true);
  assert.equal(repairedRun.calls.provider.length, 2);
  assert.deepEqual(
    repairedRun.calls.provider[1].previousIssues.map((issue) => issue.code),
    ["weekday_not_available"],
  );
  assert.equal(repairedRun.calls.logged[0].repaired, true);

  const failing = harness({ outputs: [output(outside), output(outside)] });
  await assert.rejects(
    () => failing.useCase.execute(request("personal")),
    InitialProgramInvalidError,
  );
  assert.equal(failing.calls.provider.length, 2);
  assert.equal(failing.calls.created.length, 0);
});

test("a reason that only repeats the name asks for one repair, never blocks", async () => {
  const named = (rationale) => ({
    ...validPlan,
    days: validPlan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((item) => ({ ...item, rationale })),
    })),
  });
  const weak = named("dumbbell-bench-press");
  const good = named(
    "Base do dia para o seu objetivo de hipertrofia, sem sobrecarregar o joelho.",
  );
  const fixed = harness({ outputs: [output(weak), output(good)] });
  const result = await fixed.useCase.execute(request("personal"));
  assert.equal(result.repaired, true);
  assert.ok(
    fixed.calls.provider[1].previousIssues.some(
      (issue) => issue.code === "rationale_insufficient",
    ),
  );
  // Still weak after the repair: the program is created anyway.
  const stillWeak = harness({ outputs: [output(weak), output(weak)] });
  assert.equal(
    (await stillWeak.useCase.execute(request("personal"))).status,
    "created",
  );
  assert.equal(stillWeak.calls.created.length, 1);
});

test("personal mode: cannot_build and malformed output never create a draft", async () => {
  const refusal = harness({
    outputs: [
      {
        schemaVersion: "initial-program-v1",
        outcome: "cannot_build",
        program: null,
        cannotBuildReason: "Procure avaliação.",
      },
    ],
  });
  assert.deepEqual(await refusal.useCase.execute(request("personal")), {
    status: "cannot_build",
    reason: "Procure avaliação.",
  });
  assert.equal(refusal.calls.created.length, 0);
  const malformed = harness({ outputs: [{ ...output(), program: null }] });
  await assert.rejects(() => malformed.useCase.execute(request("personal")));
  assert.equal(malformed.calls.created.length, 0);
});

test("basic mode: deterministic template without the provider", async () => {
  const { useCase, calls } = harness();
  const result = await useCase.execute(request("basic"));
  assert.equal(result.origin, "basic");
  assert.equal(calls.provider.length, 0);
  assert.match(calls.created[0].name, /modelo básico/);
  assert.equal(calls.logged[0].model, null);
});

test("medical restriction or blocking safety text stops both modes", async () => {
  for (const mode of ["personal", "basic"]) {
    const restricted = harness({
      intakeValue: intake({ medicalExerciseRestriction: true }),
    });
    await assert.rejects(
      () => restricted.useCase.execute(request(mode)),
      (error) =>
        error instanceof InitialProgramBlockedError &&
        error.reason === "medical_restriction",
    );
    const pain = harness({
      intakeValue: intake({
        currentPainOrInjury: true,
        painOrInjuryNotes: "Sinto dor no peito ao subir escadas",
      }),
    });
    await assert.rejects(
      () => pain.useCase.execute(request(mode)),
      (error) =>
        error instanceof InitialProgramBlockedError &&
        error.reason === "safety",
    );
    assert.equal(
      restricted.calls.provider.length + pain.calls.provider.length,
      0,
    );
    assert.equal(
      restricted.calls.created.length + pain.calls.created.length,
      0,
    );
  }
  // Non-blocking pain is passed to the Personal as context.
  const mild = harness({
    intakeValue: intake({
      currentPainOrInjury: true,
      painOrInjuryNotes: "Joelho sensível em agachamento profundo",
    }),
  });
  await mild.useCase.execute(request("personal"));
  assert.equal(
    mild.calls.provider[0].athleteNotes.painOrInjuryNotes,
    "Joelho sensível em agachamento profundo",
  );
});

test("a retried intent resolves to the draft already created", async () => {
  const { useCase, calls } = harness({
    createError: new ProgramCreationConflictError(uuid(901)),
  });
  assert.deepEqual(await useCase.execute(request("basic")), {
    status: "created",
    programId: uuid(901),
    origin: "basic",
    reused: true,
    repaired: false,
  });
  assert.equal(calls.logged.length, 0);
});

test("structure mapping keeps one template week and explains each exercise", () => {
  const structure = initialProgramToStructure(validPlan);
  assert.equal(structure.blocks.length, 1);
  assert.equal(structure.blocks[0].weeks.length, 1);
  assert.match(
    structure.blocks[0].weeks[0].days[0].prescriptions[0].instructions,
    /^Por que este exercício: /,
  );
  assert.equal(structure.blocks[0].description, "Escolha a carga pelo RIR.");
});

test("structured output schema has no transforms and covers both outcomes", () => {
  const text = JSON.stringify(initialProgramOutputJsonSchema);
  assert.match(text, /"cannot_build"/);
  assert.match(text, /"initial-program-v1"/);
});
