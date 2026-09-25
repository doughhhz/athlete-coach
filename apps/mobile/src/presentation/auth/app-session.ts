import type {
  AuthCredentials,
  AvailabilityInput,
  BodyWeightInput,
  CompleteOnboardingInput,
  ProfileInput,
  TrainingContextInput,
} from "@athlete-coach/application";
import type { AthleteSnapshot } from "@athlete-coach/domain";
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
}>;

export const AppSessionContext = createContext<AppSessionValue | null>(null);

export function useAppSession(): AppSessionValue {
  const value = useContext(AppSessionContext);
  if (!value)
    throw new Error("useAppSession must be used inside AppSessionProvider.");
  return value;
}
