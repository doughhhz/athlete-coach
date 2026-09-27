import {
  COACH_PROPOSAL_SCHEMA_VERSION,
  coachRejectionReasons,
  targetMetrics,
} from "@athlete-coach/domain";
import { z } from "zod";
const evidence = z.object({
  kind: z.enum([
    "workout_session",
    "workout_set",
    "training_program",
    "exercise",
    "body_weight_entry",
    "derived_calculation",
  ]),
  id: z.string().min(1).max(200),
  version: z.string().max(100).nullable(),
});
const base = {
  rationale: z.string().trim().min(1).max(1200),
  evidence: z.array(evidence).min(1).max(12),
};
const ids = {
  trainingDayId: z.uuid(),
  exercisePrescriptionId: z.uuid(),
  prescriptionSetId: z.uuid(),
};
export const coachProposalActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("adjust_prescription_target"),
    ...base,
    ...ids,
    targetMetric: z.enum(targetMetrics),
    targetMin: z.number().positive(),
    targetMax: z.number().positive(),
  }),
  z.object({
    kind: z.literal("adjust_prescription_rir"),
    ...base,
    ...ids,
    rirMin: z.number().int().min(0).max(10).nullable(),
    rirMax: z.number().int().min(0).max(10).nullable(),
  }),
  z.object({
    kind: z.literal("adjust_prescription_rest"),
    ...base,
    ...ids,
    restMinSeconds: z.number().int().nonnegative().nullable(),
    restMaxSeconds: z.number().int().nonnegative().nullable(),
  }),
  z.object({
    kind: z.literal("adjust_absolute_load_target"),
    ...base,
    ...ids,
    loadKg: z.number().positive(),
  }),
]);
export const coachProposalSchema = z.object({
  schemaVersion: z.literal(COACH_PROPOSAL_SCHEMA_VERSION),
  id: z.uuid(),
  analysisId: z.string().min(1).max(100),
  sourceProgramId: z.uuid(),
  sourceProgramRevision: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(2000),
  evidenceReferences: z.array(evidence).min(1).max(30),
  actions: z.array(coachProposalActionSchema).min(1).max(12),
  limitations: z.array(z.string().trim().min(1).max(500)).max(8),
  requiresHumanApproval: z.literal(true),
  analysisSnapshot: z.object({
    summary: z.string().trim().min(1).max(2000),
    provider: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    promptVersion: z.string().min(1).max(100),
    policyVersion: z.string().min(1).max(100),
    dossierSchemaVersion: z.string().min(1).max(100),
  }),
});
export const rejectCoachProposalSchema = z.object({
  reason: z.enum(coachRejectionReasons),
  notes: z.string().trim().min(1).max(500).nullable().optional(),
});
