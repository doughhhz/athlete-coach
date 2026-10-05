import {
  currentWorkoutPosition,
  selectableWorkoutSetIds,
  workoutDurationSeconds,
  workoutSetProgress,
  type SetAssessment,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutSet,
} from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { GradientButton } from "@/presentation/components/gradient-button";
import { ScreenBackground } from "@/presentation/components/screen-background";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  clock,
  PerformedHeader,
  PlannedInfoGrid,
  runnerStyles as r,
  SessionProgress,
  SetHistoryTracker,
  StepperField,
  ExerciseOrderList,
  RestCountdown,
  WorkoutSessionHeader,
} from "./runner/runner-components";
import { SetAssessmentCard } from "./runner/set-assessment-card";

const bySequence = <T extends { sequence: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.sequence - b.sequence);

/** Values typed for a set: its own record, else the previous done set. */
function initialValues(exercise: WorkoutExercise, set: WorkoutSet) {
  const source =
    set.status === "completed"
      ? set
      : bySequence(exercise.sets)
          .filter(
            (item) =>
              item.sequence < set.sequence && item.status === "completed",
          )
          .at(-1);
  return {
    value: source?.actualValue?.toString() ?? "",
    load: source?.actualLoadKg?.toString() ?? "",
    rir: source?.actualRir?.toString() ?? "",
  };
}

