import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Workout runner redesign (ADR-0122).
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [screen, components] = await Promise.all([
  read("src/presentation/workouts/workout-runner-screen.tsx"),
  read("src/presentation/workouts/runner/runner-components.tsx"),
]);
const text = screen + components;

test("position and progress come from the domain", () => {
  assert.match(
    screen,
    /currentWorkoutPosition\(session, preferredExerciseId\)/,
  );
  assert.match(screen, /workoutSetProgress\(session\)/);
  assert.match(screen, /workoutDurationSeconds\(/);
  // Rest starts at the server-recorded timestamp of the saved set.
  assert.match(screen, /Date\.parse\(saved\.restStartedAt\)/);
});

test("no invented content: no video link, no unknown muscle group", () => {
  assert.doesNotMatch(text, /Ver vídeo|video/i);
  assert.doesNotMatch(text, /muscleGroup|Peito/);
});

test("E2E anchors survive the redesign", () => {
  for (const anchor of [
    'testID="workout-set-value"',
    'testID="workout-set-load"',
    'testID="workout-set-rir"',
    'testID="workout-set-complete"',
    'testID="workout-finish"',
    "REALIZADO",
    "Corrigir série",
  ])
    assert.ok(text.includes(anchor), anchor);
});
