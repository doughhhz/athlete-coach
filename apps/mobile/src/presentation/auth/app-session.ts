import type {
  AuthCredentials,
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  ProfileInput,
  TrainingContextInput,
  CreateProgramWithStructureInput,
  ProgramStructureInput,
  RecordWorkoutSetInput,
  AnalyzeWithGovernanceResult as CoachAnalysisResult,
} from "@athlete-coach/application";
import type {
  AthleteSnapshot,
  ExerciseCatalogFacets,
  ExerciseCatalogFilters,
  ExerciseDetails,
  ExerciseSummary,
  TrainingProgram,
  TrainingProgramSummary,
  WorkoutSession,
  WorkoutSessionSummary,
  PerformanceOverview,
  ExercisePerformancePoint,
  ExercisePersonalBest,
  SessionDerivedMetrics,
  AthleteTrainingDossier,
  CoachAnalysisMode,
  CoachAutonomyMode,
  CoachDraftAuthorityMode,
  CoachDraftReviewEvidence,
  CoachDraftReviewHistory,
  CoachConversationMessage,
  CoachDecision,
  CoachRejectionReason,
  ComparableInterventionGroup,
  IndividualResponseEvidence,
  InterventionOutcomeEvaluation,
} from "@athlete-coach/domain";
import { createContext, useContext } from "react";

export type AppAccessState =
  | "booting"
  | "configuration_error"
  | "signed_out"
  | "signed_in_onboarding_required"
  | "signed_in_ready";

export type AppSessionValue = Readonly<{
  accessState: AppAccessState;
  configurationMessage: string | null;
  error: string | null;
  notice: string | null;
  snapshot: AthleteSnapshot | null;
  clearMessages(): void;
  completeOnboarding(input: CompleteOnboardingInput): Promise<void>;
  recordWeight(input: BodyWeightInput): Promise<void>;
  refresh(): Promise<void>;
  retryInitialization(): Promise<void>;
  setAvailability(input: AvailabilityInput): Promise<void>;
  signIn(credentials: AuthCredentials): Promise<void>;
  signOut(): Promise<void>;
  signUp(credentials: AuthCredentials): Promise<void>;
  updateProfile(input: ProfileInput): Promise<void>;
  updateTrainingContext(input: TrainingContextInput): Promise<void>;
  listExercises(
    filters?: ExerciseCatalogFilters,
  ): Promise<readonly ExerciseSummary[]>;
  getExerciseDetails(slug: string): Promise<ExerciseDetails | null>;
  listExerciseFacets(): Promise<ExerciseCatalogFacets>;
  listPrograms(): Promise<readonly TrainingProgramSummary[]>;
  getProgram(id: string): Promise<TrainingProgram | null>;
  getActiveProgram(): Promise<TrainingProgram | null>;
  /** One atomic, idempotent creation boundary (no create-then-save). */
  createProgramWithStructure(
    input: CreateProgramWithStructureInput,
  ): Promise<TrainingProgram>;
  saveProgramStructure(
    id: string,
    input: ProgramStructureInput,
  ): Promise<TrainingProgram>;
  activateProgram(id: string): Promise<TrainingProgram>;
  cloneProgram(id: string): Promise<TrainingProgram>;
  completeProgram(id: string): Promise<TrainingProgram>;
  archiveProgram(id: string): Promise<TrainingProgram>;
  startWorkout(trainingDayId: string): Promise<WorkoutSession>;
  getInProgressWorkout(): Promise<WorkoutSession | null>;
  getWorkout(id: string): Promise<WorkoutSession | null>;
  listWorkouts(): Promise<readonly WorkoutSessionSummary[]>;
  recordWorkoutSet(
    sessionId: string,
    setId: string,
    input: RecordWorkoutSetInput,
  ): Promise<WorkoutSession>;
  skipWorkoutSet(setId: string): Promise<WorkoutSession>;
  completeWorkout(id: string): Promise<WorkoutSession>;
  abandonWorkout(id: string): Promise<WorkoutSession>;
  getPerformanceOverview(): Promise<PerformanceOverview>;
  getExercisePerformanceHistory(
    exerciseId?: string,
  ): Promise<readonly ExercisePerformancePoint[]>;
  getExercisePersonalBests(): Promise<readonly ExercisePersonalBest[]>;
  getWorkoutDerivedSummary(id: string): Promise<Readonly<{
    metrics: SessionDerivedMetrics;
    personalRecordEvents: readonly ExercisePerformancePoint[];
  }> | null>;
  buildTrainingDossier(): Promise<AthleteTrainingDossier>;
  analyzeWithCoach(
    input: Readonly<{
      userRequest: string;
      analysisMode: CoachAnalysisMode;
      conversationContext: readonly CoachConversationMessage[];
      analysisRequestId: string;
    }>,
  ): Promise<CoachAnalysisResult>;
  /** Sends only the server-owned analysis identity, never the analysis. */
  generateCoachProposal(
    analysisRequestId: string,
  ): Promise<CoachDecision | null>;
  getCoachAutonomyMode(): Promise<CoachAutonomyMode>;
  setCoachAutonomyMode(mode: CoachAutonomyMode): Promise<CoachAutonomyMode>;
  /** Independent Conservative Auto-Draft opt-in (default manual_draft). */
  getCoachDraftAuthorityMode(): Promise<CoachDraftAuthorityMode>;
  /** Factual review evidence of materialized drafts (derived, read-only). */
  listCoachDraftReviewHistory(limit?: number): Promise<CoachDraftReviewHistory>;
  getCoachDraftReviewEvidence(
    decisionId: string,
  ): Promise<CoachDraftReviewEvidence | null>;
  setCoachDraftAuthorityMode(
    mode: CoachDraftAuthorityMode,
  ): Promise<CoachDraftAuthorityMode>;
  listCoachDecisions(): Promise<readonly CoachDecision[]>;
  listInterventionOutcomes(): Promise<readonly InterventionOutcomeEvaluation[]>;
  getCoachDecisionOutcome(
    decisionId: string,
  ): Promise<InterventionOutcomeEvaluation | null>;
  getIndividualResponseEvidence(): Promise<
    readonly IndividualResponseEvidence[]
  >;
  getResponseMemoryGroup(
    key: string,
  ): Promise<ComparableInterventionGroup | null>;
  materializeCoachProposal(
    id: string,
    input?: Readonly<{ confirmElevatedReview?: boolean }>,
  ): Promise<CoachDecision>;
  rejectCoachProposal(
    id: string,
    reason: CoachRejectionReason,
  ): Promise<CoachDecision>;
}>;

export const AppSessionContext = createContext<AppSessionValue | null>(null);

export function useAppSession(): AppSessionValue {
  const value = useContext(AppSessionContext);
  if (!value)
    throw new Error("useAppSession must be used inside AppSessionProvider.");
  return value;
}
