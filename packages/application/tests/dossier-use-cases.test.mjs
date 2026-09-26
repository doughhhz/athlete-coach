import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  GetLongitudinalTrainingSignals,
} from "../src/index.ts";
const snapshot = {
  athlete: { id: "a", userId: "u", onboardingCompletedAt: null },
  profile: null,
  activeGoal: null,
  trainingContext: null,
  availableWeekdays: [],
  latestWeight: null,
};
const profile = { execute: async () => snapshot },
  programs = { getActive: async () => null },
  workouts = { getInProgress: async () => null },
  performance = { listHistoricalSessions: async () => [] };
test("builds an empty athlete dossier from owned repositories", async () => {
  const result = await new BuildAthleteTrainingDossier(
    profile,
    programs,
    workouts,
    performance,
    () => new Date("2026-09-26T12:00:00Z"),
  ).execute();
  assert.equal(result.athlete.athleteId, "a");
  assert.equal(result.windows[4].sessionsStarted, 0);
});
test("longitudinal use case exposes facts only", async () => {
  const builder = new BuildAthleteTrainingDossier(
    profile,
    programs,
    workouts,
    performance,
    () => new Date("2026-09-26T12:00:00Z"),
  );
  const result = await new GetLongitudinalTrainingSignals(builder).execute();
  assert.deepEqual(result.exerciseSignals, []);
  assert.equal("score" in result, false);
});
