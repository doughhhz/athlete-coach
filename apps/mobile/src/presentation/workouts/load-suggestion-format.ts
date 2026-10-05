import type { ExerciseLoadSuggestion } from "@athlete-coach/domain";

/**
 * Text of the "before the first set" suggestion (ADR-0131). The domain
 * computes; this only words the facts. null = nothing worth showing.
 */
export type LoadSuggestionText = Readonly<{
  title: string;
  lines: readonly string[];
  warmUpTitle: string | null;
  warmUp: readonly string[];
}>;

const number = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
const kg = (value: number) => `${number(value)} kg`;
const date = (iso: string) => {
  const value = new Date(iso);
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}`;
};
const reserve = (rir: number) =>
  rir === 0
    ? "até a falha"
    : rir === 1
      ? "sobrando 1"
      : `sobrando ${number(rir)}`;

export function formatLoadSuggestion(
  suggestion: ExerciseLoadSuggestion,
): LoadSuggestionText | null {
  const { kind, basis, target, reasons, warmUp } = suggestion;
  if (kind === "bodyweight") return null;
  const has = (reason: ExerciseLoadSuggestion["reasons"][number]) =>
    reasons.includes(reason);
  const lines: string[] = [];
  let title: string;
  if (kind === "exploratory") {
    title = "Primeira vez neste exercício";
    lines.push(
      "Comece com uma carga que você faria umas 20 vezes. Depois da 1ª série, o Personal ajusta a próxima.",
    );
  } else {
    title =
      kind === "prescribed"
        ? `Carga do programa: ${kg(suggestion.workingLoadKg!)}`
        : `Carga sugerida: ${kg(suggestion.workingLoadKg!)}`;
    if (basis)
      lines.push(
        `Na última vez (${date(basis.startedAt)}) você fez ${number(basis.value)} reps com ${kg(basis.loadKg)}${basis.rir === null ? "" : `, ${reserve(basis.rir)}`}.`,
      );
    if (kind === "from_history")
      lines.push(
        `Calculada para ${target.reps} reps ${reserve(target.rir)} na 1ª série de hoje.`,
      );
    if (has("long_break"))
      lines.push(
        "Faz 14 dias ou mais sem este exercício: começamos 10% mais leve.",
      );
    if (has("capped_increase"))
      lines.push("Subida limitada a 10% sobre a última vez, por segurança.");
    if (has("heavy_week"))
      lines.push(
        "Sua semana está acima do plano: mantivemos a carga da última vez.",
      );
    if (has("rir_assumed"))
      lines.push("O plano não define RIR: considerei 2 repetições de reserva.");
  }

  const warmUpLines = warmUp.sets.map((set) => {
    const load =
      set.loadKg === null
        ? "Leve"
        : set.percent === null
          ? `${kg(set.loadKg)} (barra vazia)`
          : kg(set.loadKg);
    return `${load} × ${set.reps}`;
  });
  const warmUpTitle =
    warmUp.plan === "full"
      ? "Aquecimento"
      : warmUp.plan === "single"
        ? has("group_already_warm")
          ? "Aquecimento (grupo já aquecido no treino)"
          : "Aquecimento"
        : null;
  if (warmUp.plan === "none" && kind !== "exploratory" && has("isolation"))
    lines.push("Sem aquecimento formal: faça a 1ª série com controle.");
  return { title, lines, warmUpTitle, warmUp: warmUpLines };
}
