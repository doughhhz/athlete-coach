import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Home (ADR-0121): the design spec's mock data become recorded or computed
// facts; invented claims are not shown.
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [screen, components, route] = await Promise.all([
  read("src/presentation/home/home-screen.tsx"),
  read("src/presentation/home/home-components.tsx"),
  read("app/(tabs)/index.tsx"),
]);
const text = screen + components;

test("the Home route renders the new Home screen", () =>
  assert.match(route, /HomeScreen/));

test("numbers come from the domain or the athlete's records", () => {
  for (const fn of [
    "deriveWeekPlan(",
    "summarizeWeekPlan(",
    "countRecentCompletedWorkouts(",
    "weightGoalDifferenceKg(",
    "estimateTrainingDayMinutes(",
    "workoutExerciseProgress(",
    "snapshot.latestWeight",
    "snapshot.profile.preferredName",
  ])
    assert.ok(screen.includes(fn), fn);
});

test("no invented persona, streak, nutrition claim or notifications", () => {
  assert.doesNotMatch(
    text,
    /Lucas|Online agora|Streak|dias seguidos|ajustar treino e dieta|bell_outline|"notifications/,
  );
  assert.match(text, /Personal por IA/);
  assert.match(screen, /Em construção/);
});
