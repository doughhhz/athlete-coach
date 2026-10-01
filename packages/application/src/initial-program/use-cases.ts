import {
  buildBasicInitialProgram,
  computeInitialProgramEnvelope,
  validateInitialProgramPlan,
  type AthleteSnapshot,
  type InitialProgramEnvelope,
  type InitialProgramIssue,
  type InitialProgramPlan,
  type ProgramIntake,
} from "@athlete-coach/domain";

import type { CoachSafetyPolicy } from "../coach/ports.ts";
import { ProgramCreationConflictError } from "../training/ports.ts";
import type { ProgramStructureInput } from "../training/schemas.ts";
import type { CreateTrainingProgramWithStructure } from "../training/use-cases.ts";
import type {
  InitialProgramGenerationLog,
  InitialProgramOrigin,
  InitialProgramProvider,
  InitialProgramRequest,
  ProgramCatalogReader,
  ProgramIntakeRepository,
} from "./ports.ts";
import {
  initialProgramOutputSchema,
  programIntakeInputSchema,
  type GenerateInitialProgramRequest,
  type ProgramIntakeInput,
} from "./schemas.ts";

/** Canonical Personal specification the prompts derive from (ADR-0119). */
export const PERSONAL_SPEC_VERSION = "personal-spec-v1" as const;

export class LoadProgramIntake {
  private readonly intakes: ProgramIntakeRepository;
  constructor(intakes: ProgramIntakeRepository) {
    this.intakes = intakes;
  }
  execute() {
    return this.intakes.getCurrent();
  }
}
export class SaveProgramIntake {
  private readonly intakes: ProgramIntakeRepository;
  constructor(intakes: ProgramIntakeRepository) {
    this.intakes = intakes;
  }
  execute(input: ProgramIntakeInput) {
    return this.intakes.saveCurrent(programIntakeInputSchema.parse(input));
  }
}

export type InitialProgramBlockReason = "medical_restriction" | "safety";
/** Neither the Personal nor the basic template prescribes here. */
export class InitialProgramBlockedError extends Error {
  readonly reason: InitialProgramBlockReason;
  constructor(reason: InitialProgramBlockReason) {
    super(
      reason === "medical_restriction"
        ? "Você informou restrição médica para exercícios. Procure liberação profissional antes de iniciar um programa."
        : "Pelo que você descreveu, o recomendado é procurar avaliação profissional antes de iniciar um programa.",
    );
    this.name = "InitialProgramBlockedError";
    this.reason = reason;
  }
}
/** The Personal's plan stayed outside the envelope after one repair. */
export class InitialProgramInvalidError extends Error {
  readonly issues: readonly InitialProgramIssue[];
  constructor(issues: readonly InitialProgramIssue[]) {
    super("O programa proposto não passou na validação do sistema.");
    this.name = "InitialProgramInvalidError";
    this.issues = issues;
  }
}

export type GenerateInitialProgramResult =
  | Readonly<{
      status: "created";
      programId: string;
      origin: InitialProgramOrigin;
      reused: boolean;
      repaired: boolean;
    }>
  | Readonly<{ status: "cannot_build"; reason: string }>;

const DESCRIPTION_LIMIT = 1000;
const clip = (text: string, limit = DESCRIPTION_LIMIT) =>
  text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;

