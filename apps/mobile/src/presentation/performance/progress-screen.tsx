import type {
  ExercisePerformancePoint,
  ExercisePersonalBest,
  PerformanceOverview,
  AthleteTrainingDossier,
} from "@athlete-coach/domain";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  dimensionLabels,
  formatDelta,
  formatMetricValue,
  formatPrescriptionValue,
  metricLabels,
  outcomeStatusLabels,
} from "@/presentation/outcomes/outcome-labels";
function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
export function ProgressScreen() {
  const app = useAppSession(),
    theme = useAppTheme();
  const [overview, setOverview] = useState<PerformanceOverview | null>(null),
    [bests, setBests] = useState<readonly ExercisePersonalBest[]>([]),
    [history, setHistory] = useState<readonly ExercisePerformancePoint[]>([]),
    [dossier, setDossier] = useState<AthleteTrainingDossier | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      app.getPerformanceOverview(),
      app.getExercisePersonalBests(),
      app.getExercisePerformanceHistory(),
      app.buildTrainingDossier(),
    ])
      .then(([o, b, h, d]) => {
        setOverview(o);
        setBests(b);
        setHistory(h);
        setDossier(d);
        setSelected((current) => current ?? b[0]?.exerciseId ?? null);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível calcular seu progresso.",
        ),
      )
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      app.getPerformanceOverview(),
      app.getExercisePersonalBests(),
      app.getExercisePerformanceHistory(),
      app.buildTrainingDossier(),
    ])
      .then(([o, b, h, d]) => {
        if (!active) return;
        setOverview(o);
        setBests(b);
        setHistory(h);
        setDossier(d);
        setSelected(b[0]?.exerciseId ?? null);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível calcular seu progresso.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app]);
  if (loading)
    return (
      <ActivityIndicator style={{ margin: 40 }} color={theme.colors.accent} />
    );
  if (error)
    return (
      <View style={s.page}>
        <Text style={{ color: theme.colors.danger }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: theme.colors.accent }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  const selectedBest = bests.find((item) => item.exerciseId === selected),
    points = history.filter((point) => point.exerciseId === selected),
    last28 = dossier?.windows.find((window) => window.key === "last_28_days"),
    previous28 = dossier?.windows.find(
      (window) => window.key === "previous_28_days",
    ),
    selectedSignal = dossier?.exerciseSignals.find(
      (signal) => signal.exerciseId === selected,
    ),
    trackedChanges =
      dossier?.interventionHistory?.items.filter(
        (item) => item.outcomeStatus !== "not_materialized",
      ) ?? [],
    memoryGroups = dossier?.responseMemory?.groups.items ?? [];
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.colors.text }]}
      >
        Progresso
      </Text>
      <Text style={[s.label, { color: theme.colors.accent }]}>
        RESUMO FACTUAL · HISTÓRICO TOTAL
      </Text>
      {overview &&
      overview.completedWorkoutCount + overview.abandonedWorkoutCount > 0 ? (
        <View style={[s.card, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>
            Treinos concluídos: {overview.completedWorkoutCount}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Treinos abandonados: {overview.abandonedWorkoutCount}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Séries concluídas: {overview.completedSetCount}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Séries puladas: {overview.skippedSetCount}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Reps registradas: {overview.totalActualReps}
          </Text>
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted }}>
          Conclua ou abandone um treino com séries realizadas para formar seu
          histórico.
        </Text>
      )}
      {last28 && previous28 ? (
        <View style={[s.card, { borderColor: theme.colors.border }]}>
          <Text style={[s.heading, { color: theme.colors.text }]}>
            Últimos 28 dias
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Treinos concluídos: {last28.sessionsCompleted} (período anterior:{" "}
            {previous28.sessionsCompleted})
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Séries realizadas: {last28.completedSets} (período anterior:{" "}
            {previous28.completedSets})
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Reps registradas: {last28.totalReps} (período anterior:{" "}
            {previous28.totalReps})
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Dados registrados · carga{" "}
            {dossier?.dataCoverageLast28Days.loadRecordedCount}/
            {dossier?.dataCoverageLast28Days.completedSetsCount} séries · RIR{" "}
            {dossier?.dataCoverageLast28Days.rirRecordedCount}/
            {dossier?.dataCoverageLast28Days.rirEligibleCount} elegíveis ·
            descanso {dossier?.dataCoverageLast28Days.restMeasuredCount}/
            {dossier?.dataCoverageLast28Days.restEligibleCount} elegíveis
          </Text>
        </View>
      ) : null}
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Memória de resposta
      </Text>
      {!memoryGroups.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Ainda não há intervenções ativadas para formar um histórico observado.
        </Text>
      ) : (
        <>
          <Text style={{ color: theme.colors.textMuted }}>
            Observações de intervenções anteriores, agrupadas por exercício e
            alteração. Não são regras nem prova de causa.
            {dossier?.responseMemory?.groups.hasMore
              ? ` Mostrando ${dossier.responseMemory.groups.included} de ${dossier.responseMemory.groups.totalAvailable} grupos.`
              : ""}
          </Text>
          {memoryGroups.map((group) => {
            const oneRm = group.aggregates.find(
              (item) =>
                item.metric === "best_estimated_one_rep_max_kg" &&
                item.scope === "exercise",
            );
            return (
              <Pressable
                key={group.key}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/response-memory/[key]",
                    params: { key: group.key },
                  } as never)
                }
                style={[s.card, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                  {group.exerciseName}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {dimensionLabels[group.interventionDimension]}
                  {group.replacementExerciseName
                    ? ` → ${group.replacementExerciseName}`
                    : ""}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {group.coverage.totalEpisodes} intervenção(ões) registrada(s)
                  · {group.coverage.strictComparableEpisodes} comparável(is) ·{" "}
                  {group.coverage.contextOnlyEpisodes} com mudanças simultâneas
                  ou dados limitados
                </Text>
                {oneRm && oneRm.observedDeltaCount > 0 ? (
                  <Text style={{ color: theme.colors.textMuted }}>
                    1RM estimado: {oneRm.positiveDeltaCount} variação(ões)
                    positiva(s) · {oneRm.zeroDeltaCount} igual(is) ·{" "}
                    {oneRm.negativeDeltaCount} negativa(s)
                  </Text>
                ) : null}
                {group.aggregates.some((item) => item.contradictory) ? (
                  <Text style={{ color: theme.colors.textMuted }}>
                    Observações em direções diferentes.
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </>
      )}
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Alterações acompanhadas
      </Text>
      {!trackedChanges.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Nenhuma revisão criada a partir de uma proposta do Personal.
        </Text>
      ) : (
        <>
          <Text style={{ color: theme.colors.textMuted }}>
            Comparação antes/depois das primeiras sessões após a ativação.
            Evidência disponível, não prova de causa.
          </Text>
          {trackedChanges.map((item) => (
            <Pressable
              key={item.decisionId}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/coach-decisions/[id]",
                  params: { id: item.decisionId },
                } as never)
              }
              style={[s.card, { borderColor: theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                {item.proposalSummary}
              </Text>
              <Text style={{ color: theme.colors.accent }}>
                {outcomeStatusLabels[item.outcomeStatus]}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Proposta em {new Date(item.proposedAt).toLocaleDateString()}
                {item.activatedAt
                  ? ` · ativada em ${new Date(item.activatedAt).toLocaleDateString()}`
                  : ""}
              </Text>
              {item.changes.map((change, index) => (
                <Text
                  key={`${item.decisionId}-${index}`}
                  style={{ color: theme.colors.textMuted }}
                >
                  {change.exerciseName ?? "Exercício"} ·{" "}
                  {dimensionLabels[change.dimension]}:{" "}
                  {formatPrescriptionValue(change.before)} →{" "}
                  {formatPrescriptionValue(
                    change.implemented ?? change.proposed,
                  )}
                </Text>
              ))}
              {item.exposureCounts.map((coverage) => (
                <Text
                  key={`${item.decisionId}-${coverage.exerciseId}`}
                  style={{ color: theme.colors.textMuted }}
                >
                  Sessões observadas: {coverage.baselineExposureCount} antes ·{" "}
                  {coverage.postExposureCount} depois
                </Text>
              ))}
              {item.comparisons
                .filter(
                  (comparison) =>
                    comparison.scope.kind === "affected_prescription_sets" &&
                    comparison.relevantDimensions.length > 0,
                )
                .map((comparison) => (
                  <Text
                    key={`${item.decisionId}-${comparison.scope.exerciseId}-${comparison.metric}`}
                    style={{ color: theme.colors.textMuted }}
                  >
                    {metricLabels[comparison.metric]}:{" "}
                    {formatMetricValue(comparison.before, comparison.unit)} →{" "}
                    {formatMetricValue(comparison.after, comparison.unit)} (
                    {formatDelta(comparison.absoluteDelta, comparison.unit)} ·
                    amostras {comparison.beforeSampleCount}/
                    {comparison.afterSampleCount})
                  </Text>
                ))}
              {item.limitations.length ? (
                <Text style={{ color: theme.colors.textMuted }}>
                  Limitações: {item.limitations.length}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </>
      )}
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Melhores marcas
      </Text>
      {!bests.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Ainda não há carga registrada elegível para melhores marcas.
        </Text>
      ) : (
        bests.map((best) => (
          <Pressable
            key={best.exerciseId}
            onPress={() => setSelected(best.exerciseId)}
            style={[
              s.card,
              {
                borderColor:
                  selected === best.exerciseId
                    ? theme.colors.accent
                    : theme.colors.border,
              },
            ]}
          >
            <Text style={[s.heading, { color: theme.colors.text }]}>
              {best.exerciseName}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Maior carga registrada:{" "}
              {best.maxLoggedLoadKg === null
                ? "não disponível"
                : `${number(best.maxLoggedLoadKg)} kg`}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Melhor 1RM estimado:{" "}
              {best.bestEstimatedOneRepMaxKg === null
                ? "não elegível"
                : `${number(best.bestEstimatedOneRepMaxKg)} kg`}
            </Text>
          </Pressable>
        ))
      )}
      {selectedBest ? (
        <>
          <Text style={[s.heading, { color: theme.colors.text }]}>
            Histórico · {selectedBest.exerciseName}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Carga é o valor registrado para este mesmo exercício. 1RM estimado
            usa Epley v1; não é uma medição de 1RM.
          </Text>
          {selectedSignal ? (
            <View style={[s.card, { borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text }}>
                Comparação factual · 28 dias
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Sessões: {selectedSignal.sessionAppearances.currentValue ?? 0}{" "}
                vs {selectedSignal.sessionAppearances.previousValue ?? 0} ·
                delta{" "}
                {selectedSignal.sessionAppearances.absoluteDelta ??
                  "não disponível"}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Melhor 1RM estimado:{" "}
                {selectedSignal.bestEstimatedOneRepMaxKg.currentValue === null
                  ? "não elegível"
                  : `${number(selectedSignal.bestEstimatedOneRepMaxKg.currentValue)} kg`}{" "}
                · amostras{" "}
                {selectedSignal.bestEstimatedOneRepMaxKg.recentSampleCount}/
                {selectedSignal.bestEstimatedOneRepMaxKg.previousSampleCount}
              </Text>
            </View>
          ) : null}
          {points.map((point) => (
            <View
              key={point.workoutSetId}
              style={[s.card, { borderColor: theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.text }}>
                {new Date(point.performedAt).toLocaleString()} ·{" "}
                {point.programName} / {point.dayName}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {point.sessionStatus === "abandoned"
                  ? "Sessão abandonada · performance preservada"
                  : "Sessão concluída"}
                {point.reps !== null ? ` · ${point.reps} reps` : ""}
                {point.loggedLoadKg !== null
                  ? ` · ${number(point.loggedLoadKg)} kg registrados`
                  : ""}
                {point.actualRir !== null ? ` · RIR ${point.actualRir}` : ""}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                1RM estimado:{" "}
                {point.estimatedOneRepMaxKg === null
                  ? "não elegível"
                  : `${number(point.estimatedOneRepMaxKg)} kg`}
              </Text>
              {point.isNewMaxLoggedLoad || point.isNewEstimatedOneRepMax ? (
                <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
                  {point.isNewEstimatedOneRepMax
                    ? "Novo melhor 1RM estimado"
                    : "Nova maior carga registrada"}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 14, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  heading: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  card: { borderRadius: 14, borderWidth: 1, gap: 6, padding: 16 },
});
