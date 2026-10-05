import {
  deriveWeekPlan,
  estimateTrainingDayMinutes,
  highlightedWeekPlanDay,
  workoutExerciseProgress,
  startedToday,
  type TrainingProgram,
  type TrainingProgramSummary,
  type WeekPlanDay,
  type WorkoutSession,
  type WorkoutSessionSummary,
} from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSession } from "@/presentation/auth/app-session";
import { Entrance } from "@/presentation/components/motion";
import { ScreenBackground } from "@/presentation/components/screen-background";
import { OpenWorkoutNotice } from "@/presentation/training/open-workout-notice";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  ExerciseList,
  GradientButton,
  HeroWorkoutCard,
  SectionHeader,
  TreinoHeader,
  WeekPlanRow,
} from "./treino/treino-components";

const WEEKDAY_LONG = [
  "",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
];

type Data = Readonly<{
  items: readonly TrainingProgramSummary[];
  active: TrainingProgram | null;
  workout: WorkoutSession | null;
  history: readonly WorkoutSessionSummary[];
}>;

function OutlineAction({ label, onPress }: { label: string; onPress(): void }) {
  const { colors, typography, fonts } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.continue, { borderColor: colors.borderGlow }]}
    >
      <Text
        style={[
          typography.bodyLG,
          { color: colors.textPrimary, fontFamily: fonts.semibold },
        ]}
      >
        {label}
      </Text>
      <Ionicons name="arrow-forward" size={18} color={colors.primary} />
    </Pressable>
  );
}

/**
 * Treino tab (design 2026-10-01, dark minimal neon). Facts only: the week,
 * the duration estimate and the progress come from the domain.
 */