/** One block, one repeated template week, days ordered by weekday. */
export function initialProgramToStructure(
  plan: InitialProgramPlan,
): ProgramStructureInput {
  const days = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  return {
    blocks: [
      {
        sequence: 1,
        name: "Base",
        ...(plan.athleteNotes.length
          ? { description: clip(plan.athleteNotes.join("\n")) }
          : {}),
        weeks: [
          {
            sequence: 1,
            name: "Semana-modelo",
            notes: "Repita esta semana até o próximo ajuste.",
            days: days.map((day, dayIndex) => ({
              sequence: dayIndex + 1,
              name: day.name,
              preferredWeekday: day.weekday,
              notes: clip(`${day.focus}. ${day.rationale}`),
              prescriptions: day.exercises.map((exercise, index) => ({
                sequence: index + 1,
                exerciseId: exercise.exerciseId,
                instructions: clip(
                  `Por que este exercício: ${exercise.rationale}`,
                ),
                sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
                  sequence: setIndex + 1,
                  targetMetric: exercise.targetMetric,
                  targetMin: exercise.targetMin,
                  targetMax: exercise.targetMax,
                  rirMin: exercise.rirMin,
                  rirMax: exercise.rirMax,
                  restMinSeconds: exercise.restMinSeconds,
                  restMaxSeconds: exercise.restMaxSeconds,
                  tempo: null,
                  // No load history yet: the athlete chooses, guided by RIR.
                  loadKind: "athlete_selected" as const,
                  loadKg: null,
                })),
              })),
            })),
          },
        ],
      },
    ],
  };
}

function programDescription(plan: InitialProgramPlan): string {
  const assumptions = plan.assumptions.length
    ? `\n\nSuposições: ${plan.assumptions.join(" ")}`
    : "";
  return clip(`${plan.summary}${assumptions}`);
}

/**
 * The Personal (or the basic template) proposes the first program; the
 * system validates it against the envelope and creates an inactive draft
 * through the atomic creation path. Activation stays human (ADR-0119).
 */
