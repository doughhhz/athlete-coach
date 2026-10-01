import type {
  InitialProgramEnvelope,
  InitialProgramIssue,
  InitialProgramQualityIssue,
  ProgramCatalogExercise,
  ProgramIntake,
} from "@athlete-coach/domain";

import type { ProgramIntakeInput, InitialProgramOutput } from "./schemas.ts";

export interface ProgramIntakeRepository {
  getCurrent(): Promise<ProgramIntake | null>;
  saveCurrent(input: ProgramIntakeInput): Promise<ProgramIntake>;
}
/** Active catalog with equipment slugs (generation needs compatibility). */
export interface ProgramCatalogReader {
  listForProgram(): Promise<readonly ProgramCatalogExercise[]>;
}

/** Everything the Personal receives. Free texts are untrusted data. */
export type InitialProgramRequest = Readonly<{
  facts: Readonly<{
    ageYears: number | null;
    heightCm: number | null;
    latestBodyWeightKg: number | null;
    goalType: InitialProgramEnvelope["goalType"];
    goalNotes: string | null;
    targetWeightKg: number | null;
    resistanceTrainingMonths: number;
    recentTrainingConsistency: string;
    experienceLevel: InitialProgramEnvelope["level"];
    routineSummary: string;
    averageSleepMinutes: number | null;
    preferredSessionMinutes: number;
    trainingEnvironment: string;
    availableWeekdays: readonly number[];
  }>;
  athleteNotes: Readonly<{
    constraintsNotes: string | null;
    preferencesNotes: string | null;
    currentPainOrInjury: boolean;
    painOrInjuryNotes: string | null;
    preferredExercisesNotes: string | null;
    avoidedExercisesNotes: string | null;
    otherSportsNotes: string | null;
  }>;
  envelope: InitialProgramEnvelope;
  /** Set on the single repair attempt after a failed validation. */
  previousIssues?: readonly (
    InitialProgramIssue | InitialProgramQualityIssue
  )[];
}>;
export type InitialProgramProviderResult = Readonly<{
  output: InitialProgramOutput;
  provider: string;
  model: string;
  promptVersion: string;
}>;
export interface InitialProgramProvider {
  generate(
    request: InitialProgramRequest,
    requestId: string,
  ): Promise<InitialProgramProviderResult>;
}

export type InitialProgramOrigin = "personal" | "basic";
export type InitialProgramGenerationEntry = Readonly<{
  programId: string;
  origin: InitialProgramOrigin;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  envelopeVersion: string;
  specVersion: string;
  repaired: boolean;
}>;
/** Backend-owned audit (metadata only, never the model text). */
export interface InitialProgramGenerationLog {
  record(entry: InitialProgramGenerationEntry): Promise<void>;
}
