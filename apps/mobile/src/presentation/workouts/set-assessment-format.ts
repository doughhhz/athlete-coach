import type { SetAssessment } from "@athlete-coach/domain";

/**
 * Text of the per-set assessment card (ADR-0130). The domain decides; this
 * only words the facts: every sentence depends on a datum that exists.
 */
export type SetAssessmentTone = "below" | "within" | "above";
export type SetAssessmentText = Readonly<{
  tone: SetAssessmentTone;
  title: string;
  lines: readonly string[];
  records: readonly string[];
  next: string;
  caution: string | null;
}>;

const number = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "").replace(".", ",");
const range = (min: number, max: number) =>
  min === max ? number(min) : `${number(min)}–${number(max)}`;
const percent = (fraction: number) =>
  `${Math.round(Math.abs(fraction) * 100)}%`;
const kg = (value: number) => `${number(value)} kg`;
const unitOf = (metric: SetAssessment["metric"]) =>
  metric === "reps" ? "reps" : metric === "seconds" ? "s" : "m";
const withLoad = (loadKg: number | null) =>
  loadKg !== null && loadKg > 0 ? ` com ${kg(loadKg)}` : "";
const date = (iso: string) => {
  const value = new Date(iso);
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}`;
};
const reserve = (
  rir: Readonly<{ min: number; max: number }>,
  single = false,
) => {
  const value = single ? number(rir.min) : range(rir.min, rir.max);
  return single && rir.min === 1
    ? "com 1 repetição de reserva"
    : `com ${value} repetições de reserva`;
};

export function formatSetAssessment(
  assessment: SetAssessment,
): SetAssessmentText {
  const { plan, recommendation: next, reasons } = assessment;
  const unit = unitOf(assessment.metric);
  const has = (reason: SetAssessment["reasons"][number]) =>
    reasons.includes(reason);
  const tone: SetAssessmentTone =
    assessment.verdict === "below_plan" ||
    assessment.verdict === "stopped_early"
      ? "below"
      : assessment.verdict === "above_plan"
        ? "above"
        : "within";
  const title =
    assessment.verdict === "below_plan"
      ? "Abaixo do planejado"
      : assessment.verdict === "stopped_early"
        ? "Parou antes do alvo"
        : assessment.verdict === "above_plan"
          ? "Acima do planejado"
          : "Dentro do plano";

  // 1. The set against its plan.
  const effort =
    plan.rir && plan.actual.rir !== null
      ? plan.rirAttainment === "below_range"
        ? plan.actual.rir === 0
          ? `, e você chegou na falha (RIR 0, plano ${range(plan.rir.min, plan.rir.max)})`
          : `, com menos reserva que o plano (RIR ${plan.actual.rir}, plano ${range(plan.rir.min, plan.rir.max)})`
        : plan.rirAttainment === "above_range"
          ? `, com mais reserva que o plano (RIR ${plan.actual.rir}, plano ${range(plan.rir.min, plan.rir.max)})`
          : `, com o esforço planejado (RIR ${plan.actual.rir})`
      : "";
  const lines: string[] = [
    `${number(plan.actual.value)} de ${range(plan.target.min, plan.target.max)} ${unit}${withLoad(plan.actual.loadKg)}${effort}.`,
  ];

  // 2. Today's previous set.
  const previous = assessment.previousSetToday;
  if (previous)
    lines.push(
      has("steep_in_session_drop")
        ? `Da série ${previous.sequence} para esta, caiu ${percent(previous.change)} (${number(previous.value)} → ${number(plan.actual.value)} ${unit}).`
        : previous.change < 0
          ? `Pequena queda desde a série ${previous.sequence} (${number(previous.value)} → ${number(plan.actual.value)} ${unit}), normal com o cansaço.`
          : `Mantendo o ritmo da série ${previous.sequence} (${number(previous.value)} → ${number(plan.actual.value)} ${unit}).`,
    );

  // 3. Same set in the last session.
  const last = assessment.lastSession;
  if (last) {
    const before = `Na última sessão (${date(last.startedAt)}) você fez ${number(last.value)} ${unit}${withLoad(last.loadKg)} nesta série`;
    if (last.valueChange !== null)
      lines.push(
        Math.abs(last.valueChange) < 0.005
          ? `${before}; hoje igualou.`
          : `${before}; hoje ${last.valueChange < 0 ? "caiu" : "subiu"} ${percent(last.valueChange)}.`,
      );
    else if (last.estimatedOneRepMaxChange !== null)
      lines.push(
        `${before}; com a carga de hoje, sua força estimada está ${percent(last.estimatedOneRepMaxChange)} ${last.estimatedOneRepMaxChange < 0 ? "abaixo" : "acima"}.`,
      );
    else lines.push(`${before}.`);
  }
  const average = assessment.recentAverage;
  if (average)
    lines.push(
      `Média das últimas ${average.sessionCount} sessões nesta série: ${number(Math.round(average.value * 10) / 10)} ${unit}${withLoad(average.loadKg === null ? null : Math.round(average.loadKg * 10) / 10)}.`,
    );

  // 4. Month trend and context.
  const trend = assessment.trend;
  if (trend)
    lines.push(
      trend.direction === "rising"
        ? `Sua força estimada neste exercício subiu ${percent(trend.change)} no último mês.`
        : trend.direction === "falling"
          ? `Sua força estimada neste exercício caiu ${percent(trend.change)} no último mês.`
          : "Sua força estimada neste exercício está estável no último mês.",
    );
  const week = assessment.week;
  if (has("heavy_week") && week.plannedPerWeek !== null)
    lines.push(
      `Você treinou ${week.workoutsLast7Days} vezes nos últimos 7 dias (plano: ${week.plannedPerWeek} por semana)${tone === "below" ? ", então pode ser cansaço acumulado" : ""}.`,
    );
  if (has("long_break") && week.daysSinceExercise !== null)
    lines.push(
      `Faz ${week.daysSinceExercise} dias que você não fazia este exercício; é normal render menos na volta.`,
    );
  if (has("usual_for_you"))
    lines.push(
      "É parecido com o que você fez nesta série da última vez, então não precisa reduzir.",
    );
  if (has("consistent_above"))
    lines.push("É a 3ª sessão seguida acima do plano nesta série.");
  if (has("first_time"))
    lines.push(
      "Primeiro registro deste exercício: a comparação fica mais precisa nas próximas sessões.",
    );
  if (has("rir_not_recorded"))
    lines.push("Registre o RIR para uma orientação mais precisa.");

  // 5. Records.
  const records = assessment.records.map((record) => {
    const what =
      record.kind === "load"
        ? "maior carga"
        : record.kind === "estimated_one_rep_max"
          ? "maior força estimada"
          : "mais repetições com essa carga";
    return record.scope === "all_time"
      ? `Recorde: ${what} neste exercício!`
      : `Recorde do mês: ${what} nos últimos 28 dias!`;
  });

  // 6. Next set (or next session after the last set).
  const prefix =
    next.scope === "next_set" ? "Próxima série:" : "Próximo treino:";
  const target =
    next.action === "decrease"
      ? `${number(next.target.min)} ${unit}`
      : `${range(next.target.min, next.target.max)} ${unit}`;
  const aim = `mire ${target}${next.rir ? ` ${reserve(next.rir, next.action === "decrease")}` : ""}`;
  const load = next.loadKg
    ? `${range(next.loadKg.min, next.loadKg.max)} kg`
    : null;
  const advice =
    next.action === "decrease"
      ? load
        ? `reduza para ${load} e ${aim}.`
        : `use uma variação mais fácil ou menos carga e ${aim}.`
      : next.action === "increase"
        ? load
          ? `suba para ${load} e ${aim}.`
          : `aumente a carga ou a dificuldade e ${aim}.`
        : load
          ? `mantenha ${load} e ${aim}.`
          : `mantenha e ${aim}.`;

  return {
    tone,
    title,
    lines,
    records,
    next: `${prefix} ${advice}`,
    caution: has("sharp_drop")
      ? "Queda grande. Se sentiu dor ou desconforto, interrompa o exercício."
      : null,
  };
}
