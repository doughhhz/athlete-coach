import type {
  DraftReviewChangeCategory,
  DraftReviewStatus,
  DraftReviewValue,
} from "@athlete-coach/domain";

/**
 * Implementation Phase 17 (ADR-0087..0090): factual review states. No
 * acceptance, success, correctness or trust wording.
 */
export const draftReviewStatusLabels: Record<DraftReviewStatus, string> = {
  awaiting_review: "Aguardando revisão",
  activated_unchanged: "Ativado sem alterações",
  activated_with_edits: "Ativado após alterações",
  archived_without_activation: "Arquivado sem ativação",
  limited_data: "Dados insuficientes para comparar",
};

export const draftReviewCategoryLabels: Record<
  DraftReviewChangeCategory,
  string
> = {
  exercise_changed: "Exercício",
  set_added: "Série adicionada",
  set_removed: "Série removida",
  target_changed: "Faixa de execução",
  rir_changed: "RIR",
  rest_changed: "Descanso",
  load_changed: "Carga",
  tempo_changed: "Tempo",
  sequence_changed: "Ordem",
  prescription_added: "Exercício adicionado",
  prescription_removed: "Exercício removido",
  program_structure_changed: "Estrutura do programa",
};

export const REVIEW_CHANGED_LABEL = "Alterado durante a revisão";
export const REVIEW_OVERSIGHT_NOTE =
  "Isso descreve o que aconteceu durante a revisão, não se a proposta estava certa. O efeito no treino só é observado depois da ativação.";
export const REVIEW_EDITOR_NOTE =
  "A comparação mostra diferenças no rascunho revisado; não identifica quem fez cada alteração.";

export function formatReviewValue(value: DraftReviewValue | null): string {
  if (!value) return "indisponível";
  switch (value.dimension) {
    case "target":
      return `${value.min}–${value.max} ${value.metric}`;
    case "planned_rir":
      return `RIR ${value.min ?? "sem alvo"}–${value.max ?? "sem alvo"}`;
    case "planned_rest":
      return `${value.minSeconds ?? "sem alvo"}–${value.maxSeconds ?? "sem alvo"} s`;
    case "absolute_load":
      return value.loadKind === "absolute"
        ? `${value.loadKg} kg`
        : "sem carga absoluta";
    case "set_count":
      return `${value.count} série(s)`;
    case "exercise_replacement":
      return value.exerciseName ?? value.exerciseId;
    case "exercise":
      return value.exerciseId;
  }
}
