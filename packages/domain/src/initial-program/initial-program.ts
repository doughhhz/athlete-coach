import type {
  AthleteSnapshot,
  GoalType,
  TrainingConsistency,
  TrainingEnvironment,
  Weekday,
} from "../athlete/athlete.ts";
import { deriveAge } from "../athlete/athlete.ts";
import type {
  ExerciseDifficulty,
  ExerciseMechanics,
  ExerciseLaterality,
  MovementPattern,
} from "../exercise/exercise.ts";

/**
 * Initial program (Implementation Phase 21, ADR-0119). The Personal decides
 * the program; the system computes the facts and the envelope below and
 * validates every plan against it. Pure and versioned.
 */
export const INITIAL_PROGRAM_ENVELOPE_VERSION = "initial-program-envelope-v1";
export const BASIC_INITIAL_PROGRAM_VERSION = "basic-initial-program-v1";

/** Answers collected right before the first program (all athlete-owned). */
export type ProgramIntake = Readonly<{
  athleteId: string;
  currentPainOrInjury: boolean;
  painOrInjuryNotes: string | null;
  medicalExerciseRestriction: boolean;
  preferredExercisesNotes: string | null;
  avoidedExercisesNotes: string | null;
  otherSportsNotes: string | null;
  /** Equipment slugs; null = not informed (assumed from the environment). */
  availableEquipment: readonly string[] | null;
  updatedAt: string;
}>;

/** Catalog entry as the generator needs it (equipment by slug). */
export type ProgramCatalogExercise = Readonly<{
  id: string;
  slug: string;
  namePt: string;
  movementPattern: MovementPattern;
  mechanics: ExerciseMechanics;
  laterality: ExerciseLaterality;
  difficulty: ExerciseDifficulty | null;
  equipmentSlugs: readonly string[];
}>;

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
const LEVELS: readonly ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

/**
 * < 6 months: beginner; 6..24: intermediate; > 24: advanced. Restarting or
 * irregular recent training lowers one level (spec section 4).
 */
export function deriveExperienceLevel(
  resistanceTrainingMonths: number,
  recentTrainingConsistency: TrainingConsistency,
): ExperienceLevel {
  const base =
    resistanceTrainingMonths < 6 ? 0 : resistanceTrainingMonths <= 24 ? 1 : 2;
  const lowered =
    recentTrainingConsistency === "consistent" ? base : Math.max(0, base - 1);
  return LEVELS[lowered]!;
}

/** Equipment assumed when the athlete does not inform it (hypothesis). */
export const ENVIRONMENT_EQUIPMENT_ASSUMPTION: Readonly<
  Record<TrainingEnvironment, readonly string[] | "all">
> = {
  commercial_gym: "all",
  mixed: "all",
  home_gym: ["bodyweight", "dumbbell", "bench", "kettlebell"],
  other: ["bodyweight", "dumbbell", "bench", "kettlebell"],
};

export type AvailableEquipment = Readonly<{
  /** null = every equipment of the catalog. */
  slugs: readonly string[] | null;
  assumed: boolean;
}>;
export function resolveAvailableEquipment(
  intake: ProgramIntake | null,
  environment: TrainingEnvironment,
): AvailableEquipment {
  if (intake?.availableEquipment?.length)
    return {
      slugs: [...new Set([...intake.availableEquipment, "bodyweight"])].sort(),
      assumed: false,
    };
  const assumption = ENVIRONMENT_EQUIPMENT_ASSUMPTION[environment];
  return {
    slugs: assumption === "all" ? null : [...assumption].sort(),
    assumed: true,
  };
}

/** Allowed when every listed equipment is available (bodyweight always). */
export function isExerciseAvailable(
  exercise: ProgramCatalogExercise,
  equipment: AvailableEquipment,
): boolean {
  if (!equipment.slugs) return true;
  const slugs = new Set([...equipment.slugs, "bodyweight"]);
  return exercise.equipmentSlugs.every((slug) => slugs.has(slug));
}

