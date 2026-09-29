import { loadPrescriptionKinds, targetMetrics } from "@athlete-coach/domain";
import { z } from "zod";

const optionalText = z.string().trim().max(1000).optional();
/**
 * Existing structural node lineage (Implementation Phase 18). Optional: new
 * nodes omit it. The server accepts only lineage already present at the same
 * level of the same draft.
 */
const lineageId = z.uuid().optional();
export const prescriptionSetInputSchema = z
  .object({
    lineageId,
    sequence: z.number().int().positive(),
    targetMetric: z.enum(targetMetrics),
    targetMin: z.number().positive(),
    targetMax: z.number().positive(),
    rirMin: z.number().int().min(0).max(10).nullable(),
    rirMax: z.number().int().min(0).max(10).nullable(),
    restMinSeconds: z.number().int().nonnegative().nullable(),
    restMaxSeconds: z.number().int().nonnegative().nullable(),
    tempo: z
      .string()
      .regex(/^([0-9X])-([0-9X])-([0-9X])-([0-9X])$/)
      .nullable(),
    loadKind: z.enum(loadPrescriptionKinds),
    loadKg: z.number().positive().nullable(),
  })
  .superRefine((value, context) => {
    if (value.targetMax < value.targetMin)
      context.addIssue({
        code: "custom",
        message: "O máximo deve ser maior ou igual ao mínimo.",
      });
    if (
      (value.rirMin === null) !== (value.rirMax === null) ||
      (value.rirMin !== null && value.rirMax! < value.rirMin)
    )
      context.addIssue({ code: "custom", message: "Faixa de RIR inválida." });
    if (
      (value.restMinSeconds === null) !== (value.restMaxSeconds === null) ||
      (value.restMinSeconds !== null &&
        value.restMaxSeconds! < value.restMinSeconds)
    )
      context.addIssue({
        code: "custom",
        message: "Faixa de descanso inválida.",
      });
    if ((value.loadKind === "absolute") !== (value.loadKg !== null))
      context.addIssue({
        code: "custom",
        message: "Carga absoluta exige kg; outros tipos não aceitam carga.",
      });
  });
export const programStructureInputSchema = z.object({
  blocks: z
    .array(
      z.object({
        lineageId,
        sequence: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
        description: optionalText,
        weeks: z
          .array(
            z.object({
              lineageId,
              sequence: z.number().int().positive(),
              name: z.string().trim().max(120).optional(),
              notes: optionalText,
              days: z
                .array(
                  z.object({
                    lineageId,
                    sequence: z.number().int().positive(),
                    name: z.string().trim().min(1).max(120),
                    preferredWeekday: z.number().int().min(1).max(7).optional(),
                    notes: optionalText,
                    prescriptions: z
                      .array(
                        z.object({
                          lineageId,
                          sequence: z.number().int().positive(),
                          exerciseId: z.uuid(),
                          instructions: optionalText,
                          athleteCues: optionalText,
                          sets: z.array(prescriptionSetInputSchema).min(1),
                        }),
                      )
                      .min(1),
                  }),
                )
                .min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export const createProgramDraftInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText,
  athleteGoalId: z.uuid().optional(),
});
export type CreateProgramDraftInput = z.infer<
  typeof createProgramDraftInputSchema
>;
export type ProgramStructureInput = z.infer<typeof programStructureInputSchema>;
/**
 * New program creation as ONE intent (corrective pass after Implementation
 * Phase 19, ADR-0100..0102): metadata + complete tree + a stable
 * `creationRequestId` reused on every retry. A new root has no structural
 * continuity, so lineage is never accepted here (the server assigns it).
 */
export const createProgramWithStructureInputSchema =
  createProgramDraftInputSchema
    .extend({
      creationRequestId: z.uuid(),
      structure: programStructureInputSchema,
    })
    .superRefine((value, context) => {
      if (JSON.stringify(value.structure).includes('"lineageId"'))
        context.addIssue({
          code: "custom",
          path: ["structure"],
          message: "Um programa novo não aceita linhagem de outro programa.",
        });
    });
export type CreateProgramWithStructureInput = z.infer<
  typeof createProgramWithStructureInputSchema
>;
