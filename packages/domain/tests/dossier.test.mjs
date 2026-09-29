import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAthleteTrainingDossier,
  compareNumeric,
  deriveDataCoverage,
  deriveExerciseExposure,
} from "../src/index.ts";
function set(change = {}) {
  return {
    id: "set",
    sourcePrescriptionSetId: "ps",
    sequence: 1,
    status: "completed",
    plannedMetric: "reps",
    plannedTargetMin: 8,
    plannedTargetMax: 10,
    plannedRirMin: 2,
    plannedRirMax: 2,
    plannedRestMinSeconds: 90,
    plannedRestMaxSeconds: 120,
    plannedTempo: null,
    plannedLoadKind: "athlete_selected",
    plannedLoadKg: null,
    actualValue: 9,
    actualLoadKg: 60,
    actualRir: 2,
    performedAt: "2026-09-25T12:01:00.000Z",
    restStartedAt: "2026-09-25T12:01:00.000Z",
    restEndedAt: "2026-09-25T12:02:40.000Z",
    ...change,
  };
}
function session(id, startedAt, changes = {}) {
  return {
    id,
    athleteId: "athlete",
    sourceTrainingDayId: `day-${id}`,
    programName: "Program",
    dayName: "Day",
    status: "completed",
    athleteNotes: null,
    startedAt,
    completedAt: startedAt,
    abandonedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    exercises: [
      {
        id: `we-${id}`,
        sourceExercisePrescriptionId: "ep",
        exerciseId: "exercise",
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: [set({ id: `set-${id}`, performedAt: startedAt })],
      },
    ],
    ...changes,
  };
}
const snapshot = {
  athlete: {
    id: "athlete",
    userId: "user",
    onboardingCompletedAt: "2026-01-01T00:00:00Z",
  },
  profile: {
    athleteId: "athlete",
    birthDate: "1990-01-01",
    heightCm: 180,
    preferredName: "Ana",
    timezone: "America/Sao_Paulo",
  },
  activeGoal: null,
  trainingContext: null,
  availableWeekdays: [5, 1],
  latestWeight: null,
};
const build = (sessions) =>
  buildAthleteTrainingDossier({
    snapshot,
    activeProgram: null,
    sessions,
    generatedAt: "2026-09-26T12:00:00.000Z",
  });
