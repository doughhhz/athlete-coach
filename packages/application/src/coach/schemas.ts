import {
  COACH_ANALYSIS_SCHEMA_VERSION,
  athleteTrainingDossierSchemaVersions,
  coachAnalysisModes,
  coachConfidenceLevels,
  coachRecommendationCategories,
  coachSafetyFlagKinds,
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
const grounded = z.object({
  id: z.string().min(1).max(100),
  statement: z.string().trim().min(1).max(1200),
  evidence: z.array(evidence).max(12),
  confidence: z.enum(coachConfidenceLevels),
  limitations: z.array(z.string().trim().min(1).max(500)).max(8),
});
export const coachAnalysisSchema = z.object({
  schemaVersion: z.literal(COACH_ANALYSIS_SCHEMA_VERSION),
  analysisId: z.string().min(1).max(100),
  requestId: z.string().min(1).max(100),
  createdAt: z.iso.datetime({ offset: true }),
  summary: z.string().trim().min(1).max(2000),
  observations: z.array(grounded).max(12),
  hypotheses: z
    .array(
      grounded.extend({
        competingExplanations: z
          .array(z.string().trim().min(1).max(500))
          .max(8),
      }),
    )
    .max(8),
  recommendations: z
    .array(
      grounded.extend({
        category: z.enum(coachRecommendationCategories),
        rationale: z.string().trim().min(1).max(1200),
        requiresHumanReview: z.literal(true),
      }),
    )
    .max(10),
  questions: z.array(z.string().trim().min(1).max(500)).max(8),
  uncertainties: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        statement: z.string().trim().min(1).max(800),
        relatedEvidence: z.array(evidence).max(12),
      }),
    )
    .max(10),
  evidenceUsed: z.array(evidence).max(30),
  safetyFlags: z
    .array(
      z.object({
        kind: z.enum(coachSafetyFlagKinds),
        message: z.string().trim().min(1).max(800),
        blocksTrainingAdvice: z.boolean(),
      }),
    )
    .max(10),
  metadata: z.object({
    dossierSchemaVersion: z.enum(athleteTrainingDossierSchemaVersions),
    promptVersion: z.string().min(1).max(100),
    policyVersion: z.string().min(1).max(100),
    provider: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
  }),
});

/**
 * coach-analyze request. Strict: the client cannot send athlete identity,
 * analyses, safety state, origin or review class; `analysisRequestId` is
 * only an idempotency key (ADR-0078).
 */
export const coachAnalyzeRequestSchema = z
  .object({
    userRequest: z.string().max(2000),
    analysisMode: z.enum(coachAnalysisModes),
    conversationContext: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(2000),
          })
          .strict(),
      )
      .max(6)
      .optional(),
    analysisRequestId: z.uuid().optional(),
  })
  .strict();
