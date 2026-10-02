import type { WorkoutExercise, WorkoutSet } from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { formatRest } from "@/presentation/training/prescription-format";

type IconName = keyof typeof Ionicons.glyphMap;
const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);
const unit = { reps: "reps", seconds: "s", meters: "m" } as const;
export const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Back, brand, elapsed time and the session menu. */
export function WorkoutSessionHeader({
  elapsedSeconds,
  onBack,
  onMenu,
}: {
  elapsedSeconds: number;
  onBack(): void;
  onMenu(): void;
}) {
  const { colors, fonts, typography } = useAppTheme();
  return (
    <View style={s.header}>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={onBack}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.logo}
        >
          <Text style={[s.logoText, { fontFamily: fonts.bold }]}>A</Text>
        </LinearGradient>
        <View>
          <Text style={[s.brand, { fontFamily: fonts.bold }]}>
            <Text style={{ color: colors.textPrimary }}>Athlete </Text>
            <Text style={{ color: colors.brandAccent }}>Coach</Text>
          </Text>
          <Text style={[typography.bodySM, { color: colors.textMuted }]}>
            Treino em andamento
          </Text>
        </View>
      </View>
      <View style={s.row}>
        <View
          accessibilityLabel={`Tempo de treino ${clock(elapsedSeconds)}`}
          style={[
            s.timer,
            {
              backgroundColor: colors.surfaceCard,
              borderColor: colors.borderGlow,
            },
          ]}
        >
          <View style={[s.dot, { backgroundColor: colors.success }]} />
          <Ionicons name="timer-outline" size={16} color={colors.textPrimary} />
          <Text
            style={[
              typography.bodyMD,
              { color: colors.textPrimary, fontFamily: fonts.semibold },
            ]}
          >
            {clock(elapsedSeconds)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opções do treino"
          onPress={onMenu}
          hitSlop={12}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

/** Day name, "N de M exercícios" and the share of resolved sets. */
export function SessionProgress({
  title,
  exerciseLabel,
  percent,
}: {
  title: string;
  exerciseLabel: string;
  percent: number;
}) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={[
          typography.caption,
          { color: colors.primary, letterSpacing: 2 },
        ]}
      >
        TREINO EM ANDAMENTO
      </Text>
      <Text
        accessibilityRole="header"
        style={[typography.titleXL, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      <View style={s.progressRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[typography.bodyMD, { color: colors.textSecondary }]}>
            {exerciseLabel}
          </Text>
          <View style={[s.track, { backgroundColor: "#23374F" }]}>
            <View
              style={[
                s.fill,
                { backgroundColor: colors.primary, width: `${percent}%` },
              ]}
            />
          </View>
        </View>
        <View
          style={[
            s.badge,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          <Text style={[typography.titleMD, { color: colors.textPrimary }]}>
            {percent}%
          </Text>
          <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
            das séries
          </Text>
        </View>
      </View>
    </View>
  );
}

function Section({
  icon,
  iconColor,
  title,
  right,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  right?: ReactNode;
}) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={s.sectionHead}>
      <View style={s.row}>
        <Ionicons name={icon} size={20} color={iconColor} />
        {/* Uppercase captions double as stable E2E anchors (PLANEJADO / REALIZADO). */}
        <Text
          style={[
            typography.titleMD,
            { color: colors.textPrimary, letterSpacing: 1 },
          ]}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Planned targets of the current set (never edited here). */
export function PlannedInfoGrid({
  set,
  setCount,
}: {
  set: WorkoutSet;
  setCount: number;
}) {
  const { colors, typography } = useAppTheme();
  const items: { label: string; value: string; icon: IconName }[] = [
    { label: "Séries", value: String(setCount), icon: "layers-outline" },
    {
      label:
        set.plannedMetric === "reps"
          ? "Reps"
          : unit[set.plannedMetric] === "s"
            ? "Segundos"
            : "Metros",
      value: range(set.plannedTargetMin, set.plannedTargetMax),
      icon: "repeat-outline",
    },
    {
      label: "RIR",
      value:
        set.plannedRirMin === null
          ? "—"
          : range(set.plannedRirMin, set.plannedRirMax!),
      icon: "speedometer-outline",
    },
    {
      label: "Descanso",
      value:
        set.plannedRestMinSeconds === null
          ? "—"
          : formatRest(set.plannedRestMinSeconds, set.plannedRestMaxSeconds!),
      icon: "timer-outline",
    },
  ];
  return (
    <View style={{ gap: 14 }}>
      <Section
        icon="locate-outline"
        iconColor={colors.primary}
        title="PLANEJADO"
      />
      <View style={s.grid4}>
        {items.map((item) => (
          <View
            key={item.label}
            style={[
              s.info,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name={item.icon} size={16} color={colors.primary} />
            <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
              {item.label}
            </Text>
            <Text
              style={[typography.titleMD, { color: colors.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      {set.plannedLoadKind === "absolute" ? (
        <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
          Carga planejada: {set.plannedLoadKg} kg
        </Text>
      ) : set.plannedLoadKind === "athlete_selected" ? (
        <Text style={[typography.bodySM, { color: colors.textMuted }]}>
          Carga: você escolhe pelo RIR planejado.
        </Text>
      ) : null}
    </View>
  );
}

/** Editable value with − / + steppers. */
export function StepperField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  decimal,
  testID,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  step: number;
  min: number;
  max?: number;
  decimal?: boolean;
  testID: string;
  accessibilityLabel: string;
}) {
  const { colors, fonts, typography } = useAppTheme();
  const bump = (direction: 1 | -1) => {
    const current = Number(value.replace(",", "."));
    const base =
      Number.isFinite(current) && value !== ""
        ? current
        : direction > 0
          ? min - step
          : min;
    const next = Math.min(
      max ?? Infinity,
      Math.max(min, Math.round((base + direction * step) * 100) / 100),
    );
    onChange(String(next));
  };
  return (
    <View
      style={[
        s.input,
        { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
      ]}
    >
      <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        value={value}
        onChangeText={onChange}
        placeholder="–"
        placeholderTextColor={colors.textMuted}
        style={[
          s.inputText,
          { color: colors.textPrimary, fontFamily: fonts.bold },
        ]}
      />
      <View style={s.steppers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diminuir ${label}`}
          onPress={() => bump(-1)}
          hitSlop={6}
          style={[s.step, { borderColor: colors.border }]}
        >
          <Ionicons name="remove" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${label}`}
          onPress={() => bump(1)}
          hitSlop={6}
          style={[s.step, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export function PerformedHeader({ label }: { label: string }) {
  const { colors, typography } = useAppTheme();
  return (
    <Section
      icon="checkmark-circle"
      iconColor={colors.success}
      title="REALIZADO"
      right={
        <Text style={[typography.bodyMD, { color: colors.textSecondary }]}>
          {label}
        </Text>
      }
    />
  );
}

/** One circle per set: done, skipped, current or pending. Tap to review. */
export function SetHistoryTracker({
  sets,
  currentSetId,
  onSelect,
}: {
  sets: readonly WorkoutSet[];
  currentSetId: string;
  onSelect(setId: string): void;
}) {
  const { colors, fonts, typography } = useAppTheme();
  return (
    <View style={s.history}>
      {sets.map((set) => {
        const current = set.id === currentSetId;
        const done = set.status === "completed";
        const skipped = set.status === "skipped";
        return (
          <Pressable
            key={set.id}
            accessibilityRole="button"
            accessibilityLabel={`Série ${set.sequence}${done ? ", concluída" : skipped ? ", pulada" : ""}`}
            onPress={() => onSelect(set.id)}
            style={s.historyItem}
          >
            <View
              style={[
                s.circle,
                {
                  borderColor: current
                    ? colors.primary
                    : done
                      ? colors.success
                      : "#415875",
                  backgroundColor: done
                    ? "rgba(25,226,122,0.12)"
                    : "transparent",
                  shadowColor: colors.primary,
                  shadowOpacity: current ? 0.6 : 0,
                },
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={20} color={colors.success} />
              ) : (
                <Text
                  style={[typography.titleMD, { color: colors.textPrimary }]}
                >
                  {set.sequence}
                </Text>
              )}
            </View>
            <Text
              style={[
                typography.bodySM,
                { color: colors.textSecondary, fontFamily: fonts.semibold },
              ]}
            >
              {done
                ? `${set.actualValue} ${unit[set.plannedMetric]}`
                : skipped
                  ? "pulada"
                  : "–"}
            </Text>
            {done && set.actualLoadKg !== null ? (
              <Text style={[typography.bodySM, { color: colors.textMuted }]}>
                {set.actualLoadKg} kg
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact list of the session's other exercises. */
export function UpcomingExerciseList({
  exercises,
  onSelect,
}: {
  exercises: readonly WorkoutExercise[];
  onSelect(exerciseId: string): void;
}) {
  const { colors, typography } = useAppTheme();
  if (!exercises.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {exercises.map((exercise) => {
        const first = exercise.sets[0];
        const finished = exercise.sets.every((set) => set.status !== "pending");
        const summary = first
          ? [
              `${exercise.sets.length} ${exercise.sets.length === 1 ? "série" : "séries"}`,
              `${range(first.plannedTargetMin, first.plannedTargetMax)} ${unit[first.plannedMetric]}`,
              first.plannedRirMin !== null
                ? `RIR ${range(first.plannedRirMin, first.plannedRirMax!)}`
                : null,
              first.plannedRestMinSeconds !== null
                ? formatRest(
                    first.plannedRestMinSeconds,
                    first.plannedRestMaxSeconds!,
                  )
                : null,
            ]
              .filter(Boolean)
              .join(" • ")
          : "Sem séries";
        return (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            onPress={() => onSelect(exercise.id)}
            style={[
              s.upcoming,
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
                name={finished ? "checkmark-done" : "barbell-outline"}
                size={24}
                color={finished ? colors.success : colors.primary}
              />
            </LinearGradient>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  typography.titleMD,
                  { color: colors.textPrimary, fontSize: 16 },
                ]}
                numberOfLines={1}
              >
                {exercise.exerciseName}
              </Text>
              <Text
                style={[typography.bodySM, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {summary}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#AFC0D8" />
          </Pressable>
        );
      })}
    </View>
  );
}

export const runnerStyles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    elevation: 8,
    gap: 18,
    padding: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  divider: { height: 1 },
  exerciseHead: { alignItems: "center", flexDirection: "row", gap: 14 },
  exerciseArt: {
    alignItems: "center",
    borderRadius: 14,
    height: 84,
    justifyContent: "center",
    width: 96,
  },
  grid3: { flexDirection: "row", gap: 10 },
  rest: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  bottom: { flexDirection: "row", gap: 12 },
  secondary: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 58,
    justifyContent: "center",
  },
});
const s = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logo: {
    alignItems: "center",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  logoText: { color: "#FFFFFF", fontSize: 20 },
  brand: { fontSize: 18, lineHeight: 22 },
  timer: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { borderRadius: 4, height: 8, width: 8 },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
  },
  track: { borderRadius: 999, height: 8, overflow: "hidden" },
  fill: { borderRadius: 999, height: 8 },
  badge: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  grid4: { flexDirection: "row", gap: 8 },
  info: { borderRadius: 16, borderWidth: 1, flex: 1, gap: 4, padding: 10 },
  input: { borderRadius: 16, borderWidth: 1, flex: 1, gap: 4, padding: 12 },
  inputText: { fontSize: 24, minHeight: 34, padding: 0 },
  steppers: { flexDirection: "row", gap: 8 },
  step: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 34,
  },
  history: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "space-between",
  },
  historyItem: { alignItems: "center", gap: 4, minWidth: 56 },
  circle: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    width: 48,
  },
  upcoming: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 84,
    padding: 12,
  },
  thumb: {
    alignItems: "center",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    width: 68,
  },
});
