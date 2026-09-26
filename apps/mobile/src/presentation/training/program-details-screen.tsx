import type { PrescriptionSet, TrainingProgram } from "@athlete-coach/domain";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
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
const statusLabels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído normalmente",
  archived: "Arquivado (retirado)",
} as const;
function range(a: number, b: number) {
  return a === b ? `${a}` : `${a}–${b}`;
}
function describe(s: PrescriptionSet) {
  const unit = { reps: "reps", seconds: "s", meters: "m" }[s.targetMetric];
  const parts = [`${range(s.targetMin, s.targetMax)} ${unit}`];
  if (s.rirMin !== null) parts.push(`RIR ${range(s.rirMin, s.rirMax!)}`);
  if (s.restMinSeconds !== null)
    parts.push(`descanso ${range(s.restMinSeconds, s.restMaxSeconds!)} s`);
  if (s.tempo) parts.push(`tempo ${s.tempo}`);
  if (s.loadKind === "absolute") parts.push(`${s.loadKg} kg`);
  else if (s.loadKind === "athlete_selected")
    parts.push("carga escolhida pelo atleta");
  return parts.join(" · ");
}
export function ProgramDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter();
  const [p, setP] = useState<TrainingProgram | null>(),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    app
      .getProgram(id)
      .then((program) => {
        if (active) setP(program);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Erro ao carregar.");
      });
    return () => {
      active = false;
    };
  }, [app, id]);
  async function action(kind: "activate" | "clone" | "complete" | "archive") {
    setBusy(true);
    setError(null);
    try {
      const next =
        kind === "activate"
          ? await app.activateProgram(id)
          : kind === "clone"
            ? await app.cloneProgram(id)
            : kind === "complete"
              ? await app.completeProgram(id)
              : await app.archiveProgram(id);
      if (kind === "clone") router.replace(`/programs/${next.id}` as Href);
      else setP(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível alterar o programa.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function startWorkout(dayId: string) {
    setBusy(true);
    setError(null);
    try {
      const workout = await app.startWorkout(dayId);
      router.push(`/workouts/${workout.id}` as Href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível iniciar o treino.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (p === undefined)
    return (
      <ActivityIndicator style={{ margin: 40 }} color={theme.colors.accent} />
    );
  if (p === null)
    return (
      <Text style={{ margin: 20, color: theme.colors.text }}>
        Programa não encontrado.
      </Text>
    );
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.colors.text }]}
      >
        {p.name}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Status: {statusLabels[p.status]} · revisão {p.revision}
      </Text>
      <Text style={[s.planned, { color: theme.colors.accent }]}>
        ALVOS PLANEJADOS
      </Text>
      {p.blocks.map((b) => (
        <View key={b.id} style={s.level}>
          <Text style={[s.block, { color: theme.colors.text }]}>
            {b.sequence}. {b.name}
          </Text>
          {b.weeks.map((w) => (
            <View key={w.id} style={s.level}>
              <Text style={[s.week, { color: theme.colors.text }]}>
                Semana {w.sequence}
                {w.name ? ` — ${w.name}` : ""}
              </Text>
              {w.days.map((d) => (
                <View
                  key={d.id}
                  style={[
                    s.card,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[s.day, { color: theme.colors.text }]}>
                    {d.name}
                  </Text>
                  {d.prescriptions.map((ep) => (
                    <View key={ep.id}>
                      <Text style={[s.exercise, { color: theme.colors.text }]}>
                        {ep.sequence}. {ep.exerciseName}
                      </Text>
                      {ep.sets.map((set) => (
                        <Text
                          key={set.id}
                          style={{ color: theme.colors.textMuted }}
                        >
                          Série {set.sequence}: {describe(set)}
                        </Text>
                      ))}
                    </View>
                  ))}
                  {p.status === "active" ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => startWorkout(d.id)}
                      style={[
                        s.button,
                        { backgroundColor: theme.colors.accent },
                      ]}
                    >
                      <Text style={s.buttonText}>Iniciar treino</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
      {error ? (
        <Text style={{ color: theme.colors.danger }}>{error}</Text>
      ) : null}
      <View style={s.actions}>
        {p.status === "draft" ? (
          <Pressable
            onPress={() => router.push(`/programs/new?id=${p.id}` as Href)}
            style={[s.outline, { borderColor: theme.colors.accent }]}
          >
            <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
              Editar rascunho
            </Text>
          </Pressable>
        ) : null}
        {p.status === "draft" ? (
          <Pressable
            disabled={busy}
            onPress={() => action("activate")}
            style={[s.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={s.buttonText}>Ativar programa</Text>
          </Pressable>
        ) : null}
        {p.status !== "draft" ? (
          <Pressable
            disabled={busy}
            onPress={() => action("clone")}
            style={[s.outline, { borderColor: theme.colors.accent }]}
          >
            <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
              Criar revisão editável
            </Text>
          </Pressable>
        ) : null}
        {p.status === "active" ? (
          <Pressable
            disabled={busy}
            onPress={() => action("complete")}
            style={[s.outline, { borderColor: theme.colors.border }]}
          >
            <Text style={{ color: theme.colors.text }}>Concluir ciclo</Text>
          </Pressable>
        ) : null}
        {p.status !== "archived" ? (
          <Pressable disabled={busy} onPress={() => action("archive")}>
            <Text style={{ color: theme.colors.textMuted }}>Arquivar</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 12, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  planned: { fontSize: 12, fontWeight: "900", letterSpacing: 1, marginTop: 8 },
  level: { gap: 10 },
  block: { fontSize: 20, fontWeight: "800" },
  week: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 },
  day: { fontSize: 18, fontWeight: "800" },
  exercise: { fontWeight: "700", marginBottom: 4 },
  actions: { gap: 12, marginTop: 10 },
  button: {
    alignItems: "center",
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "800" },
  outline: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
});
