import type { TrainingDay, WeekPlanDay } from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandHeader } from "@/presentation/components/brand-header";
import { GradientButton } from "@/presentation/components/gradient-button";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { summarizeSets } from "../prescription-format";

const WEEKDAY_SHORT = ["", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/** Shared brand header plus the Personal's availability. */
export function TreinoHeader({ onOpenPersonal }: { onOpenPersonal(): void }) {
  const theme = useAppTheme();
  const { colors, fonts } = theme;
  return (
    <BrandHeader
      subtitle="Treinos"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir o Personal"
          onPress={onOpenPersonal}
          style={s.row}
        >
          <View style={[s.avatar, { borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
            <View
              style={[
                s.online,
                {
                  backgroundColor: colors.success,
                  borderColor: colors.background,
                },
              ]}
            />
          </View>
          <View>
            <Text
              style={[theme.typography.bodySM, { color: colors.textSecondary }]}
            >
              Seu Personal IA
            </Text>
            <Text
              style={[
                theme.typography.bodySM,
                { color: colors.success, fontFamily: fonts.semibold },
              ]}
            >
              Disponível
            </Text>
          </View>
        </Pressable>
      }
    />
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={s.stat}>
      <View style={s.row}>
        <Ionicons name={icon} size={14} color={theme.colors.primary} />
        <Text
          style={[theme.typography.caption, { color: theme.colors.textMuted }]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[theme.typography.titleMD, { color: theme.colors.textPrimary }]}
      >
        {value}
      </Text>
    </View>
  );
}

/** The focus of the screen: the highlighted day's workout. */
export function HeroWorkoutCard({
  caption,
  title,
  description,
  stats,
  action,
}: {
  caption: string;
  title: string;
  description: string | null;
  stats: readonly Readonly<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }>[];
  action: ReactNode;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        s.hero,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.borderGlow,
          borderRadius: 22,
          shadowColor: colors.borderGlow,
        },
      ]}
    >
      <View style={s.heroTop}>
        <View style={s.heroText}>
          <Text
            style={[
              theme.typography.caption,
              { color: colors.primary, letterSpacing: 2 },
            ]}
          >
            {caption}
          </Text>
          <Text
            style={[
              theme.typography.titleLG,
              { color: colors.textPrimary, fontSize: 24, lineHeight: 30 },
            ]}
          >
            {title}
          </Text>
          {description ? (
            <Text
              numberOfLines={3}
              style={[theme.typography.bodyMD, { color: colors.textSecondary }]}
            >
              {description}
            </Text>
          ) : null}
        </View>
        <LinearGradient
          colors={["rgba(30,220,255,0.25)", "rgba(29,92,255,0.08)"]}
          style={s.heroArt}
        >
          <Ionicons name="barbell" size={56} color={colors.primary} />
        </LinearGradient>
      </View>
      {stats.length ? (
        <View style={[s.stats, { borderColor: colors.divider }]}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={s.statCell}>
              {index > 0 ? (
                <View
                  style={[s.statDivider, { backgroundColor: colors.border }]}
                />
              ) : null}
              <Stat {...stat} />
            </View>
          ))}
        </View>
      ) : null}
      {action}
    </View>
  );
}

export function SectionHeader({
  icon,
  title,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  right?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={s.sectionHeader}>
      <View style={s.row}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
        <Text
          style={[
            theme.typography.titleMD,
            { color: theme.colors.textPrimary, fontSize: 18 },
          ]}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Monday to Sunday with factual status; tapping selects a day. */
export function WeekPlanRow({
  week,
  selectedDate,
  onSelect,
}: {
  week: readonly WeekPlanDay[];
  selectedDate: string | null;
  onSelect(day: WeekPlanDay): void;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const dot = {
    done: colors.success,
    planned: colors.primary,
    rest: colors.textMuted,
  } as const;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.week}
    >
      {week.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${WEEKDAY_SHORT[day.weekday]} ${day.dayOfMonth}, ${day.status === "done" ? "treino feito" : day.status === "planned" ? "treino planejado" : "descanso"}${day.isToday ? ", hoje" : ""}`}
            onPress={() => onSelect(day)}
            style={[
              s.dayCard,
              {
                backgroundColor: selected
                  ? colors.surfaceSoft
                  : colors.surfaceCard,
                borderColor: selected ? colors.borderGlow : colors.border,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.caption,
                { color: day.isToday ? colors.primary : colors.textMuted },
              ]}
            >
              {WEEKDAY_SHORT[day.weekday]}
            </Text>
            <Text
              style={[theme.typography.titleLG, { color: colors.textPrimary }]}
            >
              {day.dayOfMonth}
            </Text>
            <View style={[s.dayDot, { backgroundColor: dot[day.status] }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Short, clean list: name and "3 × 8–10" only. */
export function ExerciseList({
  day,
  onOpen,
}: {
  day: TrainingDay;
  onOpen(): void;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  return (
    <View style={s.list}>
      {[...day.prescriptions]
        .sort((a, b) => a.sequence - b.sequence)
        .map((prescription) => (
          <Pressable
            key={prescription.id}
            accessibilityRole="button"
            onPress={onOpen}
            style={[
              s.exerciseRow,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(30,220,255,0.18)", "rgba(29,92,255,0.06)"]}
              style={s.thumb}
            >
              <Ionicons
                name="barbell-outline"
                size={26}
                color={colors.primary}
              />
            </LinearGradient>
            <View style={s.exerciseText}>
              <Text
                numberOfLines={2}
                style={[
                  theme.typography.titleMD,
                  { color: colors.textPrimary },
                ]}
              >
                {prescription.exerciseName}
              </Text>
              <Text
                style={[
                  theme.typography.bodyMD,
                  { color: colors.textSecondary },
                ]}
              >
                {summarizeSets(prescription.sets)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ))}
    </View>
  );
}

export { GradientButton };

const s = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  logo: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  logoText: { color: "#FFFFFF", fontSize: 24 },
  brand: { fontSize: 20, lineHeight: 26 },
  avatar: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  online: {
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: "absolute",
    right: 0,
    width: 12,
  },
  hero: {
    borderWidth: 1,
    gap: 20,
    padding: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  heroTop: { flexDirection: "row", gap: 12 },
  heroText: { flex: 1, gap: 8 },
  heroArt: {
    alignItems: "center",
    borderRadius: 18,
    height: 120,
    justifyContent: "center",
    width: 120,
  },
  stats: { borderTopWidth: 1, flexDirection: "row", paddingTop: 16 },
  statCell: { flex: 1, flexDirection: "row" },
  statDivider: { height: 34, marginRight: 12, width: 1 },
  stat: { gap: 4 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  week: { gap: 10, paddingVertical: 2 },
  dayCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    height: 96,
    justifyContent: "center",
    width: 64,
  },
  dayDot: { borderRadius: 4, height: 8, width: 8 },
  list: { gap: 12 },
  exerciseRow: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 84,
    padding: 12,
  },
  thumb: {
    alignItems: "center",
    borderRadius: 12,
    height: 60,
    justifyContent: "center",
    width: 72,
  },
  exerciseText: { flex: 1, gap: 4 },
});
