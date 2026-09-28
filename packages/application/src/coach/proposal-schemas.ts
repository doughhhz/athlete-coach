import {
  COACH_PROPOSAL_SCHEMA_VERSION,
  COACH_PROPOSAL_V1_SCHEMA_VERSION,
  coachRejectionReasons,
  loadPrescriptionKinds,
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
    "coach_decision",
    "response_memory_group",
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
const adjustActionSchemas = [
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
] as const;
/** v1 actions only; used for historical snapshots. */
export const coachProposalV1ActionSchema = z.discriminatedUnion(
  "kind",
  adjustActionSchemas,
);
const plannedSetSchema = z.object({
  targetMetric: z.enum(targetMetrics),
  targetMin: z.number().positive(),
  targetMax: z.number().positive(),
  rirMin: z.number().int().min(0).max(10).nullable(),
  rirMax: z.number().int().min(0).max(10).nullable(),
  restMinSeconds: z.number().int().nonnegative().nullable(),
  restMaxSeconds: z.number().int().nonnegative().nullable(),
  tempo: z
    .string()
    .regex(/^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/)
    .nullable(),
  loadKind: z.enum(loadPrescriptionKinds),
  loadKg: z.number().positive().nullable(),
});
/** v2 = v1 + explicit set-count actions (no generic patch). */
export const coachProposalActionSchema = z.discriminatedUnion("kind", [
  ...adjustActionSchemas,
  z.object({
    kind: z.literal("add_prescription_set"),
    ...base,
    trainingDayId: z.uuid(),
    exercisePrescriptionId: z.uuid(),
    position: z.literal("end"),
    copyFromPrescriptionSetId: z.uuid().nullable(),
    plannedSet: plannedSetSchema,
  }),
  z.object({
    kind: z.literal("remove_prescription_set"),
    ...base,
    ...ids,
  }),
]);
const proposalFields = {
  id: z.uuid(),
  analysisId: z.string().min(1).max(100),
  sourceProgramId: z.uuid(),
  sourceProgramRevision: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(2000),
  evidenceReferences: z.array(evidence).min(1).max(30),
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
};
export const coachProposalV1Schema = z.object({
  schemaVersion: z.literal(COACH_PROPOSAL_V1_SCHEMA_VERSION),
  ...proposalFields,
  actions: z.array(coachProposalV1ActionSchema).min(1).max(12),
});
export const coachProposalV2Schema = z.object({
  schemaVersion: z.literal(COACH_PROPOSAL_SCHEMA_VERSION),
  ...proposalFields,
  actions: z.array(coachProposalActionSchema).min(1).max(12),
});
/** Version-dispatched: v1 snapshots are never parsed with v2 actions. */
export const coachProposalSchema = z.discriminatedUnion("schemaVersion", [
  coachProposalV1Schema,
  coachProposalV2Schema,
]);
export const rejectCoachProposalSchema = z.object({
  reason: z.enum(coachRejectionReasons),
  notes: z.string().trim().min(1).max(500).nullable().optional(),
});
