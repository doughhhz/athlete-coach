import {
  goalTypes,
  trainingConsistencies,
  trainingEnvironments,
} from "@athlete-coach/domain";
import { z } from "zod";

const optionalNote = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `Use no máximo ${maximum} caracteres.`)
    .optional()
    .transform((value) => value || undefined);

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined)
    return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const authCredentialsSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().max(254),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(128),
});

export const profileInputSchema = z.object({
  preferredName: z
    .string()
    .trim()
    .min(1, "Informe como prefere ser chamado.")
    .max(80),
  birthDate: calendarDate
    .refine(isRealDate, "Informe uma data real.")
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      "A data de nascimento não pode estar no futuro.",
    ),
  heightCm: z
    .number()
    .min(50, "Confira a altura informada.")
    .max(250, "Confira a altura informada."),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isIanaTimezone, "Informe um timezone IANA válido."),
});

export const goalInputSchema = z.object({
  goalType: z.enum(goalTypes),
  targetWeightKg: z
    .number()
    .min(20, "Confira o peso informado.")
    .max(500, "Confira o peso informado.")
    .optional(),
  goalNotes: optionalNote(1000),
});

export const trainingContextInputSchema = z.object({
  resistanceTrainingMonths: z.number().int().min(0).max(1200),
  recentTrainingConsistency: z.enum(trainingConsistencies),
  preferredSessionDurationMinutes: z.number().int().min(10).max(300),
  trainingEnvironment: z.enum(trainingEnvironments),
  routineSummary: z.string().trim().max(500),
  constraintsNotes: optionalNote(1000),
  preferencesNotes: optionalNote(1000),
  averageSleepMinutes: z.number().int().min(0).max(1440).optional(),
});

export const availabilityInputSchema = z.object({
  availableWeekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Selecione ao menos um dia.")
    .max(7)
    .refine(
      (days) => new Set(days).size === days.length,
      "Não repita dias da semana.",
    ),
});

export const bodyWeightInputSchema = z.object({
  measuredAt: z.iso.datetime({ offset: true }),
  weightKg: z
    .number()
    .min(20, "Confira o peso informado.")
    .max(500, "Confira o peso informado."),
});

export function createCompleteOnboardingSchema(today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  return profileInputSchema
    .extend({
      birthDate: calendarDate
        .refine(isRealDate, "Informe uma data real.")
        .refine(
          (value) => value <= todayIso,
          "A data de nascimento não pode estar no futuro.",
        ),
    })
    .and(goalInputSchema)
    .and(trainingContextInputSchema)
    .and(availabilityInputSchema)
    .and(bodyWeightInputSchema);
}

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type GoalInput = z.infer<typeof goalInputSchema>;
export type TrainingContextInput = z.infer<typeof trainingContextInputSchema>;
export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;
export type BodyWeightInput = z.infer<typeof bodyWeightInputSchema>;
export type CompleteOnboardingInput = z.infer<
  ReturnType<typeof createCompleteOnboardingSchema>
>;
