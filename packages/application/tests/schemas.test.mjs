import assert from "node:assert/strict";
import test from "node:test";

import {
  availabilityInputSchema,
  bodyWeightInputSchema,
  createCompleteOnboardingSchema,
  profileInputSchema,
  trainingContextInputSchema,
} from "../src/index.ts";

const validOnboarding = {
  preferredName: "Atleta",
  birthDate: "2000-01-15",
  heightCm: 180,
  timezone: "America/Sao_Paulo",
  goalType: "strength",
  targetWeightKg: undefined,
  goalNotes: undefined,
  resistanceTrainingMonths: 24,
  recentTrainingConsistency: "consistent",
  preferredSessionDurationMinutes: 60,
  trainingEnvironment: "commercial_gym",
  routineSummary: "Rotina variável.",
  constraintsNotes: undefined,
  preferencesNotes: undefined,
  averageSleepMinutes: undefined,
  availableWeekdays: [1, 3, 5],
  measuredAt: "2026-09-25T12:00:00-03:00",
  weightKg: 76.4,
};

test("rejects future birth dates without making a health assessment", () => {
  const result = createCompleteOnboardingSchema(
    new Date("2026-09-25T12:00:00Z"),
  ).safeParse({
    ...validOnboarding,
    birthDate: "2026-09-26",
  });
  assert.equal(result.success, false);
});

test("validates technical height and weight bounds", () => {
  assert.equal(
    profileInputSchema.safeParse({ ...validOnboarding, heightCm: 1800 })
      .success,
    false,
  );
  assert.equal(
    bodyWeightInputSchema.safeParse({
      measuredAt: validOnboarding.measuredAt,
      weightKg: 7600,
    }).success,
    false,
  );
});

test("validates training months and explicit weekdays", () => {
  assert.equal(
    trainingContextInputSchema.safeParse({
      ...validOnboarding,
      resistanceTrainingMonths: -1,
    }).success,
    false,
  );
  assert.equal(
    availabilityInputSchema.safeParse({ availableWeekdays: [] }).success,
    false,
  );
  assert.equal(
    availabilityInputSchema.safeParse({ availableWeekdays: [1, 1] }).success,
    false,
  );
  assert.equal(
    availabilityInputSchema.safeParse({ availableWeekdays: [1, 7] }).success,
    true,
  );
});

test("accepts a complete onboarding payload with optional target weight", () => {
  const result = createCompleteOnboardingSchema(
    new Date("2026-09-25T12:00:00Z"),
  ).safeParse(validOnboarding);
  assert.equal(result.success, true);
});
