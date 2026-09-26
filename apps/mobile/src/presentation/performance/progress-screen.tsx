import type {
  ExercisePerformancePoint,
  ExercisePersonalBest,
  PerformanceOverview,
} from "@athlete-coach/domain";
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
function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
export function ProgressScreen() {
  const app = useAppSession(),
    theme = useAppTheme();
  const [overview, setOverview] = useState<PerformanceOverview | null>(null),
    [bests, setBests] = useState<readonly ExercisePersonalBest[]>([]),
    [history, setHistory] = useState<readonly ExercisePerformancePoint[]>([]),
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
    ])
      .then(([o, b, h]) => {
        setOverview(o);
        setBests(b);
        setHistory(h);
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
    ])
      .then(([o, b, h]) => {
        if (!active) return;
        setOverview(o);
        setBests(b);
        setHistory(h);
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
    points = history.filter((point) => point.exerciseId === selected);
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