test("dossier has a versioned deterministic contract", () => {
  const a = build([]);
  assert.equal(a.schemaVersion, "athlete-training-dossier-v6");
  assert.equal(a.interventionHistory, null);
  assert.equal(a.responseMemory, null);
  assert.deepEqual(a, build([]));
});
test("civil window includes local exact dates and excludes earlier boundary", () => {
  const d = build([
    session("inside", "2026-09-20T03:00:00.000Z"),
    session("outside", "2026-09-19T02:59:59.000Z"),
  ]);
  assert.equal(d.windows[0].sessionsStarted, 1);
  assert.equal(d.windows[0].localStartDate, "2026-09-20");
  assert.equal(d.windows[0].localEndDateExclusive, "2026-09-27");
});
test("completed abandoned and pending remain separate", () => {
  const abandoned = session("a", "2026-09-25T12:00:00Z", {
    status: "abandoned",
    completedAt: null,
    abandonedAt: "2026-09-25T13:00:00Z",
    exercises: [
      {
        id: "we",
        sourceExercisePrescriptionId: "ep",
        exerciseId: "exercise",
        sequence: 1,
        exerciseName: "Supino",
        plannedInstructions: null,
        plannedAthleteCues: null,
        sets: [
          set({ status: "pending", actualValue: null, performedAt: null }),
        ],
      },
    ],
  });
  const w = build([abandoned]).windows[0];
  assert.equal(w.sessionsAbandoned, 1);
  assert.equal(w.pendingSetsInAbandonedSessions, 1);
  assert.equal(w.completedSets, 0);
});
test("exercise frequency counts distinct sessions, not sets", () => {
  const s = session("a", "2026-09-25T12:00:00Z");
  s.exercises[0].sets.push(set({ id: "two" }));
  const exposure = deriveExerciseExposure([s])[0];
  assert.equal(exposure.sessionAppearances, 1);
  assert.equal(exposure.completedSets, 2);
});
test("abandoned completed sets contribute to exposure", () => {
  const exposure = deriveExerciseExposure([
    session("a", "2026-09-25T12:00:00Z", {
      status: "abandoned",
      completedAt: null,
      abandonedAt: "2026-09-25T13:00:00Z",
    }),
  ])[0];
  assert.equal(exposure.completedSets, 1);
});
test("reps seconds and meters never mix", () => {
  const s = session("a", "2026-09-25T12:00:00Z");
  s.exercises[0].sets.push(
    set({ id: "seconds", plannedMetric: "seconds", actualValue: 30 }),
    set({ id: "meters", plannedMetric: "meters", actualValue: 100 }),
  );
  const e = deriveExerciseExposure([s])[0];
  assert.deepEqual(
    [e.totalReps, e.recordedSeconds, e.recordedMeters],
    [9, 30, 100],
  );
});
test("coverage distinguishes eligibility and missing measurements", () => {
  const s = session("a", "2026-09-25T12:00:00Z");
  s.exercises[0].sets.push(
    set({
      id: "missing",
      actualLoadKg: null,
      actualRir: null,
      restStartedAt: null,
      restEndedAt: null,
    }),
  );
  const c = deriveDataCoverage([s]);
  assert.deepEqual(
    [
      c.completedSetsCount,
      c.loadRecordedCount,
      c.rirEligibleCount,
      c.rirRecordedCount,
      c.restEligibleCount,
      c.restMeasuredCount,
    ],
    [2, 1, 2, 1, 2, 1],
  );
});
test("target RIR and rest attainment remain factual per exercise", () => {
  const exposure = deriveExerciseExposure([
    session("a", "2026-09-25T12:00:00Z"),
  ])[0];
  assert.deepEqual(
    [
      exposure.withinTargetSets,
      exposure.rirWithinPlannedSets,
      exposure.restWithinPlannedSets,
    ],
    [1, 1, 1],
  );
});
test("personal best context points back to workout-set evidence", () => {
  const dossier = build([session("a", "2026-09-25T12:00:00Z")]);
  assert.equal(dossier.personalBests[0].exerciseId, "exercise");
  assert.equal(dossier.personalBests[0].evidence[0].kind, "workout_set");
});
test("coverage with no eligible observations uses null rates", () => {
  const c = deriveDataCoverage([]);
  assert.equal(c.loadCoverageRate, null);
  assert.equal(c.rirCoverageRate, null);
  assert.equal(c.restCoverageRate, null);
});
test("deltas cover positive negative zero missing and zero denominator", () => {
  assert.equal(compareNumeric(12, 10, 1, 1).relativeDelta, 0.2);
  assert.equal(compareNumeric(8, 10, 1, 1).absoluteDelta, -2);
  assert.equal(compareNumeric(10, 10, 1, 1).absoluteDelta, 0);
  assert.equal(compareNumeric(1, 0, 1, 1).relativeDelta, null);
  assert.equal(compareNumeric(1, null, 1, 0).absoluteDelta, null);
});
test("bounded recent sessions report truncation and stable ordering", () => {
  const sessions = Array.from({ length: 14 }, (_, index) =>
    session(
      String(index).padStart(2, "0"),
      `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
    ),
  );
  const recent = build(sessions).recentSessions;
  assert.deepEqual(
    [recent.totalAvailable, recent.included, recent.hasMore],
    [14, 12, true],
  );
  assert.equal(recent.items[0].id, "13");
});
test("contract contains no qualitative coaching fields", () => {
  const json = JSON.stringify(build([]));
  for (const field of [
    "recommendation",
    "interpretation",
    "score",
    "fatigue",
    "readiness",
    "suggestedLoad",
    "suggestedSets",
  ])
    assert.equal(json.includes(`\"${field}\"`), false);
});
