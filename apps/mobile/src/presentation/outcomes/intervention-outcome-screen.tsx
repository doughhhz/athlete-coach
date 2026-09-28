import type { InterventionOutcomeEvaluation } from "@athlete-coach/domain";
import { responseMemoryGroupKeyForAction } from "@athlete-coach/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
  limitationLabels,
  metricLabels,
  outcomeStatusLabels,
} from "./outcome-labels";

export function InterventionOutcomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCoachDecisionOutcome } = useAppSession();
  const theme = useAppTheme();
  const [outcome, setOutcome] = useState<InterventionOutcomeEvaluation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    getCoachDecisionOutcome(id)
      .then((value) => {
        if (active) setOutcome(value);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar a resposta observada.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, getCoachDecisionOutcome, id]);

  if (loading)
    return (
      <ActivityIndicator style={{ margin: 40 }} color={theme.colors.accent} />
    );
  if (error)
    return (
      <View style={s.page}>
        <Text style={{ color: theme.colors.danger }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retry}>
          <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  if (!outcome)
    return (
      <View style={s.page}>
        <Text style={{ color: theme.colors.textMuted }}>
          Decisão não encontrada.
        </Text>
      </View>
    );
  const muted = { color: theme.colors.textMuted };
  const text = { color: theme.colors.text };
  const card = [s.card, { borderColor: theme.colors.border }];
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text accessibilityRole="header" style={[s.title, text]}>
        Resposta observada
      </Text>
      <Text style={[s.label, { color: theme.colors.accent }]}>
        {outcomeStatusLabels[outcome.status].toUpperCase()}
      </Text>
      <Text style={muted}>
        Comparação antes/depois calculada a partir dos treinos registrados.
        Mudanças após a alteração são evidência disponível, não prova de causa.
      </Text>
      <View style={card}>
        <Text style={[s.heading, text]}>{outcome.episode.proposalSummary}</Text>
        <Text style={muted}>
          Proposta em{" "}
          {new Date(outcome.episode.proposedAt).toLocaleDateString()}
          {outcome.activatedAt
            ? ` · ativada em ${new Date(outcome.activatedAt).toLocaleDateString()}`
            : ""}
        </Text>
        {outcome.episode.actions.map((action) => {
          const fidelity = outcome.interventionFidelity.actions.find(
            (item) => item.actionIndex === action.actionIndex,
          );
          return (
            <View key={action.actionIndex} style={s.row}>
              <Text style={text}>
                {action.exerciseName ?? "Exercício"} ·{" "}
                {dimensionLabels[action.dimension]}
              </Text>
              <Text style={muted}>
                Antes: {formatPrescriptionValue(action.sourceValue)} · Proposto:{" "}
                {formatPrescriptionValue(action.proposedValue)} · Aplicado:{" "}
                {outcome.interventionFidelity.implementedProgramState ===
                "activated"
                  ? formatPrescriptionValue(action.implementedValue)
                  : "ainda não ativado"}
              </Text>
              {action.dimension === "set_count" &&
              action.sourceValue?.dimension === "set_count" &&
              action.implementedValue?.dimension === "set_count" ? (
                <Text style={text}>
                  Séries planejadas: {action.sourceValue.count} →{" "}
                  {action.implementedValue.count} (valor ativado; séries
                  concluídas aparecem abaixo por sessão)
                </Text>
              ) : null}
              {responseMemoryGroupKeyForAction(action) &&
              outcome.activatedAt ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/response-memory/[key]",
                      params: { key: responseMemoryGroupKeyForAction(action)! },
                    } as never)
                  }
                >
                  <Text
                    style={{ color: theme.colors.accent, fontWeight: "700" }}
                  >
                    Ver histórico relacionado
                  </Text>
                </Pressable>
              ) : null}
              {fidelity?.proposedValueImplemented === false ? (
                <Text style={muted}>
                  A versão aplicada não corresponde exatamente à proposta.
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {outcome.dataCoverage.exercises.map((coverage) => {
        const comparisons = outcome.comparisons.filter(
          (item) => item.scope.exerciseId === coverage.exerciseId,
        );
        const name =
          outcome.baseline.find(
            (window) => window.exerciseId === coverage.exerciseId,
          )?.exerciseName ?? coverage.exerciseId;
        return (
          <View key={coverage.exerciseId} style={card}>
            <Text style={[s.heading, text]}>{name}</Text>
            <Text style={muted}>
              AMOSTRA · {coverage.baselineExposureCount} sessão(ões) antes ·{" "}
              {coverage.postExposureCount} depois (até{" "}
              {outcome.dataCoverage.exposureLimit} de cada lado)
            </Text>
            {comparisons.length === 0 ? (
              <Text style={muted}>
                Ainda não há dados suficientes para comparar antes e depois.
              </Text>
            ) : (
              comparisons.map((item) => (
                <View key={`${item.scope.kind}-${item.metric}`} style={s.row}>
                  <Text style={text}>
                    {metricLabels[item.metric]}
                    {item.scope.kind === "affected_prescription_sets"
                      ? " · séries alteradas"
                      : " · todas as séries do exercício"}
                  </Text>
                  <Text style={muted}>
                    ANTES {formatMetricValue(item.before, item.unit)} · DEPOIS{" "}
                    {formatMetricValue(item.after, item.unit)} · DIFERENÇA{" "}
                    {formatDelta(item.absoluteDelta, item.unit)} · AMOSTRA{" "}
                    {item.beforeSampleCount}/{item.afterSampleCount}
                  </Text>
                </View>
              ))
            )}
          </View>
        );
      })}
      {outcome.bodyWeightContext.absoluteDeltaKg !== null ? (
        <Text style={muted}>
          Peso corporal registrado:{" "}
          {outcome.bodyWeightContext.atActivation?.weightKg} kg →{" "}
          {outcome.bodyWeightContext.latestInPostWindow?.weightKg} kg (diferença{" "}
          {formatDelta(outcome.bodyWeightContext.absoluteDeltaKg, "kg")}
          ). Apenas contexto; a performance não é ajustada pelo peso.
        </Text>
      ) : null}
      <View style={card}>
        <Text style={[s.heading, text]}>LIMITAÇÕES</Text>
        {outcome.limitations.length === 0 ? (
          <Text style={muted}>Nenhuma limitação factual detectada.</Text>
        ) : (
          outcome.limitations.map((item) => (
            <Text
              key={`${item.exerciseId ?? "all"}-${item.code}`}
              style={muted}
            >
              • {limitationLabels[item.code]}
            </Text>
          ))
        )}
        <Text style={muted}>
          Fatores não registrados (sono, estresse, técnica, alimentação) também
          podem ter mudado e não aparecem aqui.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { gap: 14, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  heading: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  card: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 16 },
  row: { gap: 2 },
});