export type Range = Readonly<{ min: number; max: number }>;
export type InitialProgramLimits = Readonly<{
  setsPerExercise: Range;
  exercisesPerSession: Range;
  maxSetsPerSession: number;
  reps: Range;
  seconds: Range;
  /** Lowest allowed planned RIR (no planned failure). */
  minRir: number;
  maxRir: number;
  restSeconds: Range;
}>;
const LIMITS: Readonly<Record<ExperienceLevel, InitialProgramLimits>> = {
  beginner: {
    setsPerExercise: { min: 1, max: 3 },
    exercisesPerSession: { min: 1, max: 6 },
    maxSetsPerSession: 16,
    reps: { min: 6, max: 30 },
    seconds: { min: 10, max: 120 },
    minRir: 2,
    maxRir: 5,
    restSeconds: { min: 30, max: 300 },
  },
  intermediate: {
    setsPerExercise: { min: 1, max: 4 },
    exercisesPerSession: { min: 1, max: 8 },
    maxSetsPerSession: 22,
    reps: { min: 3, max: 30 },
    seconds: { min: 10, max: 120 },
    minRir: 1,
    maxRir: 5,
    restSeconds: { min: 30, max: 300 },
  },
  advanced: {
    setsPerExercise: { min: 1, max: 5 },
    exercisesPerSession: { min: 1, max: 8 },
    maxSetsPerSession: 26,
    reps: { min: 1, max: 30 },
    seconds: { min: 10, max: 120 },
    minRir: 1,
    maxRir: 5,
    restSeconds: { min: 30, max: 300 },
  },
};
/** Estimated session may exceed the preferred duration by at most 10%. */
export const SESSION_DURATION_TOLERANCE = 0.1;
export const WARM_UP_MINUTES = 5;
export const SECONDS_PER_REP = 4;
export const EXERCISE_TRANSITION_SECONDS = 60;

export type InitialProgramEnvelope = Readonly<{
  version: typeof INITIAL_PROGRAM_ENVELOPE_VERSION;
  ageYears: number | null;
  goalType: GoalType;
  level: ExperienceLevel;
  availableWeekdays: readonly Weekday[];
  preferredSessionMinutes: number;
  maxSessionMinutes: number;
  equipment: AvailableEquipment;
  limits: InitialProgramLimits;
  /** Catalog exercises the plan may use (equipment and level compatible). */
  allowedExercises: readonly ProgramCatalogExercise[];
}>;

export class InitialProgramUnavailableError extends Error {
  readonly reason: "missing_onboarding" | "no_exercises";
  constructor(reason: "missing_onboarding" | "no_exercises") {
    super(
      reason === "missing_onboarding"
        ? "Conclua o onboarding antes de montar o programa."
        : "Nenhum exercício do catálogo é compatível com os equipamentos.",
    );
    this.name = "InitialProgramUnavailableError";
    this.reason = reason;
  }
}

