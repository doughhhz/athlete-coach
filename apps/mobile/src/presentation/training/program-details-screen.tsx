import type { TrainingProgram } from "@athlete-coach/domain";
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
import { groupPrescriptionSets } from "./prescription-format";
const statusLabels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído normalmente",
  archived: "Arquivado (retirado)",
} as const;
const weekdayNames = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
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
      {p.description ? (
        <Text testID="program-description" style={{ color: theme.colors.text }}>
          {p.description}
        </Text>
      ) : null}
      <Text style={[s.planned, { color: theme.colors.accent }]}>
        ALVOS PLANEJADOS
      </Text>
      {p.blocks.map((b) => (
        <View key={b.id} style={s.level}>
          <Text style={[s.block, { color: theme.colors.text }]}>
            {b.sequence}. {b.name}
          </Text>
          {b.description ? (
            <Text style={{ color: theme.colors.textMuted }}>
              {b.description}
            </Text>
          ) : null}
          {b.weeks.map((w) => (
            <View key={w.id} style={s.level}>
              <Text style={[s.week, { color: theme.colors.text }]}>
                Semana {w.sequence}
                {w.name ? ` — ${w.name}` : ""}
              </Text>
              {w.notes ? (
                <Text style={{ color: theme.colors.textMuted }}>{w.notes}</Text>
              ) : null}
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
                    {d.preferredWeekday
                      ? `${weekdayNames[d.preferredWeekday]} · `
                      : ""}
                    {d.name}
                  </Text>
                  {d.notes ? (
                    <Text style={{ color: theme.colors.textMuted }}>
                      {d.notes}
                    </Text>
                  ) : null}
                  {d.prescriptions.map((ep) => (
                    <View
                      key={ep.id}
                      style={[
                        s.exerciseCard,
                        { borderColor: theme.colors.border },
                      ]}
                    >
                      <Text style={[s.exercise, { color: theme.colors.text }]}>
                        {ep.sequence}. {ep.exerciseName}
                      </Text>
                      {ep.instructions ? (
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontStyle: "italic",
                          }}
                        >
                          {ep.instructions}
                        </Text>
                      ) : null}
                      {groupPrescriptionSets(ep.sets).map((group, index) => (
                        <View key={index} style={s.setGroup}>
                          <Text
                            style={[
                              s.setHeadline,
                              { color: theme.colors.text },
                            ]}
                          >
                            {group.headline}
                          </Text>
                          <View style={s.chips}>
                            {group.details.map((detail) => (
                              <Text
                                key={detail}
                                style={[
                                  s.chip,
                                  {
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                  },
                                ]}
                              >
                                {detail}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                  {p.status === "active" ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => startWorkout(d.id)}
                      testID="program-start-workout"
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
            testID="program-activate"
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
  exercise: { fontSize: 16, fontWeight: "800" },
  exerciseCard: { borderTopWidth: 1, gap: 6, paddingTop: 10 },
  setGroup: { gap: 6 },
  setHeadline: { fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
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