export class GenerateInitialProgram {
  private readonly profile: { execute(): Promise<AthleteSnapshot> };
  private readonly intakes: ProgramIntakeRepository;
  private readonly catalog: ProgramCatalogReader;
  private readonly provider: InitialProgramProvider;
  private readonly safety: CoachSafetyPolicy;
  private readonly create: CreateTrainingProgramWithStructure;
  private readonly log: InitialProgramGenerationLog;
  private readonly requestId: () => string;
  private readonly now: () => Date;
  constructor(
    dependencies: Readonly<{
      profile: { execute(): Promise<AthleteSnapshot> };
      intakes: ProgramIntakeRepository;
      catalog: ProgramCatalogReader;
      provider: InitialProgramProvider;
      safety: CoachSafetyPolicy;
      create: CreateTrainingProgramWithStructure;
      log: InitialProgramGenerationLog;
      requestId?: () => string;
      now?: () => Date;
    }>,
  ) {
    this.profile = dependencies.profile;
    this.intakes = dependencies.intakes;
    this.catalog = dependencies.catalog;
    this.provider = dependencies.provider;
    this.safety = dependencies.safety;
    this.create = dependencies.create;
    this.log = dependencies.log;
    this.requestId = dependencies.requestId ?? (() => crypto.randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(
    request: GenerateInitialProgramRequest,
  ): Promise<GenerateInitialProgramResult> {
    const [snapshot, intake, catalog] = await Promise.all([
      this.profile.execute(),
      this.intakes.getCurrent(),
      this.catalog.listForProgram(),
    ]);
    this.assertSafe(snapshot, intake);
    const envelope = computeInitialProgramEnvelope({
      snapshot,
      intake,
      catalog,
      asOf: this.now(),
    });
    if (request.mode === "basic")
      return this.persist(request, buildBasicInitialProgram(envelope), {
        origin: "basic",
        provider: null,
        model: null,
        promptVersion: null,
        repaired: false,
        envelopeVersion: envelope.version,
      });

    const base = personalRequest(snapshot, intake, envelope);
    let result = await this.provider.generate(base, this.requestId());
    let output = initialProgramOutputSchema.parse(result.output);
    let repaired = false;
    if (output.outcome === "program" && output.program) {
      const issues = validateInitialProgramPlan(output.program, envelope);
      if (issues.length) {
        // One repair attempt with the system's issues; never more.
        repaired = true;
        result = await this.provider.generate(
          { ...base, previousIssues: issues },
          this.requestId(),
        );
        output = initialProgramOutputSchema.parse(result.output);
      }
    }
    if (output.outcome === "cannot_build" || !output.program)
      return {
        status: "cannot_build",
        reason: output.cannotBuildReason ?? "",
      };
    const issues = validateInitialProgramPlan(output.program, envelope);
    if (issues.length) throw new InitialProgramInvalidError(issues);
    return this.persist(request, output.program, {
      origin: "personal",
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      repaired,
      envelopeVersion: envelope.version,
    });
  }

  private assertSafe(snapshot: AthleteSnapshot, intake: ProgramIntake | null) {
    if (intake?.medicalExerciseRestriction)
      throw new InitialProgramBlockedError("medical_restriction");
    const texts = [
      intake?.painOrInjuryNotes,
      snapshot.trainingContext?.constraintsNotes,
      snapshot.trainingContext?.preferencesNotes,
      snapshot.activeGoal?.notes,
    ].filter((text): text is string => !!text);
    if (texts.some((text) => this.safety.evaluateInput(text).blockProvider))
      throw new InitialProgramBlockedError("safety");
  }

  private async persist(
    request: GenerateInitialProgramRequest,
    plan: InitialProgramPlan,
    provenance: Readonly<{
      origin: InitialProgramOrigin;
      provider: string | null;
      model: string | null;
      promptVersion: string | null;
      repaired: boolean;
      envelopeVersion: string;
    }>,
  ): Promise<GenerateInitialProgramResult> {
    let programId: string;
    try {
      programId = (
        await this.create.execute({
          creationRequestId: request.creationRequestId,
          name: plan.name,
          description: programDescription(plan),
          structure: initialProgramToStructure(plan),
        })
      ).id;
    } catch (error) {
      // The same intent already created a draft (lost response, retry).
      if (
        error instanceof ProgramCreationConflictError &&
        error.existingProgramId
      )
        return {
          status: "created",
          programId: error.existingProgramId,
          origin: provenance.origin,
          reused: true,
          repaired: provenance.repaired,
        };
      throw error;
    }
    await this.log.record({
      programId,
      origin: provenance.origin,
      provider: provenance.provider,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      envelopeVersion: provenance.envelopeVersion,
      specVersion: PERSONAL_SPEC_VERSION,
      repaired: provenance.repaired,
    });
    return {
      status: "created",
      programId,
      origin: provenance.origin,
      reused: false,
      repaired: provenance.repaired,
    };
  }
}

function personalRequest(
  snapshot: AthleteSnapshot,
  intake: ProgramIntake | null,
  envelope: InitialProgramEnvelope,
): InitialProgramRequest {
  const context = snapshot.trainingContext!;
  return {
    facts: {
      ageYears: envelope.ageYears,
      heightCm: snapshot.profile?.heightCm ?? null,
      latestBodyWeightKg: snapshot.latestWeight?.weightKg ?? null,
      goalType: envelope.goalType,
      goalNotes: snapshot.activeGoal?.notes ?? null,
      targetWeightKg: snapshot.activeGoal?.targetWeightKg ?? null,
      resistanceTrainingMonths: context.resistanceTrainingMonths,
      recentTrainingConsistency: context.recentTrainingConsistency,
      experienceLevel: envelope.level,
      routineSummary: context.routineSummary,
      averageSleepMinutes: context.averageSleepMinutes,
      preferredSessionMinutes: context.preferredSessionDurationMinutes,
      trainingEnvironment: context.trainingEnvironment,
      availableWeekdays: envelope.availableWeekdays,
    },
    athleteNotes: {
      constraintsNotes: context.constraintsNotes,
      preferencesNotes: context.preferencesNotes,
      currentPainOrInjury: intake?.currentPainOrInjury ?? false,
      painOrInjuryNotes: intake?.painOrInjuryNotes ?? null,
      preferredExercisesNotes: intake?.preferredExercisesNotes ?? null,
      avoidedExercisesNotes: intake?.avoidedExercisesNotes ?? null,
      otherSportsNotes: intake?.otherSportsNotes ?? null,
    },
    envelope,
  };
}
