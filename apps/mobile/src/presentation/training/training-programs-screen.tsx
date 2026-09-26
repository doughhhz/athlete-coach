import type {
  TrainingProgram,
  TrainingProgramSummary,
} from "@athlete-coach/domain";
import { Link, type Href } from "expo-router";
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
const labels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado",
} as const;
export function TrainingProgramsScreen() {
  const app = useAppSession(),
    theme = useAppTheme();
  const [items, setItems] = useState<readonly TrainingProgramSummary[]>([]),
    [active, setActive] = useState<TrainingProgram | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  function load() {
    setLoading(true);
    setError(null);
    Promise.all([app.listPrograms(), app.getActiveProgram()])
      .then(([p, a]) => {
        setItems(p);
        setActive(a);
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os programas.",
        ),
      )
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let active = true;
    Promise.all([app.listPrograms(), app.getActiveProgram()])
      .then(([programs, current]) => {
        if (active) {
          setItems(programs);
          setActive(current);
        }
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
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.colors.text }]}
      >
        Treino
      </Text>
      <View
        style={[
          s.hero,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[s.heading, { color: theme.colors.text }]}>
          Programa ativo
        </Text>
        {active ? (
          <>
            <Text style={[s.program, { color: theme.colors.text }]}>
              {active.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {active.blocks.length} bloco(s) ·{" "}
              {active.blocks.reduce((n, b) => n + b.weeks.length, 0)} semana(s)
            </Text>
            <Link href={`/programs/${active.id}` as Href} asChild>
              <Pressable>
                <Text style={[s.link, { color: theme.colors.accent }]}>
                  Ver alvos planejados
                </Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>
            Você ainda não possui um programa de treino ativo.
          </Text>
        )}
      </View>
      <View style={s.row}>
        <Text style={[s.heading, { color: theme.colors.text }]}>
          Meus programas
        </Text>
        <Link href={"/programs/new" as Href} asChild>
          <Pressable
            style={[s.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={s.buttonText}>Criar programa</Text>
          </Pressable>
        </Link>
      </View>
      {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
      {error ? (
        <>
          <Text style={{ color: theme.colors.danger }}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={[s.link, { color: theme.colors.accent }]}>
              Tentar novamente
            </Text>
          </Pressable>
        </>
      ) : null}
      {!loading && !error && !items.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Nenhum programa criado. Comece por um rascunho manual.
        </Text>
      ) : null}
      {!loading &&
        !error &&
        items.map((p) => (
          <Link key={p.id} href={`/programs/${p.id}` as Href} asChild>
            <Pressable
              style={[
                s.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={s.row}>
                <Text style={[s.program, { color: theme.colors.text }]}>
                  {p.name}
                </Text>
                <Text style={[s.badge, { color: theme.colors.accent }]}>
                  {labels[p.status]}
                </Text>
              </View>
              <Text style={{ color: theme.colors.textMuted }}>
                Revisão {p.revision} · {p.blockCount} bloco(s) · {p.weekCount}{" "}
                semana(s) · {p.dayCount} dia(s)
              </Text>
            </Pressable>
          </Link>
        ))}
      <Link href={"/exercises" as Href} asChild>
        <Pressable style={[s.card, { borderColor: theme.colors.border }]}>
          <Text style={[s.program, { color: theme.colors.text }]}>
            Biblioteca de exercícios
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Consulte o catálogo canônico de movimentos.
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 16, padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800" },
  hero: { borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 },
  heading: { fontSize: 18, fontWeight: "800" },
  program: { fontSize: 17, fontWeight: "700", flexShrink: 1 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  card: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 16 },
  button: {
    borderRadius: 12,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonText: { color: "#fff", fontWeight: "800" },
  link: { fontWeight: "700", paddingVertical: 8 },
  badge: { fontSize: 13, fontWeight: "800" },
});
