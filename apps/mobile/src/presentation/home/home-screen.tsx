import {
  countRecentCompletedWorkouts,
  deriveWeekPlan,
  estimateTrainingDayMinutes,
  highlightedWeekPlanDay,
  summarizeWeekPlan,
  weightGoalDifferenceKg,
  workoutExerciseProgress,
  type TrainingProgram,
  type WorkoutSession,
  type WorkoutSessionSummary,
} from "@athlete-coach/domain";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSession } from "@/presentation/auth/app-session";
import { BrandHeader } from "@/presentation/components/brand-header";
import { GradientButton } from "@/presentation/components/gradient-button";
import { Entrance } from "@/presentation/components/motion";
import { ScreenBackground } from "@/presentation/components/screen-background";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  GreetingSection,
  OutlineButton,
  ProfileSummaryCard,
  QuickAccessGrid,
  StatsGrid,
  TodayWorkoutCard,
  TrainerCard,
  type StatItem,
} from "./home-components";

const goalLabels = {
  hypertrophy: "Ganho de massa",
  fat_loss: "Redução de gordura",
  recomposition: "Recomposição corporal",
  strength: "Força",
  general_fitness: "Condicionamento geral",
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
const kg = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

type Data = Readonly<{
  active: TrainingProgram | null;
  workout: WorkoutSession | null;
  history: readonly WorkoutSessionSummary[];
}>;

/**
 * Home (design ADR-0120/0121): greeting, profile summary, today's workout,
 * facts and shortcuts. Every number is recorded or computed by the domain.
 */
export function HomeScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const { colors, typography } = theme;
  const snapshot = app.snapshot;
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState<string | null>(null),
    [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    Promise.all([
      app.getActiveProgram(),
      app.getInProgressWorkout(),
      app.listWorkouts(),
    ])
      .then(([program, workout, history]) => {
        if (active) setData({ active: program, workout, history });
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar seu treino.",
          );
      });
    return () => {
      active = false;
    };
  }, [app]);
  useFocusEffect(load);

  if (!snapshot?.profile)
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[typography.bodyLG, { color: colors.textPrimary }]}>
          Perfil indisponível. Tente novamente.
        </Text>
      </View>
    );

  const timeZone = snapshot.profile.timezone;
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
  const [greeting, greetingIcon] =
    hour < 12
      ? (["Bom dia", "sunny"] as const)
      : hour < 18
        ? (["Boa tarde", "partly-sunny"] as const)
        : (["Boa noite", "moon"] as const);

  const week = data
    ? deriveWeekPlan({
        program: data.active,
        sessions: data.history,
        now,
        timeZone,
      })
    : [];
  const highlighted = highlightedWeekPlanDay(week);
  const trainingDay = highlighted?.trainingDay ?? null;
  const weekSummary = summarizeWeekPlan(week);
  const workout = data?.workout ?? null;
  const goal = snapshot.activeGoal;
  const latest = snapshot.latestWeight;
  const difference = weightGoalDifferenceKg(
    latest?.weightKg ?? null,
    goal?.targetWeightKg ?? null,
  );
  const context = snapshot.trainingContext;

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

  const stats: StatItem[] = data
    ? [
        data.active
          ? {
              title: "Treinos na semana",
              value: `${weekSummary.done}/${weekSummary.planned}`,
              detail: "feitos / planejados",
              icon: "stats-chart-outline",
              progress: weekSummary.planned
                ? weekSummary.done / weekSummary.planned
                : 0,
            }
          : {
              title: "Treinos na semana",
              value: String(weekSummary.done),
              detail: "sem programa ativo",
              icon: "stats-chart-outline",
            },
        {
          title: "Últimos 28 dias",
          value: String(countRecentCompletedWorkouts(data.history, now)),
          detail: "treinos concluídos",
          icon: "calendar-outline",
        },
        difference === null
          ? {
              title: "Meta de peso",
              value: "—",
              detail: goal?.targetWeightKg
                ? "registre seu peso no perfil"
                : "sem peso-alvo definido",
              icon: "flag-outline",
            }
          : {
              title: "Meta de peso",
              value: `${difference > 0 ? "+" : ""}${kg(difference)}`,
              detail: `até o peso-alvo de ${kg(goal!.targetWeightKg!)}`,
              icon: "flag-outline",
            },
        trainingDay
          ? {
              title: "Duração do treino",
              value: `~ ${estimateTrainingDayMinutes(trainingDay)} min`,
              detail: "estimativa do sistema",
              icon: "time-outline",
            }
          : {
              title: "Duração do treino",
              value: "—",
              detail: "nenhum treino planejado",
              icon: "time-outline",
            },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={[
          s.page,
          { paddingTop: insets.top + theme.spacing.screenTop },
        ]}
      >
        <BrandHeader subtitle="Seu personal com IA" />
        <GreetingSection
          greeting={greeting}
          name={snapshot.profile.preferredName}
          icon={greetingIcon}
          onOpenProfile={() => router.push("/profile" as Href)}
        />
        <Entrance index={1}>
          <ProfileSummaryCard
            goal={goal ? goalLabels[goal.goalType] : "Nenhum objetivo ativo"}
            goalDetail={
              context
                ? `${context.resistanceTrainingMonths} meses de treino · ${snapshot.availableWeekdays.length} dias/semana`
                : "Complete seu perfil"
            }
            weight={latest ? kg(latest.weightKg) : "—"}
            weightDetail={
              latest
                ? `em ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone }).format(new Date(latest.measuredAt))}`
                : "ainda não informado"
            }
          />
        </Entrance>

        {error ? (
          <Text style={[typography.bodyMD, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
        {!data && !error ? <ActivityIndicator color={colors.primary} /> : null}

        {data ? (
          <Entrance index={2}>
            {workout ? (
              <TodayWorkoutCard
                caption="TREINO EM ANDAMENTO"
                title={workout.dayName}
                subtitle={workout.programName}
                progress={workoutExerciseProgress(workout)}
                action={
                  <GradientButton
                    label="Continuar treino"
                    onPress={() =>
                      router.push(`/workouts/${workout.id}` as Href)
                    }
                    testID="home-continue-workout"
                  />
                }
              />
            ) : data.active && trainingDay && highlighted ? (
              <TodayWorkoutCard
                caption={
                  highlighted.isToday
                    ? "TREINO DE HOJE"
                    : `PRÓXIMO TREINO · ${WEEKDAY_LONG[highlighted.weekday]!.toUpperCase()}`
                }
                title={trainingDay.name}
                subtitle={trainingDay.notes}
                progress={{
                  finished: 0,
                  total: trainingDay.prescriptions.length,
                }}
                action={
                  <GradientButton
                    label="Começar treino"
                    busy={starting}
                    onPress={() => void start(trainingDay.id)}
                    testID="home-start-workout"
                  />
                }
              />
            ) : data.active ? (
              <TodayWorkoutCard
                caption="ESTA SEMANA"
                title="Treinos da semana concluídos"
                subtitle="Nenhum treino planejado restante. Veja o plano completo na aba Treino."
                progress={null}
                action={
                  <OutlineButton
                    label="Ver plano"
                    onPress={() => router.push("/treino" as Href)}
                  />
                }
              />
            ) : (
              <TodayWorkoutCard
                caption="COMECE AQUI"
                title="Seu primeiro programa"
                subtitle="O Personal monta um programa com base no seu perfil. Você revisa antes de ativar."
                progress={null}
                action={
                  <GradientButton
                    label="Montar com o Personal"
                    onPress={() => router.push("/initial-program" as Href)}
                    testID="home-initial-program"
                  />
                }
              />
            )}
          </Entrance>
        ) : null}

        {stats.length ? (
          <Entrance index={3}>
            <StatsGrid items={stats} />
          </Entrance>
        ) : null}
        <Entrance index={4}>
          <TrainerCard onOpen={() => router.push("/personal" as Href)} />
        </Entrance>
        <Entrance index={5}>
          <QuickAccessGrid
            items={[
              {
                title: "Treino",
                subtitle: "Ver treinos",
                icon: "barbell-outline",
                onPress: () => router.push("/treino" as Href),
              },
              {
                title: "Nutrição",
                subtitle: "Em construção",
                icon: "restaurant-outline",
                onPress: () => router.push("/nutricao" as Href),
              },
              {
                title: "Progresso",
                subtitle: "Ver evolução",
                icon: "stats-chart-outline",
                onPress: () => router.push("/progresso" as Href),
              },
              {
                title: "Perfil",
                subtitle: "Seus dados",
                icon: "person-outline",
                onPress: () => router.push("/profile" as Href),
              },
            ]}
          />
        </Entrance>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 18, paddingBottom: 48, paddingHorizontal: 20 },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});