export function TrainingProgramsScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const { colors, typography } = theme;
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [selectedDate, setSelectedDate] = useState<string | null>(null),
    [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    Promise.all([
      app.listPrograms(),
      app.getActiveProgram(),
      app.getInProgressWorkout(),
      app.listWorkouts(),
    ])
      .then(([items, current, workout, history]) => {
        if (active) setData({ items, active: current, workout, history });
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar os programas.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app]);
  // Refresh when the tab regains focus (e.g. after finishing a workout).
  useFocusEffect(load);

  const timeZone =
    app.snapshot?.profile?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const week = useMemo(
    () =>
      data
        ? deriveWeekPlan({
            program: data.active,
            sessions: data.history,
            now: new Date(),
            timeZone,
          })
        : [],
    [data, timeZone],
  );
  // Today is shown by default; another day only when the athlete picks it.
  const today = week.find((day) => day.isToday) ?? null;
  const selected: WeekPlanDay | null =
    week.find((day) => day.date === selectedDate) ?? today;
  // Next planned day after today (for the rest-day card).
  const next = highlightedWeekPlanDay(week);
  const nextPlanned = next && next.date !== today?.date ? next : null;
  const hasWeekdays = week.some((day) => day.trainingDay !== null);
  const trainingDay = selected?.trainingDay ?? null;
  // Only a workout started today replaces today's plan (ADR-0127).
  const openWorkout = data?.workout ?? null;
  const workout =
    openWorkout && startedToday(openWorkout, new Date(), timeZone)
      ? openWorkout
      : null;
  const staleWorkout = openWorkout && !workout ? openWorkout : null;
  const progress =
    workout && trainingDay && workout.sourceTrainingDayId === trainingDay.id
      ? workoutExerciseProgress(workout)
      : null;

  // The database returns the open workout when one exists: an earlier
  // open workout must be ended first (its records stay saved, ADR-0127).
  function start(dayId: string) {
    if (!staleWorkout) return void begin(dayId);
    Alert.alert(
      "Treino anterior em aberto",
      `O treino "${staleWorkout.dayName}" ainda não foi finalizado. Encerre-o para iniciar o de hoje; o que você registrou nele fica salvo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abrir treino anterior",
          onPress: () => router.push(`/workouts/${staleWorkout.id}` as Href),
        },
        {
          text: "Encerrar e iniciar",
          style: "destructive",
          onPress: async () => {
            try {
              await app.abandonWorkout(staleWorkout.id);
              await begin(dayId);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Não foi possível encerrar o treino anterior.",
              );
            }
          },
        },
      ],
    );
  }
  async function begin(dayId: string) {
    setStarting(true);
    setError(null);
    try {
      const started = await app.startWorkout(dayId);
      router.push(`/workouts/${started.id}` as Href);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível iniciar o treino.",
      );
    } finally {
      setStarting(false);
    }
  }

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={[
          s.page,
          { paddingTop: insets.top + theme.spacing.screenTop },
        ]}
      >
        <TreinoHeader onOpenPrograms={() => router.push("/programs" as Href)} />
        <View style={s.intro}>
          <Text
            accessibilityRole="header"
            style={[typography.titleXL, { color: colors.textPrimary }]}
          >
            {selected?.isToday || !selected
              ? "Seu treino de hoje"
              : `Treino de ${WEEKDAY_LONG[selected.weekday]}`}
          </Text>
          <Text style={[typography.bodyLG, { color: colors.textSecondary }]}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          </Text>
        </View>

        {loading && !data ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 24 }} />
        ) : null}
        {error ? (
          <View style={s.errorBox}>
            <Text style={[typography.bodyMD, { color: colors.danger }]}>
              {error}
            </Text>
            <Pressable onPress={load}>
              <Text
                style={[typography.bodyMD, s.link, { color: colors.primary }]}
              >
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={s.activeLine}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Programa ativo
              </Text>
              {data.active ? (
                <Text
                  numberOfLines={1}
                  style={[typography.bodyMD, { color: colors.textSecondary }]}
                  testID="training-active-program-name"
                >
                  {data.active.name}
                </Text>
              ) : null}
            </View>

            <Entrance index={1}>
              {workout ? (
                <HeroWorkoutCard
                  caption="EM ANDAMENTO"
                  title={workout.dayName}
                  description={workout.programName}
                  stats={[
                    {
                      icon: "checkmark-done-outline",
                      label: "PROGRESSO",
                      value: `${workoutExerciseProgress(workout).finished} de ${workoutExerciseProgress(workout).total}`,
                    },
                  ]}
                  action={
                    <Link href={`/workouts/${workout.id}` as Href} asChild>
                      <Pressable
                        accessibilityRole="button"
                        style={StyleSheet.flatten([
                          s.continue,
                          { borderColor: colors.borderGlow },
                        ])}
                      >
                        <Text
                          style={[
                            typography.titleMD,
                            { color: colors.textPrimary },
                          ]}
                        >
                          Continuar treino
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={20}
                          color={colors.primary}
                        />
                      </Pressable>
                    </Link>
                  }
                />
              ) : data.active && trainingDay && selected ? (
                <HeroWorkoutCard
                  caption={`${WEEKDAY_LONG[selected.weekday]!.toUpperCase()}${selected.isToday ? " · HOJE" : ""}`}
                  title={trainingDay.name}
                  description={trainingDay.notes}
                  stats={[
                    {
                      icon: "time-outline",
                      label: "DURAÇÃO",
                      value: `~ ${estimateTrainingDayMinutes(trainingDay)} min`,
                    },
                    {
                      icon: "layers-outline",
                      label: "SÉRIES",
                      value: String(
                        trainingDay.prescriptions.reduce(
                          (total, item) => total + item.sets.length,
                          0,
                        ),
                      ),
                    },
                    {
                      icon: "barbell-outline",
                      label: "EXERCÍCIOS",
                      value: progress
                        ? `${progress.finished} de ${progress.total}`
                        : String(trainingDay.prescriptions.length),
                    },
                  ]}
                  action={
                    selected.status === "done" ? (
                      <Text
                        style={[typography.bodyMD, { color: colors.success }]}
                      >
                        Treino feito neste dia.
                      </Text>
                    ) : (
                      <GradientButton
                        label="Iniciar treino"
                        busy={starting}
                        onPress={() => start(trainingDay.id)}
                        testID="training-start-workout"
                      />
                    )
                  }
                />
              ) : data.active && !hasWeekdays ? (
                <HeroWorkoutCard
                  caption="PROGRAMA ATIVO"
                  title="Dias da semana não definidos"
                  description="Os dias do seu programa ainda não têm dia da semana. Defina no editor do programa para ver o treino de cada dia aqui."
                  stats={[]}
                  action={
                    <OutlineAction
                      label="Ver programa"
                      onPress={() =>
                        router.push(`/programs/${data.active!.id}` as Href)
                      }
                    />
                  }
                />
              ) : data.active && selected ? (
                <HeroWorkoutCard
                  caption={
                    selected.isToday
                      ? "HOJE · DESCANSO"
                      : `${WEEKDAY_LONG[selected.weekday]!.toUpperCase()} · DESCANSO`
                  }
                  title={
                    selected.isToday
                      ? "Hoje é dia de descanso"
                      : "Dia de descanso"
                  }
                  description={
                    nextPlanned?.trainingDay
                      ? `Nenhum treino planejado para este dia. Próximo treino: ${WEEKDAY_LONG[nextPlanned.weekday]} — ${nextPlanned.trainingDay.name}.`
                      : "Nenhum treino planejado para este dia no seu programa ativo."
                  }
                  stats={[]}
                  action={
                    nextPlanned && selected.isToday ? (
                      <OutlineAction
                        label={`Ver treino de ${WEEKDAY_LONG[nextPlanned.weekday]}`}
                        onPress={() => setSelectedDate(nextPlanned.date)}
                      />
                    ) : null
                  }
                />
              ) : (
                <HeroWorkoutCard
                  caption="COMECE AQUI"
                  title="Seu primeiro programa"
                  description="Você ainda não possui um programa de treino ativo. O Personal pode montar um com base no seu perfil."
                  stats={[]}
                  action={
                    <GradientButton
                      label="Montar com o Personal"
                      onPress={() => router.push("/initial-program" as Href)}
                      testID="training-hero-initial-program"
                    />
                  }
                />
              )}
            </Entrance>
            {staleWorkout ? (
              <OpenWorkoutNotice workout={staleWorkout} timeZone={timeZone} />
            ) : null}

            {data.active ? (
              <Entrance index={2} style={s.section}>
                <SectionHeader
                  icon="calendar-outline"
                  title="Plano da semana"
                  right={
                    <Link href={`/programs/${data.active.id}` as Href} asChild>
                      <Pressable style={s.inline}>
                        <Text
                          style={[
                            typography.bodyMD,
                            s.link,
                            { color: colors.primary },
                          ]}
                        >
                          Ver alvos planejados
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.primary}
                        />
                      </Pressable>
                    </Link>
                  }
                />
                <WeekPlanRow
                  week={week}
                  selectedDate={selected?.date ?? null}
                  onSelect={(day) => setSelectedDate(day.date)}
                />
              </Entrance>
            ) : null}

            {data.active && trainingDay ? (
              <Entrance index={3} style={s.section}>
                <SectionHeader
                  icon="barbell-outline"
                  title="Exercícios do treino"
                  right={
                    <Text
                      style={[
                        typography.bodyMD,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {trainingDay.prescriptions.length} exercícios
                    </Text>
                  }
                />
                <ExerciseList
                  day={trainingDay}
                  onOpen={() =>
                    router.push(`/programs/${data.active!.id}` as Href)
                  }
                />
              </Entrance>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 24, paddingBottom: 48, paddingHorizontal: 20 },
  intro: { gap: 4 },
  activeLine: { gap: 2, marginBottom: -12 },
  errorBox: { gap: 8 },
  section: { gap: 14 },
  inline: { alignItems: "center", flexDirection: "row", gap: 6 },
  link: { fontWeight: "600" },
  continue: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 58,
    justifyContent: "center",
  },
  smallButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  card: { borderRadius: 18, borderWidth: 1, gap: 6, padding: 14 },
  cardRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
