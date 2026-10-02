import type {
  TrainingProgramSummary,
  WorkoutSessionSummary,
} from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppSession } from "@/presentation/auth/app-session";
import { Entrance } from "@/presentation/components/motion";
import { ScreenBackground } from "@/presentation/components/screen-background";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { SectionHeader } from "./treino/treino-components";

const labels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado (retirado)",
} as const;

type Data = Readonly<{
  items: readonly TrainingProgramSummary[];
  active: Readonly<{ id: string }> | null;
  history: readonly WorkoutSessionSummary[];
}>;

/**
 * Programs, the Personal's program, the library and the workout history,
 * moved out of the Treino tab (user feedback 2026-10-02, ADR-0125).
 */
export function ProgramsScreen() {
  const app = useAppSession(),
    theme = useAppTheme();
  const { colors, typography } = theme;
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    let active = true;
    setError(null);
    Promise.all([
      app.listPrograms(),
      app.getActiveProgram(),
      app.listWorkouts(),
    ])
      .then(([items, current, history]) => {
        if (active) setData({ items, active: current, history });
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar os programas.",
          );
      });
    return () => {
      active = false;
    };
  }, [app]);
  useFocusEffect(load);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={s.page}>
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
        {!data && !error ? <ActivityIndicator color={colors.primary} /> : null}
        {data ? (
          <>
            <Entrance index={0} style={s.section}>
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

            <Entrance index={1} style={s.section}>
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
