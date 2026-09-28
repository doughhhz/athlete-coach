import type {
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
  };

export const metricLabels: Readonly<Record<OutcomeMetric, string>> = {
  completed_sets_per_exposure: "Séries realizadas por sessão",
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