export function computeInitialProgramEnvelope(
  input: Readonly<{
    snapshot: AthleteSnapshot;
    intake: ProgramIntake | null;
    catalog: readonly ProgramCatalogExercise[];
    asOf: Date;
  }>,
): InitialProgramEnvelope {
  const { snapshot } = input;
  const context = snapshot.trainingContext;
  if (!context || !snapshot.availableWeekdays.length)
    throw new InitialProgramUnavailableError("missing_onboarding");
  const level = deriveExperienceLevel(
    context.resistanceTrainingMonths,
    context.recentTrainingConsistency,
  );
  const equipment = resolveAvailableEquipment(
    input.intake,
    context.trainingEnvironment,
  );
  const allowedExercises = input.catalog
    .filter(
      (exercise) =>
        isExerciseAvailable(exercise, equipment) &&
        // Advanced techniques are not prescribed to beginners.
        !(level === "beginner" && exercise.difficulty === "advanced"),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (!allowedExercises.length)
    throw new InitialProgramUnavailableError("no_exercises");
  const preferred = context.preferredSessionDurationMinutes;
  return {
    version: INITIAL_PROGRAM_ENVELOPE_VERSION,
    ageYears: snapshot.profile
      ? deriveAge(snapshot.profile.birthDate, input.asOf)
      : null,
    goalType: snapshot.activeGoal?.goalType ?? "general_fitness",
    level,
    availableWeekdays: [...new Set(snapshot.availableWeekdays)].sort(
      (a, b) => a - b,
    ),
    preferredSessionMinutes: preferred,
    maxSessionMinutes: Math.floor(preferred * (1 + SESSION_DURATION_TOLERANCE)),
    equipment,
    limits: LIMITS[level],
    allowedExercises,
  };
}

export type InitialProgramExercisePlan = Readonly<{
  exerciseId: string;
  sets: number;
  targetMetric: "reps" | "seconds";
  targetMin: number;
  targetMax: number;
  rirMin: number;
  rirMax: number;
  restMinSeconds: number;
  restMaxSeconds: number;
  rationale: string;
}>;
export type InitialProgramDayPlan = Readonly<{
  weekday: Weekday;
  name: string;
  focus: string;
  rationale: string;
  exercises: readonly InitialProgramExercisePlan[];
}>;
/** The program the Personal (or the basic template) proposes. */
export type InitialProgramPlan = Readonly<{
  name: string;
  summary: string;
  assumptions: readonly string[];
  athleteNotes: readonly string[];
  days: readonly InitialProgramDayPlan[];
}>;

/**
 * Deterministic duration estimate in minutes (rounded up): warm-up, then per
 * set the work time (target max reps x 4 s, or the target seconds) plus the
 * mean planned rest, and one transition per exercise.
 */
export function estimateSessionMinutes(day: InitialProgramDayPlan): number {
  const seconds = day.exercises.reduce((total, exercise) => {
    const work =
      exercise.targetMetric === "reps"
        ? exercise.targetMax * SECONDS_PER_REP
        : exercise.targetMax;
    const rest = (exercise.restMinSeconds + exercise.restMaxSeconds) / 2;
    return total + exercise.sets * (work + rest) + EXERCISE_TRANSITION_SECONDS;
  }, WARM_UP_MINUTES * 60);
  return Math.ceil(seconds / 60);
}

export const initialProgramIssueCodes = [
  "no_days",
  "weekday_not_available",
  "duplicate_weekday",
  "exercise_not_allowed",
  "duplicate_exercise_in_day",
  "exercise_count_out_of_range",
  "sets_out_of_range",
  "session_sets_exceeded",
  "target_out_of_range",
  "rir_out_of_range",
  "rest_out_of_range",
  "session_too_long",
] as const;
export type InitialProgramIssueCode = (typeof initialProgramIssueCodes)[number];
export type InitialProgramIssue = Readonly<{
  code: InitialProgramIssueCode;
  message: string;
  dayIndex?: number;
  exerciseIndex?: number;
}>;

const within = (value: number, range: Range) =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

export function validateInitialProgramPlan(
  plan: InitialProgramPlan,
  envelope: InitialProgramEnvelope,
): readonly InitialProgramIssue[] {
  const issues: InitialProgramIssue[] = [];
  const { limits } = envelope;
  const allowed = new Set(envelope.allowedExercises.map((item) => item.id));
  const available = new Set<number>(envelope.availableWeekdays);
  const weekdays = new Set<number>();
  if (!plan.days.length)
    issues.push({ code: "no_days", message: "O programa não tem dias." });
  plan.days.forEach((day, dayIndex) => {
    const at = { dayIndex };
    if (!available.has(day.weekday))
      issues.push({
        ...at,
        code: "weekday_not_available",
        message: `O dia ${day.weekday} não está entre os dias disponíveis.`,
      });
    if (weekdays.has(day.weekday))
      issues.push({
        ...at,
        code: "duplicate_weekday",
        message: `O dia ${day.weekday} aparece mais de uma vez.`,
      });
    weekdays.add(day.weekday);
    if (!within(day.exercises.length, limits.exercisesPerSession))
      issues.push({
        ...at,
        code: "exercise_count_out_of_range",
        message: `Cada sessão deve ter de ${limits.exercisesPerSession.min} a ${limits.exercisesPerSession.max} exercícios.`,
      });
    const seen = new Set<string>();
    let sessionSets = 0;
    day.exercises.forEach((exercise, exerciseIndex) => {
      const where = { dayIndex, exerciseIndex };
      sessionSets += exercise.sets;
      if (!allowed.has(exercise.exerciseId))
        issues.push({
          ...where,
          code: "exercise_not_allowed",
          message:
            "Exercício fora do catálogo permitido (equipamentos ou nível).",
        });
      if (seen.has(exercise.exerciseId))
        issues.push({
          ...where,
          code: "duplicate_exercise_in_day",
          message: "O mesmo exercício aparece duas vezes no dia.",
        });
      seen.add(exercise.exerciseId);
      if (
        !Number.isInteger(exercise.sets) ||
        !within(exercise.sets, limits.setsPerExercise)
      )
        issues.push({
          ...where,
          code: "sets_out_of_range",
          message: `Use de ${limits.setsPerExercise.min} a ${limits.setsPerExercise.max} séries por exercício.`,
        });
      const targetRange =
        exercise.targetMetric === "reps" ? limits.reps : limits.seconds;
      if (
        !Number.isInteger(exercise.targetMin) ||
        !Number.isInteger(exercise.targetMax) ||
        !within(exercise.targetMin, targetRange) ||
        !within(exercise.targetMax, targetRange) ||
        exercise.targetMin > exercise.targetMax
      )
        issues.push({
          ...where,
          code: "target_out_of_range",
          message: `Alvo deve ficar entre ${targetRange.min} e ${targetRange.max} (${exercise.targetMetric === "reps" ? "repetições" : "segundos"}).`,
        });
      if (
        !Number.isInteger(exercise.rirMin) ||
        !Number.isInteger(exercise.rirMax) ||
        exercise.rirMin < limits.minRir ||
        exercise.rirMax > limits.maxRir ||
        exercise.rirMin > exercise.rirMax
      )
        issues.push({
          ...where,
          code: "rir_out_of_range",
          message: `RIR deve ficar entre ${limits.minRir} e ${limits.maxRir}.`,
        });
      if (
        !within(exercise.restMinSeconds, limits.restSeconds) ||
        !within(exercise.restMaxSeconds, limits.restSeconds) ||
        exercise.restMinSeconds > exercise.restMaxSeconds
      )
        issues.push({
          ...where,
          code: "rest_out_of_range",
          message: `Descanso deve ficar entre ${limits.restSeconds.min} e ${limits.restSeconds.max} s.`,
        });
    });
    if (sessionSets > limits.maxSetsPerSession)
      issues.push({
        ...at,
        code: "session_sets_exceeded",
        message: `A sessão passa de ${limits.maxSetsPerSession} séries.`,
      });
    const minutes = estimateSessionMinutes(day);
    if (minutes > envelope.maxSessionMinutes)
      issues.push({
        ...at,
        code: "session_too_long",
        message: `Sessão estimada em ${minutes} min; o limite é ${envelope.maxSessionMinutes} min.`,
      });
  });
  return issues;
}

// --- Explanation quality (soft: asks for one repair, never blocks) -------

/** Minimum explanation left after removing the exercise name. */
export const MIN_RATIONALE_CHARACTERS = 30;
export type InitialProgramQualityIssue = Readonly<{
  code: "rationale_insufficient";
  message: string;
  dayIndex: number;
  exerciseIndex: number;
}>;
const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/**
 * An exercise reason must explain why, not repeat the exercise name: after
 * removing the name's words, at least MIN_RATIONALE_CHARACTERS must remain.
 */
export function reviewInitialProgramRationales(
  plan: InitialProgramPlan,
  envelope: InitialProgramEnvelope,
): readonly InitialProgramQualityIssue[] {
  const names = new Map(
    envelope.allowedExercises.map((item) => [item.id, item.namePt]),
  );
  const issues: InitialProgramQualityIssue[] = [];
  plan.days.forEach((day, dayIndex) =>
    day.exercises.forEach((exercise, exerciseIndex) => {
      const nameWords = new Set(
        normalized(names.get(exercise.exerciseId) ?? "").split(" "),
      );
      const remaining = normalized(exercise.rationale)
        .split(" ")
        .filter((word) => word && !nameWords.has(word))
        .join(" ");
      if (remaining.length < MIN_RATIONALE_CHARACTERS)
        issues.push({
          code: "rationale_insufficient",
          message:
            "Explique por que este exercício foi escolhido para este atleta (papel na sessão e dado do atleta que ele atende), sem só repetir o nome.",
          dayIndex,
          exerciseIndex,
        });
    }),
  );
  return issues;
}

// --- Basic template (fallback, clearly labeled; ADR-0119 decision 5) ------

type Slot = readonly MovementPattern[];
const FULL_BODY_A: readonly Slot[] = [
  ["squat", "lunge"],
  ["horizontal_push", "vertical_push"],
  ["hinge"],
  ["vertical_pull", "horizontal_pull"],
  ["shoulder_abduction"],
  ["elbow_flexion"],
  ["elbow_extension"],
  ["anti_extension", "trunk_flexion"],
];
const FULL_BODY_B: readonly Slot[] = [
  ["hinge"],
  ["vertical_push", "horizontal_push"],
  ["lunge", "squat"],
  ["horizontal_pull", "vertical_pull"],
  ["calf_raise"],
  ["elbow_extension"],
  ["elbow_flexion"],
  ["anti_rotation", "anti_extension"],
];
const UPPER: readonly Slot[] = [
  ["horizontal_push"],
  ["horizontal_pull"],
  ["vertical_push"],
  ["vertical_pull"],
  ["shoulder_abduction"],
  ["elbow_flexion"],
  ["elbow_extension"],
  ["horizontal_pull"],
];
const LOWER: readonly Slot[] = [
  ["squat"],
  ["hinge"],
  ["lunge"],
  ["knee_flexion"],
  ["knee_extension"],
  ["calf_raise"],
  ["anti_extension", "trunk_flexion"],
  ["anti_rotation"],
];
type DayTemplate = Readonly<{
  name: string;
  focus: string;
  slots: readonly Slot[];
}>;
const FULL_A = {
  name: "Corpo inteiro A",
  focus: "Corpo inteiro",
  slots: FULL_BODY_A,
};
const FULL_B = {
  name: "Corpo inteiro B",
  focus: "Corpo inteiro",
  slots: FULL_BODY_B,
};
const FULL_C = {
  name: "Corpo inteiro C",
  focus: "Corpo inteiro",
  slots: FULL_BODY_A,
};
const UPPER_DAY = {
  name: "Superior",
  focus: "Membros superiores",
  slots: UPPER,
};
const LOWER_DAY = {
  name: "Inferior",
  focus: "Membros inferiores",
  slots: LOWER,
};
function splitFor(days: number): readonly DayTemplate[] {
  if (days <= 1) return [FULL_A];
  if (days === 2) return [FULL_A, FULL_B];
  if (days === 3) return [FULL_A, FULL_B, FULL_C];
  if (days === 4)
    return [
      { ...UPPER_DAY, name: "Superior A" },
      { ...LOWER_DAY, name: "Inferior A" },
      { ...UPPER_DAY, name: "Superior B" },
      { ...LOWER_DAY, name: "Inferior B" },
    ];
  return [
    { ...UPPER_DAY, name: "Superior A" },
    { ...LOWER_DAY, name: "Inferior A" },
    { ...UPPER_DAY, name: "Superior B" },
    { ...LOWER_DAY, name: "Inferior B" },
    { ...FULL_A, name: "Corpo inteiro" },
  ];
}
/** Up to 5 days, spread across the available ones. */
export function chooseTemplateWeekdays(
  available: readonly Weekday[],
): readonly Weekday[] {
  const sorted = [...new Set(available)].sort((a, b) => a - b);
  const count = Math.min(5, sorted.length);
  return Array.from(
    { length: count },
    (_, index) => sorted[Math.floor((index * sorted.length) / count)]!,
  );
}
const TIMED_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  "anti_extension",
  "carry",
]);
function prescriptionFor(
  exercise: ProgramCatalogExercise,
  envelope: InitialProgramEnvelope,
  sets: number,
): InitialProgramExercisePlan {
  const compound = exercise.mechanics === "compound";
  const strength = envelope.goalType === "strength";
  const beginner = envelope.level === "beginner";
  const rir = beginner || envelope.goalType === "general_fitness" ? 3 : 2;
  const [targetMin, targetMax] = TIMED_PATTERNS.has(exercise.movementPattern)
    ? [20, 40]
    : envelope.goalType === "general_fitness"
      ? [10, 15]
      : strength
        ? compound && !beginner
          ? [4, 6]
          : [8, 12]
        : compound
          ? [8, 10]
          : [10, 15];
  const [restMin, restMax] = compound
    ? strength
      ? [180, 240]
      : [120, 180]
    : [60, 90];
  return {
    exerciseId: exercise.id,
    sets,
    targetMetric: TIMED_PATTERNS.has(exercise.movementPattern)
      ? "seconds"
      : "reps",
    targetMin,
    targetMax,
    rirMin: rir,
    rirMax: rir,
    restMinSeconds: restMin,
    restMaxSeconds: restMax,
    rationale: compound
      ? "Movimento composto base do dia."
      : "Exercício complementar para equilíbrio entre grupos musculares.",
  };
}

