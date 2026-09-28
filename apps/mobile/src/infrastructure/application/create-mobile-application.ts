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
  StartWorkoutSession,
  GetInProgressWorkoutSession,
  GetWorkoutSession,
  ListWorkoutSessions,
  RecordWorkoutSet,
  SkipWorkoutSet,
  CompleteWorkoutSession,
  AbandonWorkoutSession,
  GetPerformanceOverview,
  GetExercisePerformanceHistory,
  GetExercisePersonalBests,
  GetWorkoutDerivedSummary,
  BuildAthleteTrainingDossier,
  GetLongitudinalTrainingSignals,
  BuildInterventionOutcomes,
  BuildInterventionHistory,
  ListInterventionOutcomes,
  GetCoachDecisionOutcome,
  GetIndividualResponseEvidence,
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
  SupabaseWorkoutSessionRepository,
  SupabasePerformanceReadRepository,
  type AthleteCoachSupabaseClient,
} from "@athlete-coach/data-access";
import { SupabaseCoachGateway } from "@/infrastructure/coach/supabase-coach-gateway";

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
  const workouts = new SupabaseWorkoutSessionRepository(client);
  const performance = new SupabasePerformanceReadRepository(client);
  const coach = new SupabaseCoachGateway(client);

  const loadProfile = new LoadCurrentAthleteProfile(
    athleteRepository,
    profileRepository,
    goalRepository,
    trainingRepository,
    weightRepository,
  );
  // Decisions are read through the authenticated coach gateway (RLS-scoped).
  const interventionOutcomes = new BuildInterventionOutcomes(
    { list: () => coach.listDecisions() },
    programs,
    performance,
    weightRepository,
  );
  const buildTrainingDossier = new BuildAthleteTrainingDossier(
    loadProfile,
    programs,
    workouts,
    performance,
    undefined,
    new BuildInterventionHistory(interventionOutcomes),
  );
  return {
    authRepository,
    changeActiveGoal: new ChangeActiveGoal(goalRepository),
    completeOnboarding: new CompleteAthleteOnboarding(onboardingRepository),
    ensureAthlete: new EnsureCurrentAthlete(athleteRepository),
    getLatestWeight: new GetLatestBodyWeight(weightRepository),
    loadProfile,
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
    startWorkout: new StartWorkoutSession(workouts),
    getInProgressWorkout: new GetInProgressWorkoutSession(workouts),
    getWorkout: new GetWorkoutSession(workouts),
    listWorkouts: new ListWorkoutSessions(workouts),
    recordWorkoutSet: new RecordWorkoutSet(workouts),
    skipWorkoutSet: new SkipWorkoutSet(workouts),
    completeWorkout: new CompleteWorkoutSession(workouts),
    abandonWorkout: new AbandonWorkoutSession(workouts),
    getPerformanceOverview: new GetPerformanceOverview(performance),
    getExercisePerformanceHistory: new GetExercisePerformanceHistory(
      performance,
    ),
    getExercisePersonalBests: new GetExercisePersonalBests(performance),
    getWorkoutDerivedSummary: new GetWorkoutDerivedSummary(performance),
    buildTrainingDossier,
    getLongitudinalTrainingSignals: new GetLongitudinalTrainingSignals(
      buildTrainingDossier,
    ),
    analyzeWithCoach: (input: Parameters<SupabaseCoachGateway["analyze"]>[0]) =>
      coach.analyze(input),
    generateCoachProposal: (
      analysis: Parameters<SupabaseCoachGateway["propose"]>[0],
    ) => coach.propose(analysis),
    listCoachDecisions: () => coach.listDecisions(),
    listInterventionOutcomes: new ListInterventionOutcomes(
      interventionOutcomes,
    ),
    getCoachDecisionOutcome: new GetCoachDecisionOutcome(interventionOutcomes),
    getIndividualResponseEvidence: new GetIndividualResponseEvidence(
      interventionOutcomes,
    ),
    materializeCoachProposal: (id: string) => coach.materialize(id),
    rejectCoachProposal: (
      id: string,
      reason: Parameters<SupabaseCoachGateway["reject"]>[1],
    ) => coach.reject(id, reason),
  } as const;
}

export type MobileApplication = ReturnType<typeof createMobileApplication>;
