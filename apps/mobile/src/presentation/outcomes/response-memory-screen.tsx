import type { ComparableInterventionGroup } from "@athlete-coach/domain";
import { useLocalSearchParams } from "expo-router";
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
  changeDirectionLabels,
  comparabilityReasonLabel,
  dimensionLabels,
  formatDelta,
  formatMetricValue,
  formatPrescriptionValue,
  limitationLabels,
  metricLabels,
  outcomeStatusLabels,
  signPatternLabels,
} from "./outcome-labels";

export function ResponseMemoryScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { getResponseMemoryGroup } = useAppSession();
  const theme = useAppTheme();
  const [group, setGroup] = useState<ComparableInterventionGroup | null>(null);
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
    getResponseMemoryGroup(key)
      .then((value) => {
        if (active) setGroup(value);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar o histórico observado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, getResponseMemoryGroup, key]);

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
  if (!group)
    return (
      <View style={s.page}>
        <Text style={{ color: theme.colors.textMuted }}>
          Ainda não há histórico observado para esta combinação.
        </Text>
      </View>
    );
  const muted = { color: theme.colors.textMuted };
  const text = { color: theme.colors.text };
  const card = [s.card, { borderColor: theme.colors.border }];
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text accessibilityRole="header" style={[s.title, text]}>
        Histórico observado
      </Text>
      <Text style={[s.heading, text]}>
        {group.exerciseName} · {dimensionLabels[group.interventionDimension]}
        {group.targetMetric ? ` (${group.targetMetric})` : ""}
      </Text>
      <Text style={muted}>
        Observações de intervenções anteriores, não verdades. Variação positiva
        significa apenas depois − antes maior que zero. Intervenções comparáveis
        seguem regras estruturais; não são experimentos controlados.
      </Text>
      <View style={card}>
        <Text style={text}>
          {group.coverage.totalEpisodes} intervenção(ões) registrada(s) ·{" "}
          {group.coverage.strictComparableEpisodes} comparável(is) ·{" "}
          {group.coverage.contextOnlyEpisodes} só como contexto
        </Text>
        {group.aggregates
          .filter((item) => item.observedDeltaCount > 0)
          .map((item) => (
            <Text key={`${item.scope}-${item.metric}`} style={muted}>
              {metricLabels[item.metric]}: {item.positiveDeltaCount} positiva(s)
              · {item.zeroDeltaCount} zero · {item.negativeDeltaCount}{" "}
              negativa(s) · sem dado {item.missingDeltaCount} ·{" "}
              {signPatternLabels[item.signPattern]}
              {item.medianAbsoluteDelta === null || item.unit === null
                ? ""
                : ` · mediana ${formatDelta(item.medianAbsoluteDelta, item.unit)}`}
            </Text>
          ))}
        {group.aggregates.some((item) => item.contradictory) ? (
          <Text style={text}>
            Os episódios observados apontaram em direções diferentes.
          </Text>
        ) : null}
      </View>
      {group.episodes.items.map((episode) => (
        <View key={episode.decisionId} style={card}>
          <Text style={text}>
            {new Date(episode.activatedAt).toLocaleDateString()} · programa
            revisão {episode.interventionProgram?.revision ?? "—"} (origem
            revisão {episode.sourceProgram.revision})
          </Text>
          <Text style={muted}>
            {outcomeStatusLabels[episode.outcomeStatus]} ·{" "}
            {episode.comparability.classification === "strict_comparable"
              ? "Intervenção comparável"
              : "Apenas contexto"}
          </Text>
          {episode.signature.changes.map((change, index) => (
            <Text key={index} style={muted}>
              Alteração ativada: {formatPrescriptionValue(change.before)} →{" "}
              {formatPrescriptionValue(change.after)} (
              {changeDirectionLabels[change.direction]})
            </Text>
          ))}
          <Text style={muted}>
            Amostra: {episode.baselineExposureCount} sessão(ões) antes ·{" "}
            {episode.postExposureCount} depois
          </Text>
          {episode.observations
            .filter((item) => item.absoluteDelta !== null)
            .map((item) => (
              <Text key={`${item.scope}-${item.metric}`} style={muted}>
                {metricLabels[item.metric]}: Antes{" "}
                {formatMetricValue(item.before, item.unit)} · Depois{" "}
                {formatMetricValue(item.after, item.unit)} · Variação numérica{" "}
                {formatDelta(item.absoluteDelta, item.unit)} · Amostra{" "}
                {item.beforeSampleCount}/{item.afterSampleCount}
              </Text>
            ))}
          {[
            ...episode.comparability.reasons.map(comparabilityReasonLabel),
            ...episode.limitationCodes
              .filter(
                (code) =>
                  !(
                    episode.comparability.reasons as readonly string[]
                  ).includes(code),
              )
              .map((code) => limitationLabels[code]),
          ].map((label) => (
            <Text key={label} style={muted}>
              • Limitações: {label}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { gap: 14, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  heading: { fontSize: 18, fontWeight: "800" },
  card: { borderRadius: 14, borderWidth: 1, gap: 6, padding: 16 },
});
