import type { PrescriptionSet } from "@athlete-coach/domain";

/** Display only: how planned sets read in the program screen. */
export type SetGroupDisplay = Readonly<{
  /** e.g. "3 séries × 8–10 reps" */
  headline: string;
  /** e.g. ["RIR 2", "Descanso 2–3 min", "Carga: você escolhe pelo RIR"] */
  details: readonly string[];
}>;

const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);
const units = { reps: "reps", seconds: "s", meters: "m" } as const;
const sameTargets = (a: PrescriptionSet, b: PrescriptionSet) =>
  a.targetMetric === b.targetMetric &&
  a.targetMin === b.targetMin &&
  a.targetMax === b.targetMax &&
  a.rirMin === b.rirMin &&
  a.rirMax === b.rirMax &&
  a.restMinSeconds === b.restMinSeconds &&
  a.restMaxSeconds === b.restMaxSeconds &&
  a.tempo === b.tempo &&
  a.loadKind === b.loadKind &&
  a.loadKg === b.loadKg;

/** "120–180 s" reads as "2–3 min"; other values stay in seconds. */
export function formatRest(min: number, max: number): string {
  if (min % 60 === 0 && max % 60 === 0 && min >= 60)
    return `${range(min / 60, max / 60)} min`;
  return `${range(min, max)} s`;
}

/** Consecutive identical sets become one line ("3 séries × ..."). */
export function groupPrescriptionSets(
  sets: readonly PrescriptionSet[],
): readonly SetGroupDisplay[] {
  const ordered = [...sets].sort((a, b) => a.sequence - b.sequence);
  const groups: { first: PrescriptionSet; count: number }[] = [];
  for (const set of ordered) {
    const last = groups.at(-1);
    if (last && sameTargets(last.first, set)) last.count += 1;
    else groups.push({ first: set, count: 1 });
  }
  return groups.map(({ first: set, count }) => {
    const details: string[] = [];
    if (set.rirMin !== null)
      details.push(`RIR ${range(set.rirMin, set.rirMax!)}`);
    if (set.restMinSeconds !== null)
      details.push(
        `Descanso ${formatRest(set.restMinSeconds, set.restMaxSeconds!)}`,
      );
    if (set.tempo) details.push(`Tempo ${set.tempo}`);
    if (set.loadKind === "absolute") details.push(`Carga ${set.loadKg} kg`);
    else if (set.loadKind === "athlete_selected")
      details.push("Carga: você escolhe pelo RIR");
    return {
      headline: `${count} ${count === 1 ? "série" : "séries"} × ${range(set.targetMin, set.targetMax)} ${units[set.targetMetric]}`,
      details,
    };
  });
}

/** Compact list subtitle: "3 × 8–10" when all sets share the target. */
export function summarizeSets(sets: readonly PrescriptionSet[]): string {
  const first = sets[0];
  if (!first) return "Sem séries";
  const same = sets.every(
    (set) =>
      set.targetMetric === first.targetMetric &&
      set.targetMin === first.targetMin &&
      set.targetMax === first.targetMax,
  );
  if (!same) return `${sets.length} séries`;
  const unit =
    first.targetMetric === "reps" ? "" : ` ${units[first.targetMetric]}`;
  return `${sets.length} × ${range(first.targetMin, first.targetMax)}${unit}`;
}
