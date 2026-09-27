import type {
  AthleteTrainingDossier,
  EvidenceReference,
} from "../dossier/dossier.ts";

export const COACH_ANALYSIS_SCHEMA_VERSION = "coach-analysis-v1" as const;
export const coachConfidenceLevels = ["low", "medium", "high"] as const;
export const coachRecommendationCategories = [
  "maintain",
  "monitor",
  "training_adjustment",
  "exercise_consideration",
  "recovery_consideration",
  "ask_for_more_data",
] as const;
export const coachAnalysisModes = [
  "general_review",
  "workout_review",
  "exercise_review",
  "question",
] as const;
export const coachSafetyFlagKinds = [
  "acute_pain",
  "possible_injury",
  "severe_symptoms",
  "medical_diagnosis",
  "medication",
  "eating_disorder",
  "extreme_weight_practice",
  "emergency",
] as const;

export type CoachConfidence = (typeof coachConfidenceLevels)[number];
export type CoachAnalysisMode = (typeof coachAnalysisModes)[number];
export type CoachRecommendationCategory =
  (typeof coachRecommendationCategories)[number];
export type CoachSafetyFlagKind = (typeof coachSafetyFlagKinds)[number];
export type CoachConversationMessage = Readonly<{
  role: "user" | "assistant";
  content: string;
}>;
export type CoachAnalysisRequest = Readonly<{
  schemaVersion: "coach-request-v1";
  dossier: AthleteTrainingDossier;
  userRequest: string;
  analysisMode: CoachAnalysisMode;
  conversationContext: readonly CoachConversationMessage[];
}>;
type GroundedCoachItem = Readonly<{
  id: string;
  statement: string;
  evidence: readonly EvidenceReference[];
  confidence: CoachConfidence;
  limitations: readonly string[];
}>;
export type CoachObservation = GroundedCoachItem;
export type CoachHypothesis = GroundedCoachItem &
  Readonly<{ competingExplanations: readonly string[] }>;
export type CoachRecommendation = GroundedCoachItem &
  Readonly<{
    category: CoachRecommendationCategory;
    rationale: string;
    requiresHumanReview: true;
  }>;
export type CoachUncertainty = Readonly<{
  id: string;
  statement: string;
  relatedEvidence: readonly EvidenceReference[];
}>;
export type CoachSafetyFlag = Readonly<{
  kind: CoachSafetyFlagKind;
  message: string;
  blocksTrainingAdvice: boolean;
}>;
export type CoachAnalysis = Readonly<{
  schemaVersion: typeof COACH_ANALYSIS_SCHEMA_VERSION;
  analysisId: string;
  requestId: string;
  createdAt: string;
  summary: string;
  observations: readonly CoachObservation[];
  hypotheses: readonly CoachHypothesis[];
  recommendations: readonly CoachRecommendation[];
  questions: readonly string[];
  uncertainties: readonly CoachUncertainty[];
  evidenceUsed: readonly EvidenceReference[];
  safetyFlags: readonly CoachSafetyFlag[];
  metadata: Readonly<{
    dossierSchemaVersion: AthleteTrainingDossier["schemaVersion"];
    promptVersion: string;
    policyVersion: string;
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
  }>;
}>;

export function collectDossierEvidenceIds(
  dossier: AthleteTrainingDossier,
): ReadonlySet<string> {
  const refs = [
    ...dossier.evidence,
    ...dossier.last28DaysExerciseExposure.flatMap((item) => item.evidence),
    ...dossier.personalBests.flatMap((item) => item.evidence),
    ...dossier.recentSessions.items.flatMap((session) => session.evidence),
  ];
  return new Set(refs.map((reference) => `${reference.kind}:${reference.id}`));
}
