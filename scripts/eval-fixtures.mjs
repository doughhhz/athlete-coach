// Shared SYNTHETIC fixtures for AI evaluations (ADR-0118/0119/0128): used by
// the eval scripts and by the temporary server-side evaluation. No real data.
import { buildAthleteTrainingDossier } from "../packages/domain/src/index.ts";

/** Prescribed 40 kg, 6 sessions clearly easier than planned. */
export function easyTrainingFixture() {
  // Synthetic active program: 1 day, 1 exercise, 3 sets of 8-10 reps @ RIR 2 with
  // a PRESCRIBED absolute load of 40 kg (a program-level change is then
  // justified when the athlete keeps exceeding it; with athlete-selected load
  // the right answer is athlete guidance, not a program change).
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const generatedAt = "2026-09-28T12:00:00.000Z";
  const ids = {
    athlete: uuid(1),
    program: uuid(2),
    block: uuid(3),
    week: uuid(4),
    day: uuid(5),
    prescription: uuid(6),
    exercise: uuid(7),
    sets: [uuid(8), uuid(9), uuid(10)],
  };
  const program = {
    id: ids.program,
    lineageTracked: true,
    athleteId: ids.athlete,
    athleteGoalId: null,
    name: "Programa sintetico",
    description: null,
    status: "active",
    revision: 1,
    supersedesProgramId: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    activatedAt: "2026-09-01T12:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    blocks: [
      {
        id: ids.block,
        lineageId: uuid(103),
        sequence: 1,
        name: "Base",
        description: null,
        weeks: [
          {
            id: ids.week,
            lineageId: uuid(104),
            sequence: 1,
            name: "Semana 1",
            notes: null,
            days: [
              {
                id: ids.day,
                lineageId: uuid(105),
                sequence: 1,
                name: "Treino A",
                preferredWeekday: null,
                notes: null,
                prescriptions: [
                  {
                    id: ids.prescription,
                    lineageId: uuid(106),
                    exerciseId: ids.exercise,
                    exerciseName: "Supino reto",
                    sequence: 1,
                    instructions: null,
                    athleteCues: null,
                    sets: ids.sets.map((id, index) => ({
                      id,
                      lineageId: uuid(200 + index),
                      sequence: index + 1,
                      targetMetric: "reps",
                      targetMin: 8,
                      targetMax: 10,
                      rirMin: 2,
                      rirMax: 2,
                      restMinSeconds: 120,
                      restMaxSeconds: 120,
                      tempo: null,
                      loadKind: "absolute",
                      loadKg: 40,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  // 6 sessions over 3 weeks, every set clearly easy: 12 reps x 40 kg @ RIR 4.
  const sessions = Array.from({ length: 6 }, (_, index) => {
    const startedAt = new Date(
      Date.parse(generatedAt) - (20 - index * 3.5) * 86_400_000,
    ).toISOString();
    const id = uuid(300 + index);
    return {
      id,
      athleteId: ids.athlete,
      sourceTrainingDayId: ids.day,
      programName: program.name,
      dayName: "Treino A",
      status: "completed",
      athleteNotes: null,
      startedAt,
      completedAt: startedAt,
      abandonedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
      exercises: [
        {
          id: uuid(400 + index),
          sourceExercisePrescriptionId: ids.prescription,
          exerciseId: ids.exercise,
          sequence: 1,
          exerciseName: "Supino reto",
          plannedInstructions: null,
          plannedAthleteCues: null,
          sets: ids.sets.map((setId, setIndex) => ({
            id: uuid(500 + index * 10 + setIndex),
            sourcePrescriptionSetId: setId,
            sequence: setIndex + 1,
            status: "completed",
            plannedMetric: "reps",
            plannedTargetMin: 8,
            plannedTargetMax: 10,
            plannedRirMin: 2,
            plannedRirMax: 2,
            plannedRestMinSeconds: 120,
            plannedRestMaxSeconds: 120,
            plannedTempo: null,
            plannedLoadKind: "absolute",
            plannedLoadKg: 40,
            actualValue: 12,
            actualLoadKg: 40,
            actualRir: 4,
            performedAt: startedAt,
            restStartedAt: startedAt,
            restEndedAt: startedAt,
          })),
        },
      ],
    };
  });
  const dossier = buildAthleteTrainingDossier({
    snapshot: {
      athlete: {
        id: ids.athlete,
        userId: uuid(11),
        onboardingCompletedAt: "2026-08-01T00:00:00Z",
      },
      profile: {
        athleteId: ids.athlete,
        birthDate: "1993-05-10",
        heightCm: 178,
        preferredName: "Atleta",
        timezone: "America/Sao_Paulo",
      },
      activeGoal: null,
      trainingContext: null,
      availableWeekdays: [1, 4],
      latestWeight: null,
    },
    activeProgram: program,
    sessions,
    generatedAt,
  });
  const question =
    "Os ultimos treinos ficaram faceis: com os 40 kg prescritos fiz 12 repeticoes com RIR 4 em todas as series, e o plano era 8 a 10 repeticoes com RIR 2. Sugira um ajuste concreto no meu programa ativo.";

  return { program, sessions, dossier, question };
}

/** Four synthetic athletes for the initial program. */
export function initialProgramPersonas() {
  const base = {
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
    latestWeight: {
      athleteId: "athlete",
      id: "w",
      measuredAt: "2026-09-01T00:00:00Z",
      source: "manual",
      weightKg: 82,
    },
  };
  const goal = (goalType, notes = null) => ({
    athleteId: "athlete",
    goalType,
    id: "goal",
    notes,
    startedAt: "2026-09-01T00:00:00Z",
    targetWeightKg: null,
  });
  const context = (change) => ({
    athleteId: "athlete",
    averageSleepMinutes: 420,
    constraintsNotes: null,
    preferredSessionDurationMinutes: 60,
    preferencesNotes: null,
    recentTrainingConsistency: "consistent",
    resistanceTrainingMonths: 12,
    routineSummary: "Trabalho em escritorio, treino depois das 18h",
    trainingEnvironment: "commercial_gym",
    ...change,
  });
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
  const personas = [
    {
      name: "1 iniciante hipertrofia academia 3d/60min",
      snapshot: {
        ...base,
        activeGoal: goal("hypertrophy"),
        trainingContext: context({ resistanceTrainingMonths: 2 }),
        availableWeekdays: [1, 3, 5],
      },
      intake: intake({ preferredExercisesNotes: "Gosto de supino e remada" }),
    },
    {
      name: "2 recomecando emagrecimento casa 4d/45min joelho",
      snapshot: {
        ...base,
        activeGoal: goal("fat_loss"),
        trainingContext: context({
          resistanceTrainingMonths: 30,
          recentTrainingConsistency: "restarting",
          preferredSessionDurationMinutes: 45,
          trainingEnvironment: "home_gym",
        }),
        availableWeekdays: [1, 2, 4, 5],
      },
      intake: intake({
        currentPainOrInjury: true,
        painOrInjuryNotes:
          "Joelho direito sensivel em agachamento profundo, sem dor no dia a dia",
        otherSportsNotes: "Corrida leve aos domingos",
      }),
    },
    {
      name: "3 avancado forca academia 5d/90min futebol",
      snapshot: {
        ...base,
        activeGoal: goal("strength", "Quero melhorar agachamento e supino"),
        trainingContext: context({
          resistanceTrainingMonths: 60,
          preferredSessionDurationMinutes: 90,
        }),
        availableWeekdays: [1, 2, 3, 4, 5, 6],
      },
      intake: intake({
        avoidedExercisesNotes: "Leg press",
        otherSportsNotes: "Futebol aos sabados",
      }),
    },
    {
      name: "4 62 anos condicionamento 2d/30min",
      snapshot: {
        ...base,
        profile: { ...base.profile, birthDate: "1964-03-10" },
        activeGoal: goal("general_fitness"),
        trainingContext: context({
          resistanceTrainingMonths: 0,
          recentTrainingConsistency: "irregular",
          preferredSessionDurationMinutes: 30,
          averageSleepMinutes: 360,
        }),
        availableWeekdays: [2, 4],
      },
      intake: intake(),
    },
  ];
  return personas;
}
