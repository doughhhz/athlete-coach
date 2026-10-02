import {
  deriveWeekPlan,
  estimateTrainingDayMinutes,
  highlightedWeekPlanDay,
  workoutExerciseProgress,
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
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  ExerciseList,
  GradientButton,
  HeroWorkoutCard,
  SectionHeader,
  TreinoHeader,
  WeekPlanRow,
} from "./treino/treino-components";

const labels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado (retirado)",
} as const;
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
  const highlighted = highlightedWeekPlanDay(week);
  const selected: WeekPlanDay | null =
    week.find((day) => day.date === selectedDate) ?? highlighted;
  const trainingDay = selected?.trainingDay ?? null;
  const workout = data?.workout ?? null;
  const progress =
    workout && trainingDay && workout.sourceTrainingDayId === trainingDay.id
      ? workoutExerciseProgress(workout)
      : null;

  async function start(dayId: string) {
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
        <TreinoHeader onOpenPersonal={() => router.push("/personal" as Href)} />
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
                        onPress={() => void start(trainingDay.id)}
                        testID="training-start-workout"
                      />
                    )
                  }
                />
              ) : data.active && selected ? (
                <HeroWorkoutCard
                  caption={selected.isToday ? "HOJE" : "DESCANSO"}
                  title="Dia de descanso"
                  description="Nenhum treino planejado para este dia no seu programa ativo."
                  stats={[]}
                  action={null}
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

            <Entrance index={4} style={s.section}>
              <SectionHeader
                icon="albums-outline"
                title="Meus programas"
                right={
                  <Link href={"/programs/new" as Href} asChild>
                    <Pressable
                      testID="training-create-program"
                      style={StyleSheet.flatten([
                        s.smallButton,
                        { borderColor: colors.borderGlow },
                      ])}
                    >
                      <Text
                        style={[
                          typography.bodySM,
                          {
                            color: colors.primary,
                            fontFamily: theme.fonts.semibold,
                          },
                        ]}
                      >
                        Criar programa
                      </Text>
                    </Pressable>
                  </Link>
                }
              />
              {/* The Personal builds a program from everything the athlete informed. */}
              <Link href={"/initial-program" as Href} asChild>
                <Pressable testID="training-initial-program" style={s.inline}>
                  <Ionicons
                    name="sparkles-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      typography.bodyMD,
                      s.link,
                      { color: colors.primary },
                    ]}
                  >
                    Pedir um programa ao Personal
                  </Text>
                </Pressable>
              </Link>
              {!data.items.length ? (
                <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
                  Nenhum programa criado. Peça um ao Personal ou comece por um
                  rascunho manual.
                </Text>
              ) : null}
              {!data.active && data.items.length ? (
                <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
                  Você ainda não possui um programa de treino ativo.
                </Text>
              ) : null}
              {data.items.map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.id}` as Href}
                  asChild
                >
                  <Pressable
                    style={StyleSheet.flatten([
                      s.card,
                      {
                        backgroundColor: colors.surfaceCard,
                        borderColor: colors.border,
                      },
                    ])}
                  >
                    <View style={s.cardRow}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.titleMD,
                          s.flex,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {program.name}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          {
                            color:
                              program.status === "active"
                                ? colors.success
                                : colors.primary,
                          },
                        ]}
                      >
                        {labels[program.status]}
                      </Text>
                    </View>
                    <Text
                      style={[typography.bodySM, { color: colors.textMuted }]}
                    >
                      Revisão {program.revision} · {program.blockCount} bloco(s)
                      · {program.weekCount} semana(s) · {program.dayCount}{" "}
                      dia(s)
                    </Text>
                  </Pressable>
                </Link>
              ))}
              <Link href={"/exercises" as Href} asChild>
                <Pressable
                  style={StyleSheet.flatten([
                    s.card,
                    {
                      backgroundColor: colors.surfaceCard,
                      borderColor: colors.border,
                    },
                  ])}
                >
                  <View style={s.cardRow}>
                    <Ionicons
                      name="library-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        typography.titleMD,
                        s.flex,
                        { color: colors.textPrimary },
                      ]}
                    >
                      Biblioteca de exercícios
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[typography.bodySM, { color: colors.textMuted }]}
                  >
                    Consulte o catálogo canônico de movimentos.
                  </Text>
                </Pressable>
              </Link>
            </Entrance>

            <Entrance index={5} style={s.section}>
              <SectionHeader icon="time-outline" title="Histórico de treinos" />
              {!data.history.length ? (
                <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
                  Nenhum treino finalizado.
                </Text>
              ) : (
                data.history.map((item) => (
                  <Link
                    key={item.id}
                    href={`/workouts/${item.id}/summary` as Href}
                    asChild
                  >
                    <Pressable
                      style={StyleSheet.flatten([
                        s.card,
                        {
                          backgroundColor: colors.surfaceCard,
                          borderColor: colors.border,
                        },
                      ])}
                    >
                      <Text
                        style={[
                          typography.titleMD,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {item.dayName}
                      </Text>
                      <Text
                        style={[typography.bodySM, { color: colors.textMuted }]}
                      >
                        {new Date(item.startedAt).toLocaleString()} ·{" "}
                        {item.status === "completed"
                          ? "Concluído"
                          : "Abandonado"}
                      </Text>
                    </Pressable>
                  </Link>
                ))
              )}
            </Entrance>
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
