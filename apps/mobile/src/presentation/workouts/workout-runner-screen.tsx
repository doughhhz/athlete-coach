import type { WorkoutSession, WorkoutSet } from "@athlete-coach/domain";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
function range(a: number, b: number) {
  return a === b ? `${a}` : `${a}–${b}`;
}
function SetEditor({
  session,
  set,
  onChange,
}: {
  session: WorkoutSession;
  set: WorkoutSet;
  onChange: (x: WorkoutSession) => void;
}) {
  const app = useAppSession(),
    theme = useAppTheme();
  const [value, setValue] = useState(set.actualValue?.toString() ?? ""),
    [load, setLoad] = useState(set.actualLoadKg?.toString() ?? ""),
    [rir, setRir] = useState(set.actualRir?.toString() ?? ""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [restNow, setRestNow] = useState(0),
    [restDismissed, setRestDismissed] = useState(false);
  useEffect(() => {
    if (!set.restStartedAt || set.plannedRestMaxSeconds === null) return;
    const timer = setInterval(() => setRestNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [set.plannedRestMaxSeconds, set.restStartedAt]);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      onChange(
        await app.recordWorkoutSet(session.id, set.id, {
          actualValue: Number(value),
          actualLoadKg: load === "" ? null : Number(load),
          actualRir: rir === "" ? null : Number(rir),
          restStartedAt:
            set.plannedRestMaxSeconds === null
              ? null
              : new Date().toISOString(),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha ao salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={[s.set, { borderColor: theme.colors.border }]}>
      <Text style={[s.label, { color: theme.colors.accent }]}>PLANEJADO</Text>
      <Text style={{ color: theme.colors.text }}>
        Série {set.sequence}:{" "}
        {range(set.plannedTargetMin, set.plannedTargetMax)} {set.plannedMetric}
        {set.plannedRirMin !== null
          ? ` · RIR ${range(set.plannedRirMin, set.plannedRirMax!)}`
          : ""}
        {set.plannedRestMinSeconds !== null
          ? ` · ${range(set.plannedRestMinSeconds, set.plannedRestMaxSeconds!)} s descanso`
          : ""}
      </Text>
      <Text style={[s.label, { color: theme.colors.accent }]}>REALIZADO</Text>
      {set.status === "skipped" ? (
        <Text style={{ color: theme.colors.textMuted }}>Série pulada</Text>
      ) : (
        <>
          <View style={s.inputs}>
            <TextInput
              accessibilityLabel="Valor realizado"
              testID="workout-set-value"
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              style={[
                s.input,
                { color: theme.colors.text, borderColor: theme.colors.border },
              ]}
            />
            <Text style={{ color: theme.colors.textMuted }}>
              {set.plannedMetric}
            </Text>
            <TextInput
              accessibilityLabel="Carga em kg"
              testID="workout-set-load"
              keyboardType="decimal-pad"
              placeholder="kg"
              value={load}
              onChangeText={setLoad}
              style={[
                s.input,
                { color: theme.colors.text, borderColor: theme.colors.border },
              ]}
            />
            <TextInput
              accessibilityLabel="RIR realizado"
              testID="workout-set-rir"
              keyboardType="number-pad"
              placeholder="RIR"
              value={rir}
              onChangeText={setRir}
              style={[
                s.input,
                { color: theme.colors.text, borderColor: theme.colors.border },
              ]}
            />
          </View>
          <Pressable
            disabled={saving}
            onPress={save}
            testID="workout-set-complete"
            style={[s.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={s.buttonText}>
              {set.status === "completed" ? "Corrigir série" : "Concluir série"}
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => onChange(await app.skipWorkoutSet(set.id))}
          >
            <Text style={{ color: theme.colors.textMuted, padding: 10 }}>
              Pular série
            </Text>
          </Pressable>
        </>
      )}
      {error ? (
        <Text style={{ color: theme.colors.danger }}>
          {error} Os valores digitados foram preservados.
        </Text>
      ) : null}
      {!restDismissed &&
      set.restStartedAt &&
      set.plannedRestMaxSeconds !== null ? (
        <View style={s.rest}>
          <Text style={{ color: theme.colors.text, fontWeight: "800" }}>
            Descanso planejado: {set.plannedRestMaxSeconds} s · restante{" "}
            {Math.max(
              0,
              set.plannedRestMaxSeconds -
                Math.floor(
                  ((restNow || Date.parse(set.restStartedAt)) -
                    Date.parse(set.restStartedAt)) /
                    1000,
                ),
            )}{" "}
            s
          </Text>
          <Pressable onPress={() => setRestDismissed(true)}>
            <Text style={{ color: theme.colors.accent }}>Encerrar timer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
export function WorkoutRunnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(),
    [now, setNow] = useState(0),
    [error, setError] = useState<string | null>(null);
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
  if (session === undefined) return <Text style={s.page}>Carregando…</Text>;
  if (!session) return <Text style={s.page}>Treino não encontrado.</Text>;
  const sets = session.exercises.flatMap((e) => e.sets),
    pending = sets.filter((x) => x.status === "pending").length,
    duration = Math.max(
      0,
      Math.floor((now - Date.parse(session.startedAt)) / 1000),
    );
  async function finish() {
    try {
      setSession(await app.completeWorkout(session!.id));
      router.replace(`/workouts/${id}/summary` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível finalizar.");
    }
  }
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={[s.title, { color: theme.colors.text }]}>
        {session.dayName}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {session.programName} · {Math.floor(duration / 60)}:
        {String(duration % 60).padStart(2, "0")} · {sets.length - pending}/
        {sets.length} resolvidas
      </Text>
      {session.exercises.map((exercise) => (
        <View key={exercise.id} style={s.exercise}>
          <Text style={[s.exerciseTitle, { color: theme.colors.text }]}>
            {exercise.sequence}. {exercise.exerciseName}
          </Text>
          {exercise.sets.map((set) => (
            <SetEditor
              key={set.id}
              session={session}
              set={set}
              onChange={setSession}
            />
          ))}
        </View>
      ))}
      {error ? (
        <Text style={{ color: theme.colors.danger }}>{error}</Text>
      ) : null}
      {session.status === "in_progress" ? (
        <>
          <Pressable
            onPress={finish}
            testID="workout-finish"
            style={[s.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={s.buttonText}>
              Finalizar treino ({pending} pendentes)
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
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
              )
            }
          >
            <Text
              style={{
                color: theme.colors.danger,
                textAlign: "center",
                padding: 16,
              }}
            >
              Encerrar sem concluir
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 16, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  exercise: { gap: 10 },
  exerciseTitle: { fontSize: 20, fontWeight: "800" },
  set: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  inputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    minWidth: 70,
    padding: 10,
  },
  rest: { gap: 6, paddingVertical: 8 },
  button: {
    alignItems: "center",
    borderRadius: 12,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonText: { color: "white", fontWeight: "800" },
});
