import type { StructureSummary } from "@athlete-coach/application";

/**
 * Wording of explicit structure edits (Implementation Phase 19, ADR-0098).
 * Factual counts only; no alarmist language. Counting lives in the
 * application editor (`structureSummaries`); this module only formats.
 */
export type StructureLevel = "block" | "week" | "day";

const count = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;
const list = (parts: readonly string[]) =>
  parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

export const structureLevelLabels = {
  block: { noun: "bloco", title: "Bloco", add: "+ Bloco" },
  week: { noun: "semana", title: "Semana", add: "+ Semana neste bloco" },
  day: { noun: "dia", title: "Dia em edição", add: "+ Dia nesta semana" },
} as const satisfies Record<
  StructureLevel,
  { noun: string; title: string; add: string }
>;

/** Shown instead of the remove action when the node is the last one. */
export const lastNodeExplanation = {
  block: "Único bloco do programa: um programa precisa de ao menos um bloco.",
  week: "Única semana deste bloco: um bloco precisa de ao menos uma semana.",
  day: "Único dia desta semana: uma semana precisa de ao menos um dia.",
} as const satisfies Record<StructureLevel, string>;

export function removalTitle(
  level: StructureLevel,
  summary: StructureSummary,
): string {
  return `Remover ${structureLevelLabels[level].noun} "${summary.name}"?`;
}

export function removalMessage(
  level: StructureLevel,
  summary: StructureSummary,
): string {
  const exercises = count(summary.exercises, "exercício", "exercícios");
  const parts =
    level === "block"
      ? [
          count(summary.weeks, "semana", "semanas"),
          count(summary.days, "dia", "dias"),
          exercises,
        ]
      : level === "week"
        ? [count(summary.days, "dia", "dias"), exercises]
        : [exercises, count(summary.sets, "série", "séries")];
  return `Contém ${list(parts)}. A remoção vale para o rascunho quando você salvar; sair sem salvar mantém a versão salva.`;
}

export const removalConfirmLabel = {
  block: "Remover bloco",
  week: "Remover semana",
  day: "Remover dia",
} as const satisfies Record<StructureLevel, string>;
