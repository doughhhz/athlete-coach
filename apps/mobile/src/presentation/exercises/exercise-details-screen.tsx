import type {
  ExerciseDetails,
  InstructionSection,
  MuscleRole,
} from "@athlete-coach/domain";
import { Link, useLocalSearchParams, type Href } from "expo-router";
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

const sectionTitles: Record<InstructionSection, string> = {
  setup: "Preparação",
  execution: "Execução",
  breathing_cue: "Respiração e dicas",
  common_mistake: "Erros comuns",
  safety_note: "Notas de segurança",
};
const roleTitles: Record<MuscleRole, string> = {
  primary: "Músculos primários",
  secondary: "Músculos secundários",
  stabilizer: "Estabilizadores",
};
const relationTitles = {
  variation_of: "Variação de",
  similar_pattern: "Padrão semelhante",
  similar_target: "Alvo semelhante",
  equipment_alternative: "Alternativa de equipamento",
  regression: "Regressão",
  progression: "Progressão",
} as const;
export function ExerciseDetailsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const app = useAppSession();
  const theme = useAppTheme();
  const [item, setItem] = useState<ExerciseDetails | null>();
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    app
      .getExerciseDetails(slug)
      .then((value) => {
        if (active) setItem(value);
      })
      .catch((caught) => {
        if (active) {
          setItem(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar o exercício.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [app, slug, reload]);
  if ((item === undefined || item?.slug !== slug) && !error)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textMuted }}>
          Carregando exercício...
        </Text>
      </View>
    );
  if (error)
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.danger }}>{error}</Text>
        <Pressable
          onPress={() => {
            setItem(undefined);
            setError(null);
            setReload((v) => v + 1);
          }}
        >
          <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  if (item === undefined)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  if (item === null)
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.text }}>
          Exercício não encontrado.
        </Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text }]}
      >
        {item.namePt}
      </Text>
      <Text style={[styles.english, { color: theme.colors.textMuted }]}>
        {item.nameEn}
      </Text>
      <Text style={[styles.description, { color: theme.colors.text }]}>
        {item.shortDescriptionPt}
      </Text>
      <View
        style={[
          styles.media,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted }}>
          {item.hasMedia
            ? "Mídia disponível no catálogo."
            : "Demonstração visual ainda não disponível."}
        </Text>
      </View>
      {(["primary", "secondary", "stabilizer"] as const).map((role) => {
        const muscles = item.muscles.filter((link) => link.role === role);
        return muscles.length ? (
          <Section
            key={role}
            title={roleTitles[role]}
            values={muscles.map(
              (link) => `${link.muscle.namePt} · ${link.group.namePt}`,
            )}
          />
        ) : null;
      })}
      <Section
        title="Equipamentos"
        values={item.equipment.map((value) => value.namePt)}
      />
      <Section
        title="Padrão de movimento"
        values={[item.movementPattern.replaceAll("_", " ")]}
      />
      {(
        [
          "setup",
          "execution",
          "breathing_cue",
          "common_mistake",
          "safety_note",
        ] as const
      ).map((section) => {
        const steps = item.instructions.filter(
          (step) => step.section === section,
        );
        return steps.length ? (
          <Section
            key={section}
            title={sectionTitles[section]}
            values={steps.map((step) => step.contentPt)}
          />
        ) : null;
      })}
      {item.relations.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Relações úteis
          </Text>
          {item.relations.map((relation) => (
            <Link
              key={`${relation.type}-${relation.exercise.id}`}
              href={`/exercises/${relation.exercise.slug}` as Href}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={[styles.relation, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
                  {relation.exercise.namePt}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {relationTitles[relation.type]} · não implica substituição
                  contextual.
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
function Section({
  title,
  values,
}: {
  title: string;
  values: readonly string[];
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {values.length ? (
        values.map((value, index) => (
          <Text
            key={`${value}-${index}`}
            style={[styles.value, { color: theme.colors.textMuted }]}
          >
            • {value}
          </Text>
        ))
      ) : (
        <Text style={{ color: theme.colors.textMuted }}>Não informado.</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  page: { gap: 16, padding: 20, paddingBottom: 44 },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: "800" },
  english: { fontSize: 17 },
  description: { fontSize: 16, lineHeight: 23 },
  media: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 130,
    padding: 20,
  },
  section: { gap: 7 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  value: { fontSize: 15, lineHeight: 22 },
  relation: { borderRadius: 12, borderWidth: 1, gap: 4, padding: 12 },
});
