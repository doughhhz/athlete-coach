import type {
  ChangeDirection,
  ComparabilityReason,
  DeltaSignPattern,
  InterventionDimension,
  OutcomeLimitationCode,
  OutcomeMetric,
  OutcomeStatus,
  PrescriptionDimensionValue,
} from "@athlete-coach/domain";

// Presentation wording only. No judgement or effectiveness words:
// these are factual before/after comparisons, not causal conclusions.
export const outcomeStatusLabels: Readonly<Record<OutcomeStatus, string>> = {
  not_materialized: "Sem revisão criada",
  awaiting_activation: "Aguardando ativação",
  never_activated: "Não ativada — não houve intervenção",
  awaiting_post_exposure: "Coletando dados após a alteração",
  limited_data: "Poucos dados após a alteração",
  evaluable: "Comparação antes/depois disponível",
};

export const dimensionLabels: Readonly<Record<InterventionDimension, string>> =
  {
    target: "Faixa de execução",
    planned_rir: "RIR planejado",
    planned_rest: "Descanso planejado",
    absolute_load: "Carga absoluta planejada",
    set_count: "Quantidade de séries planejadas",
    exercise_replacement: "Troca de exercício",
  };

export const metricLabels: Readonly<Record<OutcomeMetric, string>> = {
  planned_sets_per_exposure: "Séries planejadas por sessão",
  completed_sets_per_exposure: "Séries concluídas por sessão",
  actual_reps_per_exposure: "Reps registradas por sessão",
  mean_actual_reps_per_set: "Reps registradas por série (média)",
  mean_actual_seconds_per_set: "Segundos registrados por série (média)",
  mean_actual_meters_per_set: "Metros registrados por série (média)",
  best_logged_load_kg: "Maior carga registrada",
  best_estimated_one_rep_max_kg: "Melhor 1RM estimado (Epley v1)",
  target_within_range_rate: "Séries dentro da faixa planejada",
  load_coverage_rate: "Séries com carga registrada",
  rir_coverage_rate: "Séries com RIR registrado",
  rir_within_planned_rate: "RIR registrado dentro do planejado",
  mean_actual_rir: "RIR registrado (média)",
  rest_coverage_rate: "Séries com descanso medido",
  rest_within_planned_rate: "Descanso medido dentro do planejado",
  mean_measured_rest_seconds: "Descanso medido (média)",
};

export const limitationLabels: Readonly<Record<OutcomeLimitationCode, string>> =
  {
    multiple_variables_changed_concurrently:
      "Mais de uma variável mudou ao mesmo tempo",
    multiple_exercises_changed_concurrently:
      "Mais de um exercício mudou ao mesmo tempo",
    proposed_action_not_present_at_activation:
      "A alteração proposta não estava na versão ativada",
    proposed_value_differs_at_activation:
      "O valor ativado difere do valor proposto",
    exercise_identity_changed: "O exercício foi trocado antes da ativação",
    unproposed_changes_in_affected_prescription:
      "A prescrição recebeu outras edições manuais",
    program_revision_changed_other_prescriptions:
      "A revisão também alterou outras prescrições",
    no_baseline_exposures: "Sem sessões anteriores deste exercício",
    fewer_baseline_exposures_than_window: "Poucas sessões antes da alteração",
    no_post_exposures: "Ainda sem sessões após a alteração",
    fewer_post_exposures_than_window: "Poucos dados após a alteração",
    unequal_exposure_counts: "Quantidade de sessões diferente antes e depois",
    post_window_open: "Ainda coletando sessões após a alteração",
    intervention_program_ended_before_window_filled:
      "O programa foi substituído ou encerrado antes de completar a janela",
    baseline_includes_other_programs:
      "O período anterior inclui sessões de outros programas",
    baseline_includes_prior_intervention:
      "O período anterior inclui outra alteração acompanhada",
    rir_observations_missing: "RIR não registrado",
    rir_observations_partial: "RIR registrado só em parte das séries",
    rest_observations_missing: "Descanso não medido",
    rest_observations_partial: "Descanso medido só em parte das séries",
    load_observations_missing: "Carga não registrada",
    set_structure_changed_without_count_change:
      "Séries trocadas sem mudar a quantidade planejada",
    replacement_relation_missing:
      "Não há relação registrada entre o exercício anterior e o ativado",
    body_weight_unavailable: "Peso corporal indisponível no período",
    body_weight_changed: "O peso corporal registrado mudou no período",
  };

