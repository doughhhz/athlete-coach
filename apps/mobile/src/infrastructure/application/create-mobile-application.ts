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
  DeleteTrainingProgram,
  CreateTrainingProgramWithStructure,
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
  AssessWorkoutSet,
  BuildAthleteTrainingDossier,
  GetLongitudinalTrainingSignals,
  BuildInterventionOutcomes,
  BuildInterventionContext,
  GetResponseMemoryGroup,
  GetExerciseReplacementCandidates,
  ListInterventionOutcomes,
  GetCoachDecisionOutcome,
  GetIndividualResponseEvidence,
  GetCoachAutonomyMode,
  SetCoachAutonomyMode,
  GetCoachDraftAuthorityMode,
  SetCoachDraftAuthorityMode,
  BuildCoachDraftReviews,
  GetCoachDraftReviewEvidence,
  ListCoachDraftReviewHistory,
  LoadProgramIntake,
  SaveProgramIntake,
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
  SupabaseCoachPreferenceRepository,
  SupabaseProgramIntakeRepository,
  type AthleteCoachSupabaseClient,
} from "@athlete-coach/data-access";
import { SupabaseCoachGateway } from "@/infrastructure/coach/supabase-coach-gateway";
import { SupabaseInitialProgramGateway } from "@/infrastructure/initial-program/supabase-initial-program-gateway";

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
  const coachPreferences = new SupabaseCoachPreferenceRepository(client);
  const programIntakes = new SupabaseProgramIntakeRepository(client);
  const initialProgram = new SupabaseInitialProgramGateway(client);

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
    undefined,
    exerciseRepository,
  );
  // Review evidence is rebuilt from the RLS-scoped ledger and programs.
  const draftReviews = new BuildCoachDraftReviews(
    { list: () => coach.listDecisions() },
    programs,
  );
  const buildTrainingDossier = new BuildAthleteTrainingDossier(
    loadProfile,
    programs,
    workouts,
    performance,
    undefined,
    new BuildInterventionContext(interventionOutcomes),
    new GetExerciseReplacementCandidates(exerciseRepository),
    new ListCoachDraftReviewHistory(draftReviews),
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
    createProgramWithStructure: new CreateTrainingProgramWithStructure(
      programs,
    ),
    saveProgramStructure: new SaveTrainingProgramStructure(programs),
    activateProgram: new ActivateTrainingProgram(programs),
    cloneProgram: new CloneTrainingProgramAsDraft(programs),
    completeProgram: new CompleteTrainingProgram(programs),
    archiveProgram: new ArchiveTrainingProgram(programs),
    deleteProgram: new DeleteTrainingProgram(programs),
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
    assessWorkoutSet: new AssessWorkoutSet(performance, programs),
    buildTrainingDossier,
    getLongitudinalTrainingSignals: new GetLongitudinalTrainingSignals(
      buildTrainingDossier,
    ),
    analyzeWithCoach: (input: Parameters<SupabaseCoachGateway["analyze"]>[0]) =>
      coach.analyze(input),
    generateCoachProposal: (analysisRequestId: string) =>
      coach.propose(analysisRequestId),
    // Own preference only (RLS); explicit opt-in, default manual.
    getCoachAutonomyMode: new GetCoachAutonomyMode(coachPreferences),
    setCoachAutonomyMode: new SetCoachAutonomyMode(coachPreferences),
    getCoachDraftAuthorityMode: new GetCoachDraftAuthorityMode(
      coachPreferences,
    ),
    listCoachDraftReviewHistory: new ListCoachDraftReviewHistory(draftReviews),
    getCoachDraftReviewEvidence: new GetCoachDraftReviewEvidence(draftReviews),
    setCoachDraftAuthorityMode: new SetCoachDraftAuthorityMode(
      coachPreferences,
    ),
    listCoachDecisions: () => coach.listDecisions(),
    listInterventionOutcomes: new ListInterventionOutcomes(
      interventionOutcomes,
    ),
    getCoachDecisionOutcome: new GetCoachDecisionOutcome(interventionOutcomes),
    getIndividualResponseEvidence: new GetIndividualResponseEvidence(
      interventionOutcomes,
    ),
    getResponseMemoryGroup: new GetResponseMemoryGroup(interventionOutcomes),
    materializeCoachProposal: (
      id: string,
      input?: Parameters<SupabaseCoachGateway["materialize"]>[1],
    ) => coach.materialize(id, input),
    // Initial program (ADR-0119): own answers (RLS) and the backend generator.
    loadProgramIntake: new LoadProgramIntake(programIntakes),
    saveProgramIntake: new SaveProgramIntake(programIntakes),
    generateInitialProgram: (
      mode: "personal" | "basic",
      creationRequestId: string,
    ) => initialProgram.generate(mode, creationRequestId),
    rejectCoachProposal: (
      id: string,
      reason: Parameters<SupabaseCoachGateway["reject"]>[1],
    ) => coach.reject(id, reason),
  } as const;
}

export type MobileApplication = ReturnType<typeof createMobileApplication>;
