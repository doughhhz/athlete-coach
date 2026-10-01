import type { Weekday } from "@athlete-coach/domain";
import { z } from "zod";

const optionalNote = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `Use no máximo ${maximum} caracteres.`)
    .optional()
    .transform((value) => value || undefined);

/** Answers right before the first program (ADR-0119). */
export const programIntakeInputSchema = z
  .object({
    currentPainOrInjury: z.boolean(),
    painOrInjuryNotes: optionalNote(1000),
    medicalExerciseRestriction: z.boolean(),
    preferredExercisesNotes: optionalNote(500),
    avoidedExercisesNotes: optionalNote(500),
    otherSportsNotes: optionalNote(500),
    /** Optional: an empty list means "not informed". */
    availableEquipment: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(30)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.currentPainOrInjury && !value.painOrInjuryNotes)
      context.addIssue({
        code: "custom",
        path: ["painOrInjuryNotes"],
        message: "Descreva a dor ou lesão para o Personal considerar.",
      });
  });
export type ProgramIntakeInput = z.infer<typeof programIntakeInputSchema>;

/** Edge request: only the mode and the stable creation intent. */
export const generateInitialProgramRequestSchema = z
  .object({
    mode: z.enum(["personal", "basic"]),
    creationRequestId: z.uuid(),
  })
  .strict();
export type GenerateInitialProgramRequest = z.infer<
  typeof generateInitialProgramRequestSchema
>;

export const INITIAL_PROGRAM_SCHEMA_VERSION = "initial-program-v1" as const;
const exercisePlanSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int(),
  targetMetric: z.enum(["reps", "seconds"]),
  targetMin: z.number().int(),
  targetMax: z.number().int(),
  rirMin: z.number().int(),
  rirMax: z.number().int(),
  restMinSeconds: z.number().int(),
  restMaxSeconds: z.number().int(),
  rationale: z.string().trim().min(1).max(400),
});
const dayPlanSchema = z.object({
  weekday: z
    .number()
    .int()
    .min(1)
    .max(7)
    .transform((value) => value as Weekday),
  name: z.string().trim().min(1).max(80),
  focus: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(600),
  exercises: z.array(exercisePlanSchema).min(1).max(10),
});
export const initialProgramPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(1200),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(10),
  athleteNotes: z.array(z.string().trim().min(1).max(300)).max(10),
  days: z.array(dayPlanSchema).min(1).max(7),
});
const initialProgramOutputBase = z.object({
  schemaVersion: z.literal(INITIAL_PROGRAM_SCHEMA_VERSION),
  outcome: z.enum(["program", "cannot_build"]),
  program: initialProgramPlanSchema.nullable(),
  cannotBuildReason: z.string().trim().min(1).max(600).nullable(),
});
/** What the Personal returns: a program, or why it cannot build one safely. */
export const initialProgramOutputSchema = initialProgramOutputBase.superRefine(
  (value, context) => {
    if ((value.outcome === "program") !== (value.program !== null))
      context.addIssue({
        code: "custom",
        path: ["program"],
        message: "outcome=program exige program; cannot_build não aceita.",
      });
    if (
      (value.outcome === "cannot_build") !==
      (value.cannotBuildReason !== null)
    )
      context.addIssue({
        code: "custom",
        path: ["cannotBuildReason"],
        message: "cannot_build exige o motivo.",
      });
  },
);
export type InitialProgramOutput = z.infer<typeof initialProgramOutputSchema>;
/** JSON Schema for structured output (consistency is checked by Zod). */
// Input side: the weekday cast to the domain type is not part of the wire shape.
export const initialProgramOutputJsonSchema = z.toJSONSchema(
  initialProgramOutputBase,
  { io: "input" },
);
