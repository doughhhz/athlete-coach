import type { WorkoutSession } from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/presentation/components/motion";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

/**
 * A workout left open on an earlier day: a discreet notice, never the main
 * card (ADR-0127). Opening it lets the athlete resume or end it.
 */
export function OpenWorkoutNotice({
  workout,
  timeZone,
}: {
  workout: WorkoutSession;
  timeZone: string;
}) {
  const { colors, typography, fonts } = useAppTheme();
  const router = useRouter();
  const day = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(workout.startedAt));
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={() => router.push(`/workouts/${workout.id}` as Href)}
      testID="open-workout-notice"
      style={[
        s.notice,
        { backgroundColor: colors.surfaceCard, borderColor: colors.border },
      ]}
    >
      <Ionicons name="alert-circle-outline" size={20} color="#FFC247" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            typography.bodyMD,
            { color: colors.textPrimary, fontFamily: fonts.semibold },
          ]}
        >
          Treino não finalizado: {workout.dayName}
        </Text>
        <Text style={[typography.bodySM, { color: colors.textMuted }]}>
          Iniciado em {day}. Toque para retomar ou encerrar.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}
const s = StyleSheet.create({
  notice: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
});
