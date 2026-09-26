import type { WorkoutSession } from "@athlete-coach/domain";
import { workoutDurationSeconds } from "@athlete-coach/domain";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
export function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useAppSession(),
    theme = useAppTheme(),
    [session, setSession] = useState<WorkoutSession | null>();
  useEffect(() => {
    void app.getWorkout(id).then(setSession);
  }, [app, id]);
  if (!session) return <Text style={s.page}>Carregando…</Text>;
  const sets = session.exercises.flatMap((e) => e.sets);
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={[s.title, { color: theme.colors.text }]}>
        Resumo factual
      </Text>
      <Text style={{ color: theme.colors.text }}>
        {session.programName} · {session.dayName}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {session.status === "completed" ? "Concluído" : "Abandonado"} ·{" "}
        {Math.floor(workoutDurationSeconds(session) / 60)} min ·{" "}
        {sets.filter((x) => x.status === "completed").length} concluídas ·{" "}
        {sets.filter((x) => x.status === "skipped").length} puladas
      </Text>
      {session.exercises.map((e) => (
        <View key={e.id}>
          <Text style={[s.exercise, { color: theme.colors.text }]}>
            {e.exerciseName}
          </Text>
          {e.sets.map((x) => (
            <Text key={x.id} style={{ color: theme.colors.textMuted }}>
              Série {x.sequence}: {x.status}
              {x.actualValue !== null
                ? ` · ${x.actualValue} ${x.plannedMetric}`
                : ""}
              {x.actualLoadKg !== null ? ` · ${x.actualLoadKg} kg` : ""}
              {x.actualRir !== null ? ` · RIR ${x.actualRir}` : ""}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 14, padding: 20 },
  title: { fontSize: 28, fontWeight: "800" },
  exercise: { fontSize: 18, fontWeight: "800", marginTop: 8 },
});
