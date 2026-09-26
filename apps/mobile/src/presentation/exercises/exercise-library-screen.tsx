import type {
  ExerciseCatalogFacets,
  ExerciseCatalogFilters,
  ExerciseSummary,
  MovementPattern,
} from "@athlete-coach/domain";
import { Link, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar a biblioteca.";
}
export function ExerciseLibraryScreen() {
  const app = useAppSession();
  const theme = useAppTheme();
  const [query, setQuery] = useState("");
  const [muscleGroupSlug, setMuscleGroupSlug] = useState<string>();
  const [muscleSlug, setMuscleSlug] = useState<string>();
  const [equipmentSlug, setEquipmentSlug] = useState<string>();
  const [movementPattern, setMovementPattern] = useState<MovementPattern>();
  const [items, setItems] = useState<readonly ExerciseSummary[]>([]);
  const [facets, setFacets] = useState<ExerciseCatalogFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const filters: ExerciseCatalogFilters = {
      query,
      muscleGroupSlug,
      muscleSlug,
      equipmentSlug,
      movementPattern,
    };
    Promise.all([app.listExercises(filters), app.listExerciseFacets()])
      .then(([nextItems, nextFacets]) => {
        if (active) {
          setItems(nextItems);
          setFacets(nextFacets);
        }
      })
      .catch((caught) => {
        if (active) setError(messageFrom(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    app,
    equipmentSlug,
    movementPattern,
    muscleGroupSlug,
    muscleSlug,
    query,
    reload,
  ]);
  function updateFilters(action: () => void) {
    setLoading(true);
    setError(null);
    action();
  }
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text }]}
      >
        Biblioteca de exercícios
      </Text>
      <Text style={[styles.intro, { color: theme.colors.textMuted }]}>
        Consulte movimentos, anatomia e instruções factuais. A biblioteca não é
        uma prescrição de treino.
      </Text>
      <TextInput
        accessibilityLabel="Buscar exercícios"
        placeholder="Buscar por nome ou alias"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={(value) => updateFilters(() => setQuery(value))}
        style={[
          styles.search,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
      />
      <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
        Grupo muscular
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label="Todos"
          selected={!muscleGroupSlug}
          onPress={() => updateFilters(() => setMuscleGroupSlug(undefined))}
        />
        {facets?.muscleGroups.map((group) => (
          <FilterChip
            key={group.id}
            label={group.namePt}
            selected={muscleGroupSlug === group.slug}
            onPress={() => updateFilters(() => setMuscleGroupSlug(group.slug))}
          />
        ))}
      </ScrollView>
      <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
        Músculo
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label="Todos"
          selected={!muscleSlug}
          onPress={() => updateFilters(() => setMuscleSlug(undefined))}
        />
        {facets?.muscles.map((muscle) => (
          <FilterChip
            key={muscle.id}
            label={muscle.namePt}
            selected={muscleSlug === muscle.slug}
            onPress={() => updateFilters(() => setMuscleSlug(muscle.slug))}
          />
        ))}
      </ScrollView>
      <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
        Equipamento
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label="Todos"
          selected={!equipmentSlug}
          onPress={() => updateFilters(() => setEquipmentSlug(undefined))}
        />
        {facets?.equipment.map((item) => (
          <FilterChip
            key={item.id}
            label={item.namePt}
            selected={equipmentSlug === item.slug}
            onPress={() => updateFilters(() => setEquipmentSlug(item.slug))}
          />
        ))}
      </ScrollView>
      <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
        Padrão de movimento
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label="Todos"
          selected={!movementPattern}
          onPress={() => updateFilters(() => setMovementPattern(undefined))}
        />
        {(
          [
            "horizontal_push",
            "horizontal_pull",
            "vertical_push",
            "vertical_pull",
            "squat",
            "hinge",
            "lunge",
            "knee_flexion",
            "knee_extension",
            "elbow_flexion",
            "elbow_extension",
            "shoulder_abduction",
            "calf_raise",
            "trunk_flexion",
            "trunk_extension",
            "anti_extension",
            "anti_rotation",
            "carry",
          ] as const
        ).map((pattern) => (
          <FilterChip
            key={pattern}
            label={pattern.replaceAll("_", " ")}
            selected={movementPattern === pattern}
            onPress={() => updateFilters(() => setMovementPattern(pattern))}
          />
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={{ color: theme.colors.textMuted }}>
            Carregando exercícios...
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.state}>
          <Text style={{ color: theme.colors.danger }}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => updateFilters(() => setReload((value) => value + 1))}
          >
            <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
              Tentar novamente
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
          Nenhum exercício corresponde aos filtros.
        </Text>
      ) : null}
      {!loading && !error
        ? items.map((item) => (
            <Link
              key={item.id}
              href={`/exercises/${item.slug}` as Href}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  {item.namePt}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {item.primaryMuscleGroups.join(", ") ||
                    "Grupo muscular não informado"}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {item.equipment[0] ?? "Equipamento não informado"}
                </Text>
              </Pressable>
            </Link>
          ))
        : null}
    </ScrollView>
  );
}
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? theme.colors.accent
            : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? "#FFFFFF" : theme.colors.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  page: { gap: 12, padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800" },
  intro: { fontSize: 15, lineHeight: 21 },
  search: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  filterLabel: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  chips: { gap: 8 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  state: { alignItems: "center", gap: 12, padding: 28 },
  stateText: { padding: 28, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, gap: 5, padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: "800" },
});
