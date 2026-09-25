import type { AthleteSnapshot } from "@athlete-coach/domain";

import type {
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  GoalInput,
  ProfileInput,
  TrainingContextInput,
} from "./schemas.ts";
import type {
  AthleteGoalRepository,
  AthleteProfileRepository,
  AthleteRepository,
  BodyWeightRepository,
  OnboardingRepository,
  TrainingContextRepository,
} from "./ports.ts";

export class EnsureCurrentAthlete {
  private readonly athletes: AthleteRepository;
  constructor(athletes: AthleteRepository) {
    this.athletes = athletes;
  }
  execute() {
    return this.athletes.ensureCurrent();
  }
}

export class CompleteAthleteOnboarding {
  private readonly onboarding: OnboardingRepository;
  constructor(onboarding: OnboardingRepository) {
    this.onboarding = onboarding;
  }
  execute(input: CompleteOnboardingInput) {
    return this.onboarding.complete(input);
  }
}

export class LoadCurrentAthleteProfile {
  private readonly athletes: AthleteRepository;
  private readonly profiles: AthleteProfileRepository;
  private readonly goals: AthleteGoalRepository;
  private readonly training: TrainingContextRepository;
  private readonly weights: BodyWeightRepository;

  constructor(
    athletes: AthleteRepository,
    profiles: AthleteProfileRepository,
    goals: AthleteGoalRepository,
    training: TrainingContextRepository,
    weights: BodyWeightRepository,
  ) {
    this.athletes = athletes;
    this.profiles = profiles;
    this.goals = goals;
    this.training = training;
    this.weights = weights;
  }

  async execute(): Promise<AthleteSnapshot> {
    const athlete = await this.athletes.ensureCurrent();
    const [
      profile,
      activeGoal,
      trainingContext,
      availableWeekdays,
      latestWeight,
    ] = await Promise.all([
      this.profiles.getCurrent(),
      this.goals.getActive(),
      this.training.getCurrent(),
      this.training.getAvailability(),
      this.weights.getLatest(),
    ]);
    return {
      athlete,
      profile,
      activeGoal,
      trainingContext,
      availableWeekdays,
      latestWeight,
    };
  }
}

export class UpdateAthleteProfile {
  private readonly profiles: AthleteProfileRepository;
  constructor(profiles: AthleteProfileRepository) {
    this.profiles = profiles;
  }
  execute(input: ProfileInput) {
    return this.profiles.updateCurrent(input);
  }
}

export class UpdateTrainingContext {
  private readonly training: TrainingContextRepository;
  constructor(training: TrainingContextRepository) {
    this.training = training;
  }
  execute(input: TrainingContextInput) {
    return this.training.updateCurrent(input);
  }
}

export class SetTrainingAvailability {
  private readonly training: TrainingContextRepository;
  constructor(training: TrainingContextRepository) {
    this.training = training;
  }
  execute(input: AvailabilityInput) {
    return this.training.setAvailability(input);
  }
}

export class ChangeActiveGoal {
  private readonly goals: AthleteGoalRepository;
  constructor(goals: AthleteGoalRepository) {
    this.goals = goals;
  }
  execute(input: GoalInput) {
    return this.goals.changeActive(input);
  }
}

export class RecordBodyWeight {
  private readonly weights: BodyWeightRepository;
  constructor(weights: BodyWeightRepository) {
    this.weights = weights;
  }
  execute(input: BodyWeightInput) {
    return this.weights.record(input);
  }
}

export class GetLatestBodyWeight {
  private readonly weights: BodyWeightRepository;
  constructor(weights: BodyWeightRepository) {
    this.weights = weights;
  }
  execute() {
    return this.weights.getLatest();
  }
}
