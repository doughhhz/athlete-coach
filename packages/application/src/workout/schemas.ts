import { z } from "zod";
export const recordWorkoutSetInputSchema = z.object({
  actualValue: z.number().positive(),
  actualLoadKg: z.number().nonnegative().nullable(),
  actualRir: z.number().int().min(0).max(10).nullable(),
  restStartedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  restEndedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type RecordWorkoutSetInput = z.infer<typeof recordWorkoutSetInputSchema>;
