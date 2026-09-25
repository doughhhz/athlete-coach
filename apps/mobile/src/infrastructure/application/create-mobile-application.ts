import {
  ChangeActiveGoal,
  CompleteAthleteOnboarding,
  EnsureCurrentAthlete,
  GetLatestBodyWeight,
  LoadCurrentAthleteProfile,
  RecordBodyWeight,
  RestoreSession,
  SetTrainingAvailability,
  SignInWithEmail,
  SignOutCurrentSession,
  SignUpWithEmail,
  UpdateAthleteProfile,
  UpdateTrainingContext,
} from "@athlete-coach/application";
import {
  SupabaseAthleteGoalRepository,
  SupabaseAthleteProfileRepository,
  SupabaseAthleteRepository,
  SupabaseAuthRepository,
  SupabaseBodyWeightRepository,
  SupabaseOnboardingRepository,
  SupabaseTrainingContextRepository,
  type AthleteCoachSupabaseClient,
} from "@athlete-coach/data-access";

export function createMobileApplication(client: AthleteCoachSupabaseClient) {
  const authRepository = new SupabaseAuthRepository(client);
  const athleteRepository = new SupabaseAthleteRepository(client);
  const profileRepository = new SupabaseAthleteProfileRepository(client);
  const goalRepository = new SupabaseAthleteGoalRepository(client);
  const trainingRepository = new SupabaseTrainingContextRepository(client);
  const weightRepository = new SupabaseBodyWeightRepository(client);
  const onboardingRepository = new SupabaseOnboardingRepository(client);

  return {
    authRepository,
    changeActiveGoal: new ChangeActiveGoal(goalRepository),
    completeOnboarding: new CompleteAthleteOnboarding(onboardingRepository),
    ensureAthlete: new EnsureCurrentAthlete(athleteRepository),
    getLatestWeight: new GetLatestBodyWeight(weightRepository),
    loadProfile: new LoadCurrentAthleteProfile(
      athleteRepository,
      profileRepository,
      goalRepository,
      trainingRepository,
      weightRepository,
    ),
    recordWeight: new RecordBodyWeight(weightRepository),
    restoreSession: new RestoreSession(authRepository),
    setAvailability: new SetTrainingAvailability(trainingRepository),
    signIn: new SignInWithEmail(authRepository),
    signOut: new SignOutCurrentSession(authRepository),
    signUp: new SignUpWithEmail(authRepository),
    updateProfile: new UpdateAthleteProfile(profileRepository),
    updateTrainingContext: new UpdateTrainingContext(trainingRepository),
  } as const;
}

export type MobileApplication = ReturnType<typeof createMobileApplication>;
