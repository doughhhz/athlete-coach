export const goalTypes = [
  "hypertrophy",
  "fat_loss",
  "recomposition",
  "strength",
  "general_fitness",
] as const;
export type GoalType = (typeof goalTypes)[number];

export const trainingConsistencies = [
  "restarting",
  "irregular",
  "consistent",
] as const;
export type TrainingConsistency = (typeof trainingConsistencies)[number];

export const trainingEnvironments = [
  "commercial_gym",
  "home_gym",
  "mixed",
  "other",
] as const;
export type TrainingEnvironment = (typeof trainingEnvironments)[number];

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AthleteIdentity = Readonly<{
  id: string;
  onboardingCompletedAt: string | null;
  userId: string;
}>;

export type AthleteProfile = Readonly<{
  athleteId: string;
  birthDate: string;
  heightCm: number;
  preferredName: string;
  timezone: string;
}>;

export type AthleteGoal = Readonly<{
  athleteId: string;
  goalType: GoalType;
  id: string;
  notes: string | null;
  startedAt: string;
  targetWeightKg: number | null;
}>;

export type TrainingContext = Readonly<{
  athleteId: string;
  averageSleepMinutes: number | null;
  constraintsNotes: string | null;
  preferredSessionDurationMinutes: number;
  preferencesNotes: string | null;
  recentTrainingConsistency: TrainingConsistency;
  resistanceTrainingMonths: number;
  routineSummary: string;
  trainingEnvironment: TrainingEnvironment;
}>;

export type BodyWeightEntry = Readonly<{
  athleteId: string;
  id: string;
  measuredAt: string;
  source: "manual";
  weightKg: number;
}>;

export type AthleteSnapshot = Readonly<{
  activeGoal: AthleteGoal | null;
  athlete: AthleteIdentity;
  availableWeekdays: readonly Weekday[];
  latestWeight: BodyWeightEntry | null;
  profile: AthleteProfile | null;
  trainingContext: TrainingContext | null;
}>;

export function deriveAge(birthDate: string, asOfDate: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) throw new Error("birthDate must use YYYY-MM-DD.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error("birthDate must be a real calendar date.");
  }

  const today = new Date(
    Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate(),
    ),
  );
  if (candidate > today) throw new Error("birthDate cannot be in the future.");

  let age = today.getUTCFullYear() - year;
  const birthdayHasPassed =
    today.getUTCMonth() > month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

/**
 * Target weight minus the latest recorded weight, in kg rounded to 0.1;
 * half away from zero; null without both values. Positive = still to gain, negative = to lose.
 */
export function weightGoalDifferenceKg(
  latestWeightKg: number | null,
  targetWeightKg: number | null,
): number | null {
  if (latestWeightKg === null || targetWeightKg === null) return null;
  // Half away from zero (gaining and losing round symmetrically).
  const difference = targetWeightKg - latestWeightKg;
  const rounded = Math.round(Math.abs(difference) * 10 + 1e-9) / 10;
  return rounded === 0 ? 0 : Math.sign(difference) * rounded;
}
