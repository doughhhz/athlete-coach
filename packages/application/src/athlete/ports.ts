import type {
  AthleteGoal,
  AthleteIdentity,
  AthleteProfile,
  BodyWeightEntry,
  TrainingContext,
  Weekday,
} from "@athlete-coach/domain";

import type {
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  GoalInput,
  ProfileInput,
  TrainingContextInput,
} from "./schemas.ts";

export interface AthleteRepository {
  ensureCurrent(): Promise<AthleteIdentity>;
}

export interface AthleteProfileRepository {
  getCurrent(): Promise<AthleteProfile | null>;
  updateCurrent(input: ProfileInput): Promise<AthleteProfile>;
}

export interface AthleteGoalRepository {
  changeActive(input: GoalInput): Promise<AthleteGoal>;
  getActive(): Promise<AthleteGoal | null>;
}

export interface TrainingContextRepository {
  getAvailability(): Promise<readonly Weekday[]>;
  getCurrent(): Promise<TrainingContext | null>;
  setAvailability(input: AvailabilityInput): Promise<readonly Weekday[]>;
  updateCurrent(input: TrainingContextInput): Promise<TrainingContext>;
}

export interface BodyWeightRepository {
  getLatest(): Promise<BodyWeightEntry | null>;
  record(input: BodyWeightInput): Promise<BodyWeightEntry>;
}

export interface OnboardingRepository {
  complete(input: CompleteOnboardingInput): Promise<AthleteIdentity>;
}