/** Records one set: inputs with steppers, the main CTA and skip. */
function PerformedEditor({
  session,
  exercise,
  set,
  onSaved,
}: {
  session: WorkoutSession;
  exercise: WorkoutExercise;
  set: WorkoutSet;
  /** The saved set id starts its rest timer; null = no timer. */
  onSaved(
    next: WorkoutSession,
    restSetId: string | null,
    recordedSetId?: string,
  ): void;
}) {
  const app = useAppSession(),
    { colors, typography } = useAppTheme();
  const initial = initialValues(exercise, set);
  const [value, setValue] = useState(initial.value),
    [load, setLoad] = useState(initial.load),
    [rir, setRir] = useState(initial.rir),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const metric =
    set.plannedMetric === "reps"
      ? "Reps"
      : set.plannedMetric === "seconds"
        ? "Segundos"
        : "Metros";
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await app.recordWorkoutSet(session.id, set.id, {
        actualValue: Number(value.replace(",", ".")),
        actualLoadKg: load === "" ? null : Number(load.replace(",", ".")),
        actualRir: rir === "" ? null : Number(rir),
        restStartedAt:
          set.plannedRestMaxSeconds === null ? null : new Date().toISOString(),
      });
      onSaved(next, set.status === "completed" ? null : set.id, set.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha ao salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (set.status === "skipped")
    return (
      <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
        Série pulada. Toque em outra série para continuar.
      </Text>
    );
  return (
    <View style={{ gap: 14 }}>
      <View style={r.grid3}>
        <StepperField
          label={metric}
          value={value}
          onChange={setValue}
          step={1}
          min={1}
          decimal={set.plannedMetric !== "reps"}
          testID="workout-set-value"
          accessibilityLabel="Valor realizado"
        />
        <StepperField
          label="KG"
          value={load}
          onChange={setLoad}
          step={2.5}
          min={0}
          decimal
          testID="workout-set-load"
          accessibilityLabel="Carga em kg"
        />
        <StepperField
          label="RIR"
          value={rir}
          onChange={setRir}
          step={1}
          min={0}
          max={10}
          testID="workout-set-rir"
          accessibilityLabel="RIR realizado"
        />
      </View>
      <GradientButton
        label={set.status === "completed" ? "Corrigir série" : "Concluir série"}
        busy={saving}
        icon={set.status === "completed" ? "create-outline" : "arrow-forward"}
        onPress={() => void save()}
        testID="workout-set-complete"
      />
      {set.status === "pending" ? (
        <Pressable
          accessibilityRole="button"
          onPress={async () => onSaved(await app.skipWorkoutSet(set.id), null)}
          style={{ alignSelf: "center" }}
        >
          <Text
            style={[typography.bodyMD, { color: colors.textMuted, padding: 4 }]}
          >
            Pular série
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text style={[typography.bodyMD, { color: colors.danger }]}>
          {error} Os valores digitados foram preservados.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Workout in progress (design ADR-0122): one exercise and one set at a time,
 * planned separated from performed; facts only (timer = elapsed time).
 */
export function WorkoutRunnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const { colors, typography } = theme;
  const [session, setSession] = useState<WorkoutSession | null>(),
    [preferredExerciseId, setPreferredExerciseId] = useState<string | null>(
      null,
    ),
    [selectedSetId, setSelectedSetId] = useState<string | null>(null),
    [rest, setRest] = useState<{ startedAt: number; seconds: number } | null>(
      null,
    ),
    [now, setNow] = useState(0),
    [assessment, setAssessment] = useState<SetAssessment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const latestAssessment = useRef<string | null>(null);
  useEffect(() => {
    app
      .getWorkout(id)
      .then(setSession)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Erro ao carregar."),
      );
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [app, id]);

  if (session === undefined)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {error ? (
          <Text style={[typography.bodyLG, { color: colors.danger }]}>
            {error}
          </Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  if (!session)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[typography.bodyLG, { color: colors.textPrimary }]}>
          Treino não encontrado.
        </Text>
      </View>
    );

  const exercises = bySequence(session.exercises);
  const position = currentWorkoutPosition(session, preferredExerciseId);
  const exercise =
    exercises.find((item) => item.id === position?.exerciseId) ?? null;
  const sets = exercise ? bySequence(exercise.sets) : [];
  // A chosen set must be open under the domain rule (sets in order).
  const set =
    (exercise && selectableWorkoutSetIds(exercise).has(selectedSetId ?? "")
      ? sets.find((item) => item.id === selectedSetId)
      : undefined) ??
    sets.find((item) => item.id === position?.setId) ??
    null;
  const progress = workoutSetProgress(session);
  const pending = progress.total - progress.resolved;
  const exerciseIndex = exercise ? exercises.indexOf(exercise) : -1;
  const nextWithPending =
    exercises.find(
      (item, index) =>
        index > exerciseIndex && item.sets.some((x) => x.status === "pending"),
    ) ??
    exercises.find(
      (item) =>
        item !== exercise && item.sets.some((x) => x.status === "pending"),
    );
  const restLeft = rest
    ? Math.max(0, rest.seconds - Math.floor((now - rest.startedAt) / 1000))
    : 0;

  function apply(
    next: WorkoutSession,
    restSetId: string | null,
    recordedSetId?: string,
  ) {
    setSession(next);
    setSelectedSetId(null);
    // The Personal reads the recorded set (deterministic, ADR-0130). It is an
    // extra: the set is already saved, so a failure only hides the card.
    if (recordedSetId) {
      latestAssessment.current = recordedSetId;
      app
        .assessWorkoutSet(next, recordedSetId)
        .then((value) => {
          if (latestAssessment.current === recordedSetId) setAssessment(value);
        })
        .catch(() => {
          if (latestAssessment.current === recordedSetId) setAssessment(null);
        });
    }
    // Rest starts at the time the server recorded for the saved set.
    const saved = next.exercises
      .flatMap((item) => item.sets)
      .find((item) => item.id === restSetId);
    setRest(
      saved?.restStartedAt && saved.plannedRestMaxSeconds !== null
        ? {
            startedAt: Date.parse(saved.restStartedAt),
            seconds: saved.plannedRestMaxSeconds,
          }
        : null,
    );
  }
  function selectExercise(exerciseId: string) {
    setPreferredExerciseId(exerciseId);
    setSelectedSetId(null);
  }
  async function finish() {
    setBusy(true);
    setError(null);
    try {
      setSession(await app.completeWorkout(session!.id));
      router.replace(`/workouts/${id}/summary` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível finalizar.");
    } finally {
      setBusy(false);
    }
  }
  function skipExercise() {
    if (!exercise) return;
    const open = exercise.sets.filter((x) => x.status === "pending");
    if (!open.length) return;
    Alert.alert(
      "Pular exercício?",
      `${open.length} série(s) pendente(s) serão marcadas como puladas.`,
      [
        { text: "Voltar" },
        {
          text: "Pular",
          style: "destructive",
          onPress: async () => {
            let next = session!;
            for (const item of open) next = await app.skipWorkoutSet(item.id);
            apply(next, null);
            if (nextWithPending) selectExercise(nextWithPending.id);
          },
        },
      ],
    );
  }
  function openMenu() {
    Alert.alert("Treino", "O que você quer fazer?", [
      { text: "Continuar treinando", style: "cancel" },
      {
        text: "Encerrar sem concluir",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Encerrar sem concluir?",
            "A performance salva será preservada.",
            [
              { text: "Voltar" },
              {
                text: "Abandonar",
                style: "destructive",
                onPress: async () => {
                  await app.abandonWorkout(id);
                  router.replace(`/workouts/${id}/summary` as Href);
                },
              },
            ],
          ),
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackground />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
      >
        <WorkoutSessionHeader
          elapsedSeconds={
            now ? workoutDurationSeconds(session, new Date(now)) : 0
          }
          onBack={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/treino" as Href)
          }
          onMenu={openMenu}
        />
        <SessionProgress
          title={session.dayName}
          exerciseLabel={
            exercise
              ? `Exercício ${exerciseIndex + 1} de ${exercises.length}`
              : "Sem exercícios"
          }
          percent={progress.percent}
        />
        {session.status !== "in_progress" ? (
          <View style={{ gap: 12 }}>
            <Text style={[typography.bodyLG, { color: colors.textSecondary }]}>
              Este treino já foi encerrado.
            </Text>
            <GradientButton
              label="Ver resumo"
              onPress={() => router.replace(`/workouts/${id}/summary` as Href)}
            />
          </View>
        ) : exercise && set ? (
          // Re-enters (expands) whenever the current exercise changes.
          <Entrance
            key={exercise.id}
            style={[
              r.card,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.borderGlow,
                shadowColor: colors.borderGlow,
              },
            ]}
          >
            <View style={r.exerciseHead}>
              <LinearGradient
                colors={["rgba(30,220,255,0.25)", "rgba(29,92,255,0.08)"]}
                style={r.exerciseArt}
              >
                <Ionicons name="barbell" size={40} color={colors.primary} />
              </LinearGradient>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[typography.titleLG, { color: colors.textPrimary }]}
                >
                  {exercise.exerciseName}
                </Text>
                <Text
                  style={[typography.bodyMD, { color: colors.textSecondary }]}
                >
                  Exercício {exerciseIndex + 1} de {exercises.length}
                </Text>
              </View>
            </View>
            {exercise.plannedInstructions ? (
              <Text
                style={[
                  typography.bodySM,
                  { color: colors.textMuted, fontStyle: "italic" },
                ]}
                numberOfLines={3}
              >
                {exercise.plannedInstructions}
              </Text>
            ) : null}
            <View style={[r.divider, { backgroundColor: colors.divider }]} />
            <PlannedInfoGrid set={set} setCount={sets.length} />
            <View style={[r.divider, { backgroundColor: colors.divider }]} />
            <PerformedHeader
              label={`Série ${set.sequence} de ${sets.length}`}
              done={set.status === "completed"}
            />
            <PerformedEditor
              key={set.id}
              session={session}
              exercise={exercise}
              set={set}
              onSaved={apply}
            />
            {assessment &&
            exercise.sets.some(
              (item) => item.id === assessment.workoutSetId,
            ) ? (
              <SetAssessmentCard assessment={assessment} />
            ) : null}
            <SetHistoryTracker
              sets={sets}
              currentSetId={set.id}
              selectableIds={selectableWorkoutSetIds(exercise)}
              onSelect={setSelectedSetId}
            />
            {rest && restLeft > 0 ? (
              <RestCountdown
                secondsLeft={restLeft}
                onDismiss={() => setRest(null)}
              />
            ) : set.plannedRestMaxSeconds !== null ? (
              <View style={styles.hint}>
                <Ionicons
                  name="timer-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text
                  style={[typography.bodyMD, { color: colors.textSecondary }]}
                >
                  Descanse {clock(set.plannedRestMaxSeconds)} entre as séries
                </Text>
              </View>
            ) : null}
          </Entrance>
        ) : (
          <Text style={[typography.bodyLG, { color: colors.textSecondary }]}>
            Este treino não tem séries.
          </Text>
        )}

        {/* Fixed training order; selecting never reorders the list. */}
        <ExerciseOrderList
          exercises={exercises}
          currentId={exercise?.id ?? null}
          onSelect={selectExercise}
        />

        {error ? (
          <Text style={[typography.bodyMD, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
        {session.status === "in_progress" ? (
          <View style={r.bottom}>
            <Pressable
              accessibilityRole="button"
              disabled={
                !exercise || !exercise.sets.some((x) => x.status === "pending")
              }
              onPress={skipExercise}
              style={[
                r.secondary,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceCard,
                },
              ]}
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  typography.bodyMD,
                  {
                    color: colors.textSecondary,
                    fontFamily: theme.fonts.semibold,
                  },
                ]}
              >
                Pular exercício
              </Text>
            </Pressable>
            <View style={{ flex: 1.15 }}>
              {pending === 0 ? (
                <GradientButton
                  label="Finalizar treino"
                  busy={busy}
                  icon="flag-outline"
                  onPress={() => void finish()}
                  testID="workout-finish"
                />
              ) : nextWithPending && nextWithPending !== exercise ? (
                <GradientButton
                  label="Próximo exercício"
                  onPress={() => selectExercise(nextWithPending.id)}
                />
              ) : (
                <GradientButton
                  label={`${pending} ${pending === 1 ? "série pendente" : "séries pendentes"}`}
                  disabled
                  onPress={() => undefined}
                  icon={null}
                />
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { gap: 18, paddingBottom: 48, paddingHorizontal: 20 },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  hint: { alignItems: "center", flexDirection: "row", gap: 10 },
});
