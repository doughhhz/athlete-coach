import type {
  AuthCredentials,
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  ProfileInput,
  TrainingContextInput,
} from "@athlete-coach/application";
import type {
  AthleteSnapshot,
  ExerciseCatalogFilters,
} from "@athlete-coach/domain";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  createMobileApplication,
  type MobileApplication,
} from "@/infrastructure/application/create-mobile-application";
import {
  getMobileBackendConfiguration,
  registerSupabaseAuthLifecycle,
} from "@/infrastructure/supabase/mobile-supabase-client";
import {
  AppSessionContext,
  type AppAccessState,
  type AppSessionValue,
} from "@/presentation/auth/app-session";

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro. Tente novamente.";
}

export function AppSessionProvider({ children }: PropsWithChildren) {
  const backend = useMemo(() => getMobileBackendConfiguration(), []);
  const application = useMemo(
    () =>
      backend.status === "configured"
        ? createMobileApplication(backend.client)
        : null,
    [backend],
  );
  const [accessState, setAccessState] = useState<AppAccessState>(
    backend.status === "configured" ? "booting" : "configuration_error",
  );
  const [snapshot, setSnapshot] = useState<AthleteSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Offer the Personal's first program once, right after onboarding.
  const [initialProgramOffer, setInitialProgramOffer] = useState(false);
  const operation = useRef(0);

  async function loadAuthenticatedState(app: MobileApplication): Promise<void> {
    const currentOperation = ++operation.current;
    try {
      const athlete = await app.ensureAthlete.execute();
      if (currentOperation !== operation.current) return;
      if (!athlete.onboardingCompletedAt) {
        setSnapshot(null);
        setAccessState("signed_in_onboarding_required");
        return;
      }
      const nextSnapshot = await app.loadProfile.execute();
      if (currentOperation !== operation.current) return;
      setSnapshot(nextSnapshot);
      setAccessState("signed_in_ready");
    } catch (caught) {
      if (currentOperation === operation.current) {
        setError(messageFrom(caught));
        setAccessState("booting");
      }
    }
  }

  useEffect(() => {
    if (!application || backend.status !== "configured") return;
    let active = true;
    const stopRefresh = registerSupabaseAuthLifecycle(backend.client);
    const unsubscribe = application.authRepository.onSessionChange(
      (session) => {
        if (!active) return;
        if (!session) {
          operation.current += 1;
          setSnapshot(null);
          setAccessState("signed_out");
        } else {
          void loadAuthenticatedState(application);
        }
      },
    );
    void application.restoreSession
      .execute()
      .then((session) => {
        if (!active) return;
        if (session) void loadAuthenticatedState(application);
        else setAccessState("signed_out");
      })
      .catch((caught) => {
        if (active) {
          setError(messageFrom(caught));
          setAccessState("booting");
        }
      });
    return () => {
      active = false;
      unsubscribe();
      stopRefresh();
    };
  }, [application, backend]);

  async function run(action: () => Promise<void>): Promise<void> {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(messageFrom(caught));
      throw caught;
    }
  }

  async function refresh(): Promise<void> {
    if (!application) return;
    const next = await application.loadProfile.execute();
    setSnapshot(next);
    setAccessState("signed_in_ready");
  }

  const value: AppSessionValue = {
    accessState,
    configurationMessage:
      backend.status === "configuration_error" ? backend.message : null,
    error,
    notice,
    snapshot,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    completeOnboarding: async (input: CompleteOnboardingInput) =>
      run(async () => {
        if (!application) return;
        await application.completeOnboarding.execute(input);
        setInitialProgramOffer(true);
        await refresh();
      }),
    recordWeight: async (input: BodyWeightInput) =>
      run(async () => {
        if (application) {
          await application.recordWeight.execute(input);
          await refresh();
        }
      }),
    refresh: () => run(refresh),
    retryInitialization: () =>
      run(async () => {
        if (!application) return;
        setAccessState("booting");
        const session = await application.restoreSession.execute();
        if (session) await loadAuthenticatedState(application);
        else setAccessState("signed_out");
      }),
    setAvailability: async (input: AvailabilityInput) =>
      run(async () => {
        if (application) {
          await application.setAvailability.execute(input);
          await refresh();
        }
      }),
    signIn: async (credentials: AuthCredentials) =>
      run(async () => {
        if (application) await application.signIn.execute(credentials);
      }),
    signOut: async () =>
      run(async () => {
        if (application) await application.signOut.execute();
      }),
    signUp: async (credentials: AuthCredentials) =>
      run(async () => {
        if (!application) return;
        const result = await application.signUp.execute(credentials);
        if (result.requiresEmailConfirmation)
          setNotice("Conta criada. Confirme seu e-mail antes de entrar.");
      }),
    updateProfile: async (input: ProfileInput) =>
      run(async () => {
        if (application) {
          await application.updateProfile.execute(input);
          await refresh();
        }
      }),
    updateTrainingContext: async (input: TrainingContextInput) =>
      run(async () => {
        if (application) {
          await application.updateTrainingContext.execute(input);
          await refresh();
        }
      }),
    listExercises: async (filters: ExerciseCatalogFilters = {}) => {
      if (!application) return [];
      return application.listExercises.execute(filters);
    },
    getExerciseDetails: async (slug: string) => {
      if (!application) return null;
      return application.getExerciseDetails.execute(slug);
    },
    listExerciseFacets: async () => {
      if (!application) return { muscleGroups: [], muscles: [], equipment: [] };
      return application.listExerciseFacets.execute();
    },
    listPrograms: async () => application?.listPrograms.execute() ?? [],
    getProgram: async (id) => application?.getProgram.execute(id) ?? null,
    getActiveProgram: async () =>
      application?.getActiveProgram.execute() ?? null,
    createProgramWithStructure: async (input) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.createProgramWithStructure.execute(input);
    },
    saveProgramStructure: async (id, input) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.saveProgramStructure.execute(id, input);
    },
    activateProgram: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.activateProgram.execute(id);
    },
    cloneProgram: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.cloneProgram.execute(id);
    },
    completeProgram: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.completeProgram.execute(id);
    },
    archiveProgram: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.archiveProgram.execute(id);
    },
    deleteProgram: async (id) => {
      if (!application) throw new Error("Não foi possível excluir o programa.");
      return application.deleteProgram.execute(id);
    },
    startWorkout: async (dayId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.startWorkout.execute(dayId);
    },
    getInProgressWorkout: async () =>
      application?.getInProgressWorkout.execute() ?? null,
    getWorkout: async (id) => application?.getWorkout.execute(id) ?? null,
    listWorkouts: async () => application?.listWorkouts.execute() ?? [],
    recordWorkoutSet: async (sessionId, setId, input) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.recordWorkoutSet.execute(sessionId, setId, input);
    },
    skipWorkoutSet: async (setId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.skipWorkoutSet.execute(setId);
    },
    completeWorkout: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.completeWorkout.execute(id);
    },
    abandonWorkout: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.abandonWorkout.execute(id);
    },
    getPerformanceOverview: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getPerformanceOverview.execute();
    },
    getExercisePerformanceHistory: async (exerciseId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getExercisePerformanceHistory.execute(exerciseId);
    },
    getExercisePersonalBests: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getExercisePersonalBests.execute();
    },
    getWorkoutDerivedSummary: async (id) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getWorkoutDerivedSummary.execute(id);
    },
    assessWorkoutSet: async (session, workoutSetId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.assessWorkoutSet.execute({ session, workoutSetId });
    },
    buildTrainingDossier: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.buildTrainingDossier.execute();
    },
    analyzeWithCoach: async (input) => {
      if (!application)
        throw new Error("O Personal está temporariamente indisponível.");
      return application.analyzeWithCoach(input);
    },
    getProgramIntake: async () =>
      application?.loadProgramIntake.execute() ?? null,
    saveProgramIntake: async (input) => {
      if (!application)
        throw new Error("Não foi possível salvar suas respostas.");
      return application.saveProgramIntake.execute(input);
    },
    generateInitialProgram: async (mode, creationRequestId) => {
      if (!application)
        throw new Error("O Personal está temporariamente indisponível.");
      return application.generateInitialProgram(mode, creationRequestId);
    },
    initialProgramOffer,
    dismissInitialProgramOffer: () => setInitialProgramOffer(false),
    generateCoachProposal: async (analysisRequestId) => {
      if (!application)
        throw new Error("O Personal está temporariamente indisponível.");
      return application.generateCoachProposal(analysisRequestId);
    },
    getCoachAutonomyMode: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getCoachAutonomyMode.execute();
    },
    setCoachAutonomyMode: async (mode) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.setCoachAutonomyMode.execute(mode);
    },
    listCoachDraftReviewHistory: async (limit) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.listCoachDraftReviewHistory.execute(limit);
    },
    getCoachDraftReviewEvidence: async (decisionId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getCoachDraftReviewEvidence.execute(decisionId);
    },
    getCoachDraftAuthorityMode: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getCoachDraftAuthorityMode.execute();
    },
    setCoachDraftAuthorityMode: async (mode) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.setCoachDraftAuthorityMode.execute(mode);
    },
    listCoachDecisions: async () => application?.listCoachDecisions() ?? [],
    listInterventionOutcomes: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.listInterventionOutcomes.execute();
    },
    getCoachDecisionOutcome: async (decisionId) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getCoachDecisionOutcome.execute(decisionId);
    },
    getIndividualResponseEvidence: async () => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getIndividualResponseEvidence.execute();
    },
    getResponseMemoryGroup: async (key) => {
      if (!application) throw new Error("Backend não configurado.");
      return application.getResponseMemoryGroup.execute(key);
    },
    materializeCoachProposal: async (id, input) => {
      if (!application)
        throw new Error("O Personal está temporariamente indisponível.");
      return application.materializeCoachProposal(id, input);
    },
    rejectCoachProposal: async (id, reason) => {
      if (!application)
        throw new Error("O Personal está temporariamente indisponível.");
      return application.rejectCoachProposal(id, reason);
    },
  };

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}
