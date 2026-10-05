import {
  EXERCISE_TRANSITION_SECONDS,
  SECONDS_PER_REP,
  WARM_UP_MINUTES,
} from "../initial-program/initial-program.ts";
import type { TrainingDay, TrainingProgram } from "./training.ts";
import type { WorkoutSession } from "../workout/workout.ts";

/** Rest assumed for a set without planned rest (hypothesis, display only). */
export const DEFAULT_REST_SECONDS = 60;
/** Work time per planned meter (hypothesis: 1 m/s). */
export const SECONDS_PER_METER = 1;

/**
 * Estimated minutes of a planned training day, with the same formula as the
 * initial program envelope: warm-up, then per set the work time (target max
 * x 4 s for reps, seconds as planned, 1 s per meter) plus the mean planned
 * rest (60 s when absent), and one transition per exercise. Rounded up.
 */
export function estimateTrainingDayMinutes(day: TrainingDay): number {
  const seconds = day.prescriptions.reduce(
    (total, prescription) =>
      total +
      EXERCISE_TRANSITION_SECONDS +
      prescription.sets.reduce((sum, set) => {
        const work =
          set.targetMetric === "reps"
            ? set.targetMax * SECONDS_PER_REP
            : set.targetMetric === "seconds"
              ? set.targetMax
              : set.targetMax * SECONDS_PER_METER;
        const rest =
          set.restMinSeconds === null || set.restMaxSeconds === null
            ? DEFAULT_REST_SECONDS
            : (set.restMinSeconds + set.restMaxSeconds) / 2;
        return sum + work + rest;
      }, 0),
    WARM_UP_MINUTES * 60,
  );
  return Math.ceil(seconds / 60);
}

export type WeekPlanStatus = "done" | "planned" | "rest";
export type WeekPlanDay = Readonly<{
  /** 1 = Monday ... 7 = Sunday. */
  weekday: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  status: WeekPlanStatus;
  /** Planned training day for this weekday, if any. */
  trainingDay: TrainingDay | null;
}>;

type LocalDate = Readonly<{ year: number; month: number; day: number }>;
function localDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}
const iso = ({ year, month, day }: LocalDate) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function addDays(date: LocalDate, days: number): LocalDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}
/** ISO weekday (1 = Monday) of a calendar date. */
function weekdayOf(date: LocalDate): number {
  const day = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Planned training days by weekday: the template week is the first week of
 * the first block (hypothesis for multi-week programs; the initial program
 * has exactly one). First day wins when two share a weekday.
 */
function plannedByWeekday(
  program: TrainingProgram | null,
): ReadonlyMap<number, TrainingDay> {
  const days =
    [...(program?.blocks ?? [])]
      .sort((a, b) => a.sequence - b.sequence)[0]
      ?.weeks.slice()
      .sort((a, b) => a.sequence - b.sequence)[0]
      ?.days.slice()
      .sort((a, b) => a.sequence - b.sequence) ?? [];
  const map = new Map<number, TrainingDay>();
  for (const day of days)
    if (day.preferredWeekday !== null && !map.has(day.preferredWeekday))
      map.set(day.preferredWeekday, day);
  return map;
}

/**
 * The current week (Monday to Sunday, in the athlete's time zone): a day is
 * "done" when a workout was completed on that local date, "planned" when the
 * program has a day for that weekday, otherwise "rest". Facts only.
 */
export function deriveWeekPlan(
  input: Readonly<{
    program: TrainingProgram | null;
    sessions: readonly Pick<WorkoutSession, "status" | "startedAt">[];
    now: Date;
    timeZone: string;
  }>,
): readonly WeekPlanDay[] {
  const today = localDate(input.now, input.timeZone);
  const monday = addDays(today, 1 - weekdayOf(today));
  const planned = plannedByWeekday(input.program);
  const completedDates = new Set(
    input.sessions
      .filter((session) => session.status === "completed")
      .map((session) =>
        iso(localDate(new Date(session.startedAt), input.timeZone)),
      ),
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const weekday = index + 1;
    const trainingDay = planned.get(weekday) ?? null;
    return {
      weekday,
      date: iso(date),
      dayOfMonth: date.day,
      isToday: iso(date) === iso(today),
      status: completedDates.has(iso(date))
        ? "done"
        : trainingDay
          ? "planned"
          : "rest",
      trainingDay,
    };
  });
}

/**
 * The day to highlight: today when planned and not done; otherwise the next
 * planned day this week; otherwise the first planned day of the week; null
 * without a planned day.
 */
export function highlightedWeekPlanDay(
  week: readonly WeekPlanDay[],
): WeekPlanDay | null {
  const todayIndex = week.findIndex((day) => day.isToday);
  const today = week[todayIndex];
  if (today?.status === "planned") return today;
  return (
    week.slice(todayIndex + 1).find((day) => day.status === "planned") ??
    week.find((day) => day.trainingDay !== null) ??
    null
  );
}

/** Exercises with every set completed or skipped, out of all exercises. */
export function workoutExerciseProgress(
  session: Pick<WorkoutSession, "exercises">,
): Readonly<{ finished: number; total: number }> {
  return {
    finished: session.exercises.filter(
      (exercise) =>
        exercise.sets.length > 0 &&
        exercise.sets.every((set) => set.status !== "pending"),
    ).length,
    total: session.exercises.length,
  };
}

/** Workouts done this week and planned training days this week. */
export function summarizeWeekPlan(
  week: readonly WeekPlanDay[],
): Readonly<{ done: number; planned: number }> {
  return {
    done: week.filter((day) => day.status === "done").length,
    planned: week.filter((day) => day.trainingDay !== null).length,
  };
}

/** Completed workouts that started in the last `days` days (default 28). */
export function countRecentCompletedWorkouts(
  sessions: readonly Pick<WorkoutSession, "status" | "startedAt">[],
  now: Date,
  days = 28,
): number {
  const since = now.getTime() - days * 86_400_000;
  return sessions.filter(
    (session) =>
      session.status === "completed" &&
      Date.parse(session.startedAt) > since &&
      Date.parse(session.startedAt) <= now.getTime(),
  ).length;
}

/**
 * Whether a workout started on the athlete's current local date. A workout
 * left open on an earlier day does not replace today's plan (ADR-0127).
 */
export function startedToday(
  session: Pick<WorkoutSession, "startedAt">,
  now: Date,
  timeZone: string,
): boolean {
  return (
    iso(localDate(new Date(session.startedAt), timeZone)) ===
    iso(localDate(now, timeZone))
  );
}
