import {
  assessCoachProposalGovernance,
  type CoachAutonomyMode,
  type CoachDecision,
  type CoachProposalOrigin,
  type PersistedReviewClass,
  type TrainingProgram,
} from "@athlete-coach/domain";

/**
 * Operational governance copy (ADR-0074/0075). Review classes are never
 * presented as physiological or medical risk.
 */
export const autonomyModeCopy: Record<
  CoachAutonomyMode,
  Readonly<{ title: string; description: string }>
> = {
  manual: {
    title: "Manual",
    description:
      "O Personal analisa seus dados, mas só prepara uma proposta quando você pedir.",
  },
  proactive: {
    title: "Proativo",
    description:
      "Após uma análise, o Personal pode preparar uma proposta automaticamente. Nenhuma alteração será aplicada ao programa sem sua revisão.",
  },
};
export const PROACTIVE_CONSENT_TEXT =
  "Após uma análise, o Personal poderá preparar propostas de ajuste automaticamente. Nenhuma alteração será aplicada ao seu treino sem sua revisão.";
export const PROACTIVE_COST_NOTICE =
  "Esse modo pode realizar uma chamada adicional ao serviço de IA.";

export const proposalOriginLabels: Record<CoachProposalOrigin, string> = {
  manual: "Solicitada por você",
  proactive: "Preparada pelo Personal",
};
export const reviewClassLabels: Record<PersistedReviewClass, string> = {
  standard_review: "Revisão padrão",
  elevated_review: "Revisão reforçada",
};
export const ELEVATED_REVIEW_NOTICE =
  "Esta proposta altera uma parte mais estrutural/intensa da prescrição. Revise os detalhes antes de criar a revisão.";
export const ELEVATED_REVIEW_CONFIRMATION = "Revisei as alterações propostas";

export const proactiveStatusMessages = {
  not_enabled: null,
  prepared: "O Personal preparou uma proposta para sua revisão.",
  no_change: "O Personal não identificou um ajuste para propor agora.",
  blocked: "Por segurança, nenhuma proposta de treino foi preparada.",
  unavailable:
    "Não foi possível preparar a proposta agora. Você ainda pode pedir manualmente.",
  invalid:
    "A proposta preparada não passou na validação e foi descartada. Nada foi alterado.",
} as const;
export type ProactiveStatus = keyof typeof proactiveStatusMessages;

/**
 * Review class shown to the athlete: the persisted backend classification;
 * for legacy decisions the same deterministic domain policy is used for
 * display only (the backend recomputes before any materialization).
 */
export function displayReviewClass(
  decision: CoachDecision,
  sourceProgram: TrainingProgram | null,
): PersistedReviewClass {
  if (decision.governance) return decision.governance.reviewClass;
  const assessment = assessCoachProposalGovernance({
    proposal: decision.proposal,
    sourceProgram:
      sourceProgram?.id === decision.proposal.sourceProgramId &&
      sourceProgram.revision === decision.proposal.sourceProgramRevision
        ? sourceProgram
        : null,
    origin: decision.proposalOrigin,
    safetyBlocksTrainingAdvice: false,
    proposalValid: true,
  });
  return assessment.reviewClass === "standard_review"
    ? "standard_review"
    : "elevated_review";
}
