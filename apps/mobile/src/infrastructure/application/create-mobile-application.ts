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
  GetExerciseDetails,
  ListExerciseCatalogFacets,
  ListExercises,
  ActivateTrainingProgram,
  ArchiveTrainingProgram,
  CloneTrainingProgramAsDraft,
  CompleteTrainingProgram,
  CreateTrainingProgramDraft,
  GetActiveTrainingProgram,
  GetTrainingProgram,
  ListTrainingPrograms,
  SaveTrainingProgramStructure,
} from "@athlete-coach/application";
import {
  SupabaseAthleteGoalRepository,
  SupabaseAthleteProfileRepository,
  SupabaseAthleteRepository,
  SupabaseAuthRepository,
  SupabaseBodyWeightRepository,
  SupabaseOnboardingRepository,
  SupabaseTrainingContextRepository,
  SupabaseAnatomyRepository,
  SupabaseExerciseCatalogRepository,
  SupabaseTrainingProgramRepository,
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
  const exerciseRepository = new SupabaseExerciseCatalogRepository(client);
  const anatomyRepository = new SupabaseAnatomyRepository(client);
  const programs = new SupabaseTrainingProgramRepository(client);

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
    listExercises: new ListExercises(exerciseRepository),
    getExerciseDetails: new GetExerciseDetails(exerciseRepository),
    listExerciseFacets: new ListExerciseCatalogFacets(anatomyRepository),
    listPrograms: new ListTrainingPrograms(programs),
    getProgram: new GetTrainingProgram(programs),
    getActiveProgram: new GetActiveTrainingProgram(programs),
    createProgramDraft: new CreateTrainingProgramDraft(programs),
    saveProgramStructure: new SaveTrainingProgramStructure(programs),
    activateProgram: new ActivateTrainingProgram(programs),
    cloneProgram: new CloneTrainingProgramAsDraft(programs),
    completeProgram: new CompleteTrainingProgram(programs),
    archiveProgram: new ArchiveTrainingProgram(programs),
  } as const;
}

export type MobileApplication = ReturnType<typeof createMobileApplication>;