/**
 * The basic system template: deterministic, always inside the envelope
 * (ADR-0119). Weekdays spread over availability (max 5); split by day count;
 * exercises per session by duration (<=45 min: 4, <=75: 5, else 6), trimmed
 * until the estimate fits; 2 sets for beginners, otherwise 3.
 */
export function buildBasicInitialProgram(
  envelope: InitialProgramEnvelope,
): InitialProgramPlan {
  const weekdays = chooseTemplateWeekdays(envelope.availableWeekdays);
  const split = splitFor(weekdays.length);
  const target = Math.min(
    envelope.limits.exercisesPerSession.max,
    envelope.preferredSessionMinutes <= 45
      ? 4
      : envelope.preferredSessionMinutes <= 75
        ? 5
        : 6,
  );
  const sets = Math.min(
    envelope.level === "beginner" ? 2 : 3,
    envelope.limits.setsPerExercise.max,
  );
  const rank = (exercise: ProgramCatalogExercise) =>
    exercise.difficulty === "beginner"
      ? 0
      : exercise.difficulty === null
        ? 1
        : 2;
  const candidates = (patterns: Slot) =>
    patterns.flatMap((pattern) =>
      envelope.allowedExercises
        .filter((exercise) => exercise.movementPattern === pattern)
        .sort(
          (a, b) =>
            Number(b.mechanics === "compound") -
              Number(a.mechanics === "compound") ||
            rank(a) - rank(b) ||
            a.slug.localeCompare(b.slug),
        ),
    );
  const days = weekdays.map((weekday, dayIndex): InitialProgramDayPlan => {
    const template = split[dayIndex]!;
    const used = new Set<string>();
    const chosen: ProgramCatalogExercise[] = [];
    for (const slot of template.slots) {
      if (chosen.length >= target) break;
      const options = candidates(slot).filter((item) => !used.has(item.id));
      // Repeated templates (A/C, Superior A/B) rotate through options.
      const pick =
        options[Math.floor(dayIndex / 2) % Math.max(options.length, 1)];
      if (!pick) continue;
      used.add(pick.id);
      chosen.push(pick);
    }
    // A day never stays empty: fall back to the first allowed exercise.
    if (!chosen.length) chosen.push(envelope.allowedExercises[0]!);
    let exercises = chosen.map((item) => prescriptionFor(item, envelope, sets));
    const fits = (list: readonly InitialProgramExercisePlan[]) =>
      estimateSessionMinutes({
        weekday,
        name: "",
        focus: "",
        rationale: "",
        exercises: list,
      }) <= envelope.maxSessionMinutes;
    while (exercises.length > 1 && !fits(exercises))
      exercises = exercises.slice(0, -1);
    while (!fits(exercises) && exercises.some((item) => item.sets > 1))
      exercises = exercises.map((item) => ({
        ...item,
        sets: Math.max(1, item.sets - 1),
      }));
    while (
      exercises.reduce((total, item) => total + item.sets, 0) >
      envelope.limits.maxSetsPerSession
    )
      exercises = exercises.slice(0, -1);
    return {
      weekday,
      name: template.name,
      focus: template.focus,
      rationale: "Distribuição padrão do modelo básico pelos dias disponíveis.",
      exercises,
    };
  });
  return {
    name: "Programa inicial (modelo básico)",
    summary:
      "Modelo básico do sistema, montado por regras fixas a partir dos seus dias, duração, objetivo e experiência. Não foi personalizado pelo Personal.",
    assumptions: [
      ...(envelope.equipment.assumed
        ? ["Equipamentos assumidos pelo ambiente de treino informado."]
        : []),
      "Carga escolhida por você, guiada pelo RIR.",
    ],
    athleteNotes: [
      "Escolha uma carga que deixe as repetições em reserva (RIR) indicadas.",
      "Este modelo não considera dores, lesões ou preferências escritas; revise antes de ativar.",
    ],
    days,
  };
}
