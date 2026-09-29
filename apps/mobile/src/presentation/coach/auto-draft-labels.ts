import type {
  CoachAutoDraftReason,
  CoachDraftAuthorityMode,
  CoachMaterializationOrigin,
} from "@athlete-coach/domain";

/**
 * Conservative Auto-Draft copy (Implementation Phase 16, ADR-0082/0086).
 * A policy-authorized draft is never presented as an approval.
 */
export const draftAuthorityCopy: Record<
  CoachDraftAuthorityMode,
  Readonly<{ title: string; description: string }>
> = {
  manual_draft: {
    title: "Desligada",
    description:
      "Você cria o rascunho a partir de uma proposta revisada, quando quiser.",
  },
  standard_auto_draft: {
    title: "Conservadora",
    description:
      "O Personal poderá criar automaticamente um rascunho somente para um conjunto restrito de ajustes. Seu programa ativo não será alterado ou ativado automaticamente.",
  },
};
export const AUTO_DRAFT_CONSENT = [
  "Quando uma proposta cumprir regras conservadoras, o Personal poderá criar uma nova revisão em rascunho automaticamente.",
  "Seu programa ativo nunca será alterado ou ativado automaticamente.",
  "Você continuará responsável por revisar e ativar a revisão.",
] as const;
export const AUTO_DRAFT_PROACTIVE_ONLY =
  "Só tem efeito quando o modo do Personal é Proativo.";

export const autoDraftStatusMessages = {
  not_applicable: null,
  not_enabled: null,
  materialized: "Uma revisão em rascunho foi preparada.",
  existing_draft:
    "Já existe um rascunho para este programa; nada foi substituído. A proposta continua disponível para revisão.",
  stale:
    "O programa mudou desde a análise; nenhum rascunho foi criado automaticamente.",
  ineligible: "Esta proposta precisa da sua revisão antes de virar rascunho.",
  blocked: "Por segurança, nenhum rascunho foi criado automaticamente.",
  failed:
    "Não foi possível preparar o rascunho automaticamente. A proposta continua disponível para revisão.",
} as const;
export type AutoDraftStatusLabel = keyof typeof autoDraftStatusMessages;

export const autoDraftReasonLabels: Partial<
  Record<CoachAutoDraftReason, string>
> = {
  planned_rir_increase: "Aumento do RIR planejado",
  planned_rest_increase: "Aumento do descanso planejado",
  absolute_load_decrease: "Redução da carga absoluta planejada",
};

export const materializationOriginLabels: Record<
  CoachMaterializationOrigin,
  string
> = {
  human: "Rascunho criado por você",
  auto_draft: "Rascunho preparado automaticamente pelo Personal",
};
