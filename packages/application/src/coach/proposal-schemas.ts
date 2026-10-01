import {
  COACH_PROPOSAL_SCHEMA_VERSION,
  COACH_PROPOSAL_V1_SCHEMA_VERSION,
  COACH_PROPOSAL_V2_SCHEMA_VERSION,
  coachRejectionReasons,
  exerciseRelationTypes,
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
    "coach_draft_review",
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
const setCountActionSchemas = [
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
] as const;
/** v2 = v1 + explicit set-count actions (no generic patch). */
export const coachProposalV2ActionSchema = z.discriminatedUnion("kind", [
  ...adjustActionSchemas,
  ...setCountActionSchemas,
]);
const relationContextSchema = z.object({
  relationType: z.enum(exerciseRelationTypes),
  direction: z.enum(["candidate_to_source", "source_to_candidate"]),
});
const loadTransitionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preserve_non_absolute") }),
  z.object({ mode: z.literal("athlete_selected") }),
  z.object({
    mode: z.literal("explicit_absolute"),
    loadKg: z.number().positive().max(1000),
  }),
]);
/** v3 = v2 + replace_exercise with explicit load transition (ADR-0068). */
export const coachProposalActionSchema = z.discriminatedUnion("kind", [
  ...adjustActionSchemas,
  ...setCountActionSchemas,
  z.object({
    kind: z.literal("replace_exercise"),
    ...base,
    trainingDayId: z.uuid(),
    exercisePrescriptionId: z.uuid(),
    sourceExerciseId: z.uuid(),
    replacementExerciseId: z.uuid(),
    relationshipContext: z.array(relationContextSchema).min(1).max(12),
    loadTransition: loadTransitionSchema,
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
  schemaVersion: z.literal(COACH_PROPOSAL_V2_SCHEMA_VERSION),
  ...proposalFields,
  actions: z.array(coachProposalV2ActionSchema).min(1).max(12),
});
export const coachProposalV3Schema = z.object({
  schemaVersion: z.literal(COACH_PROPOSAL_SCHEMA_VERSION),
  ...proposalFields,
  actions: z.array(coachProposalActionSchema).min(1).max(12),
});
/**
 * Version-dispatched: each snapshot is parsed only with the action
 * vocabulary of its own version (v1 and v2 never with v3).
 */
export const coachProposalSchema = z.discriminatedUnion("schemaVersion", [
  coachProposalV1Schema,
  coachProposalV2Schema,
  coachProposalV3Schema,
]);
/**
 * JSON Schema (provider-neutral) of what the proposal MODEL must return: the
 * envelope {"proposal": coach-proposal-v3 | null}. Only v3 is requested (the
 * prompt asks for v3; v1/v2 stay parseable for stored history). Generated
 * from the same Zod schema that validates the output (ADR-0114).
 */
export const coachProposalModelOutputJsonSchema: Readonly<
  Record<string, unknown>
> = z.toJSONSchema(
  z.object({ proposal: coachProposalV3Schema.nullable() }),
) as Record<string, unknown>;
export const rejectCoachProposalSchema = z.object({
  reason: z.enum(coachRejectionReasons),
  notes: z.string().trim().min(1).max(500).nullable().optional(),
});