function range(min: number | null, max: number | null, unit: string): string {
  if (min === null || max === null) return "sem alvo";
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

export function formatPrescriptionValue(
  value: PrescriptionDimensionValue | null,
): string {
  if (!value) return "indisponível";
  if (value.dimension === "target")
    return range(value.min, value.max, ` ${value.metric}`);
  if (value.dimension === "planned_rir")
    return `RIR ${range(value.min, value.max, "")}`;
  if (value.dimension === "planned_rest")
    return range(value.minSeconds, value.maxSeconds, " s");
  if (value.dimension === "exercise_replacement")
    return value.exerciseName ?? "exercício selecionado";
  if (value.dimension === "set_count")
    return `${value.count} ${value.count === 1 ? "série" : "séries"}`;
  return value.loadKind === "absolute" && value.loadKg !== null
    ? `${value.loadKg} kg`
    : "sem carga absoluta";
}

export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "ratio") return `${Math.round(value * 100)}%`;
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit === "kg" || unit === "seconds"
    ? `${rounded} ${unit === "kg" ? "kg" : "s"}`
    : rounded;
}

export function formatDelta(value: number | null, unit: string): string {
  if (value === null) return "não calculável";
  const sign = value > 0 ? "+" : "";
  if (unit === "ratio") return `${sign}${Math.round(value * 100)} p.p.`;
  return `${sign}${formatMetricValue(value, unit)}`;
}

// Response Memory: observations only. "Positiva" is arithmetic (depois − antes > 0).
export const changeDirectionLabels: Readonly<Record<ChangeDirection, string>> =
  {
    increase: "aumento",
    decrease: "redução",
    unchanged: "sem mudança",
    mixed: "faixa alterada nos dois sentidos",
    not_comparable: "não comparável",
    replaced: "troca de exercício",
  };

export const signPatternLabels: Readonly<Record<DeltaSignPattern, string>> = {
  no_observations: "sem variação observada",
  single_observation: "uma única observação",
  all_positive: "todas as variações positivas",
  all_negative: "todas as variações negativas",
  all_zero: "todas as variações iguais a zero",
  zero_and_one_sign: "variações zero e de um único sinal",
  opposite_signs: "variações em direções diferentes",
};

export function comparabilityReasonLabel(reason: ComparabilityReason): string {
  if (reason === "activated_change_not_identifiable")
    return "Alteração ativada não identificável";
  if (reason === "no_relevant_comparison")
    return "Sem comparação antes/depois para esta dimensão";
  return limitationLabels[reason];
}

/** Factual one-line description of a planned set (targets as planned). */
export function formatPlannedSet(
  set: Readonly<{
    targetMetric: string;
    targetMin: number;
    targetMax: number;
    rirMin: number | null;
    rirMax: number | null;
    restMinSeconds: number | null;
    restMaxSeconds: number | null;
    tempo: string | null;
    loadKind: string;
    loadKg: number | null;
  }>,
): string {
  return [
    range(set.targetMin, set.targetMax, ` ${set.targetMetric}`),
    set.rirMin === null
      ? "sem RIR planejado"
      : `RIR ${range(set.rirMin, set.rirMax, "")}`,
    set.restMinSeconds === null
      ? "sem descanso planejado"
      : `${range(set.restMinSeconds, set.restMaxSeconds, " s")} de descanso`,
    set.tempo ? `tempo ${set.tempo}` : null,
    set.loadKind === "absolute" && set.loadKg !== null
      ? `${set.loadKg} kg`
      : set.loadKind === "athlete_selected"
        ? "carga escolhida pelo atleta"
        : "carga não prescrita",
  ]
    .filter((item): item is string => item !== null)
    .join(" · ");
}

const relationTypeLabels: Readonly<Record<string, string>> = {
  variation_of: "variação de",
  similar_pattern: "padrão de movimento semelhante a",
  similar_target: "alvo muscular semelhante a",
  equipment_alternative: "alternativa de equipamento a",
  regression: "regressão de",
  progression: "progressão de",
};

/** "B é variação de A" keeping the stored direction; context, not equivalence. */
export function formatRelation(
  relation: Readonly<{ relationType: string; direction: string }>,
  sourceName: string,
  candidateName: string,
): string {
  const label =
    relationTypeLabels[relation.relationType] ?? relation.relationType;
  return relation.direction === "candidate_to_source"
    ? `${candidateName} é ${label} ${sourceName}`
    : `${sourceName} é ${label} ${candidateName}`;
}

export function formatLoadTransition(
  transition: Readonly<{ mode: string; loadKg?: number }>,
): string {
  if (transition.mode === "athlete_selected") return "selecionada pelo atleta";
  if (transition.mode === "explicit_absolute")
    return `${transition.loadKg} kg planejados para o novo exercício (não é conversão)`;
  return "mantida (sem carga absoluta)";
}

export const CROSS_EXERCISE_WARNING =
  "Carga e 1RM estimado não são diretamente comparáveis entre exercícios diferentes.";
export const RELATION_CONTEXT_WARNING =
  "Essas relações contextualizam a troca e não significam equivalência de carga ou resultado.";
