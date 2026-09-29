import {
  dayAt,
  emptyDays,
  emptyStructure,
  listDays,
  programToStructureInput,
  structureEdits,
  type DayPath,
  type StructureInput,
  type StructureSetInput,
} from "@athlete-coach/application";
import type { ExerciseSummary } from "@athlete-coach/domain";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
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

/**
 * The builder holds the WHOLE draft (every block, week, day, prescription and
 * set, with lineage) and always saves the whole tree. The selected day is
 * only a viewport: switching days never discards edits, and nodes are removed
 * only by explicit actions (corrective pass after Implementation Phase 18).
 */
export function ProgramBuilderScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState(""),
    [structure, setStructure] = useState<StructureInput | null>(
      id ? null : emptyStructure(),
    ),
    [selected, setSelected] = useState<DayPath>({ block: 0, week: 0, day: 0 }),
    [catalog, setCatalog] = useState<readonly ExerciseSummary[]>([]),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    // Index of the exercise being swapped; the next catalog tap replaces it
    // and keeps its sets (human review of replacement drafts).
    [replacing, setReplacing] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([app.listExercises(), id ? app.getProgram(id) : null])
      .then(([exercises, program]) => {
        if (!active) return;
        setCatalog(exercises);
        if (!program) return;
        setName(program.name);
        setStructure(programToStructureInput(program));
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "Erro ao carregar o programa.",
          ),
      );
    return () => {
      active = false;
    };
  }, [app, id]);
  function edit(update: (current: StructureInput) => StructureInput) {
    setStructure((current) => (current ? update(current) : current));
    setDirty(true);
  }
  const days = structure ? listDays(structure) : [];
  const day = structure ? dayAt(structure, selected) : null;
  const block = structure?.blocks[selected.block] ?? null;
  const week = block?.weeks[selected.week] ?? null;
  const exerciseName = (exerciseId: string) =>
    catalog.find((item) => item.id === exerciseId)?.namePt ??
    "Exercício fora do catálogo (mantido)";
  function updateSet(
    index: number,
    setIndex: number,
    changes: Partial<Omit<StructureSetInput, "sequence" | "lineageId">>,
  ) {
    edit((current) =>
      structureEdits.updateSet(current, selected, index, setIndex, changes),
    );
  }
  async function save() {
    setError(null);
    if (!structure) return;
    const empty = emptyDays(structure);
    if (!name.trim() || empty.length) {
      setError(
        !name.trim()
          ? "Informe o nome do programa."
          : `Adicione ao menos um exercício em: ${empty.join("; ")}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const programId = id ?? (await app.createProgramDraft({ name })).id;
      // Always the full tree: the viewport is never the save scope.
      await app.saveProgramStructure(programId, structure);
      setDirty(false);
      router.replace(`/programs/${programId}` as Href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar o programa.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!structure)
    return error ? (
      <Text style={{ color: theme.colors.danger, padding: 20 }}>{error}</Text>
    ) : (
      <ActivityIndicator style={{ margin: 40 }} color={theme.colors.accent} />
    );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
    >
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.colors.text }]}
      >
        {id ? "Editar rascunho" : "Novo programa"}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Monte a intenção planejada. Nenhum dado de execução é registrado aqui.
      </Text>
      <Field
        label={
          id ? "Nome do programa (mantido nesta revisão)" : "Nome do programa"
        }
        value={name}
        onChangeText={setName}
        editable={!id}
      />
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Dia em edição
      </Text>
      <ScrollView horizontal contentContainerStyle={s.chips}>
        {days.map((item) => {
          const active =
            item.path.block === selected.block &&
            item.path.week === selected.week &&
            item.path.day === selected.day;
          return (
            <Pressable
              key={`${item.path.block}-${item.path.week}-${item.path.day}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setReplacing(null);
                setSelected(item.path);
              }}
              style={[
                s.chip,
                {
                  borderColor: active
                    ? theme.colors.accent
                    : theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text }}>
                {item.label} ({item.exerciseCount})
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const count = week?.days.length ?? 0;
            edit((current) =>
              structureEdits.addDay(
                current,
                selected,
                `Treino ${String.fromCharCode(65 + count)}`,
              ),
            );
            setSelected({ ...selected, day: count });
          }}
          style={[s.chip, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.accent }}>+ Dia nesta semana</Text>
        </Pressable>
      </ScrollView>
      {dirty ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Alterações não salvas em todo o programa — trocar de dia não as
          descarta.
        </Text>
      ) : null}
      <Field
        label="Bloco"
        value={block?.name ?? ""}
        onChangeText={(value) =>
          edit((current) =>
            structureEdits.renameBlock(current, selected, value),
          )
        }
      />
      <Field
        label="Semana"
        value={week?.name ?? ""}
        onChangeText={(value) =>
          edit((current) => structureEdits.renameWeek(current, selected, value))
        }
      />
      <Field
        label="Dia de treino"
        value={day?.name ?? ""}
        onChangeText={(value) =>
          edit((current) => structureEdits.renameDay(current, selected, value))
        }
      />
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Selecionar exercícios
      </Text>
      {replacing !== null && day?.prescriptions[replacing] ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.accent }}>
          Toque no exercício que substituirá{" "}
          {exerciseName(day.prescriptions[replacing].exerciseId)}. As séries são
          mantidas; revise a carga, que não é convertida entre exercícios.
        </Text>
      ) : null}
      <ScrollView horizontal contentContainerStyle={s.chips}>
        {catalog.map((ex) => (
          <Pressable
            key={ex.id}
            onPress={() => {
              if (!day || day.prescriptions.some((p) => p.exerciseId === ex.id))
                return;
              if (replacing !== null) {
                const index = replacing;
                edit((current) =>
                  structureEdits.replaceExercise(
                    current,
                    selected,
                    index,
                    ex.id,
                  ),
                );
                setReplacing(null);
                return;
              }
              edit((current) =>
                structureEdits.addPrescription(current, selected, ex.id),
              );
            }}
            style={[s.chip, { borderColor: theme.colors.border }]}
          >
            <Text style={{ color: theme.colors.text }}>{ex.namePt}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {day && day.prescriptions.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Este dia ainda não tem exercícios.
        </Text>
      ) : null}
      {day?.prescriptions.map((prescription, pi) => (
        <View
          key={prescription.lineageId ?? `new-${pi}-${prescription.exerciseId}`}
          style={[
            s.card,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Text style={[s.heading, { color: theme.colors.text }]}>
            {exerciseName(prescription.exerciseId)}
          </Text>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mover exercício para cima"
              onPress={() =>
                edit((current) =>
                  structureEdits.movePrescription(current, selected, pi, -1),
                )
              }
            >
              <Text style={{ color: theme.colors.accent }}>↑</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mover exercício para baixo"
              onPress={() =>
                edit((current) =>
                  structureEdits.movePrescription(current, selected, pi, 1),
                )
              }
            >
              <Text style={{ color: theme.colors.accent }}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReplacing(replacing === pi ? null : pi)}
            >
              <Text style={{ color: theme.colors.accent }}>
                {replacing === pi ? "Cancelar troca" : "Trocar exercício"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setReplacing(null);
                edit((current) =>
                  structureEdits.removePrescription(current, selected, pi),
                );
              }}
            >
              <Text style={{ color: theme.colors.danger }}>Remover</Text>
            </Pressable>
          </View>
          {prescription.sets.map((set, si) => (
            <View key={set.lineageId ?? `new-${si}`} style={s.set}>
              <View style={s.row}>
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                  Série {si + 1}
                </Text>
                {prescription.sets.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover série ${si + 1} de ${exerciseName(prescription.exerciseId)}`}
                    onPress={() =>
                      edit((current) =>
                        structureEdits.removeSet(current, selected, pi, si),
                      )
                    }
                  >
                    <Text style={{ color: theme.colors.danger }}>
                      Remover série
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={s.row}>
                {(
                  [
                    ["reps", "Reps"],
                    ["seconds", "Segundos"],
                    ["meters", "Metros"],
                  ] as const
                ).map(([metric, label]) => (
                  <Select
                    key={metric}
                    label={label}
                    active={set.targetMetric === metric}
                    onPress={() => updateSet(pi, si, { targetMetric: metric })}
                  />
                ))}
              </View>
              <View style={s.row}>
                <NumberField
                  label="Mín."
                  value={set.targetMin}
                  onChange={(v) => updateSet(pi, si, { targetMin: v ?? NaN })}
                />
                <NumberField
                  label="Máx."
                  value={set.targetMax}
                  onChange={(v) => updateSet(pi, si, { targetMax: v ?? NaN })}
                />
              </View>
              <View style={s.row}>
                <NumberField
                  label="RIR mín."
                  value={set.rirMin}
                  onChange={(v) => updateSet(pi, si, { rirMin: v })}
                />
                <NumberField
                  label="RIR máx."
                  value={set.rirMax}
                  onChange={(v) => updateSet(pi, si, { rirMax: v })}
                />
              </View>
              <View style={s.row}>
                <NumberField
                  label="Desc. mín. (s)"
                  value={set.restMinSeconds}
                  onChange={(v) => updateSet(pi, si, { restMinSeconds: v })}
                />
                <NumberField
                  label="Desc. máx. (s)"
                  value={set.restMaxSeconds}
                  onChange={(v) => updateSet(pi, si, { restMaxSeconds: v })}
                />
              </View>
              <Field
                label="Tempo"
                value={set.tempo ?? ""}
                onChangeText={(v) => updateSet(pi, si, { tempo: v || null })}
              />
              <View style={s.row}>
                {(
                  ["unprescribed", "athlete_selected", "absolute"] as const
                ).map((kind) => (
                  <Select
                    key={kind}
                    label={
                      {
                        unprescribed: "Sem carga",
                        athlete_selected: "Atleta/RIR",
                        absolute: "kg",
                      }[kind]
                    }
                    active={set.loadKind === kind}
                    onPress={() =>
                      updateSet(pi, si, {
                        loadKind: kind,
                        loadKg: kind === "absolute" ? set.loadKg : null,
                      })
                    }
                  />
                ))}
              </View>
              {set.loadKind === "absolute" ? (
                <NumberField
                  label="Carga (kg)"
                  value={set.loadKg}
                  onChange={(v) => updateSet(pi, si, { loadKg: v })}
                />
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={() =>
              edit((current) => structureEdits.addSet(current, selected, pi))
            }
          >
            <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
              + Adicionar série
            </Text>
          </Pressable>
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Pressable
        disabled={busy}
        onPress={save}
        style={[s.button, { backgroundColor: theme.colors.accent }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.buttonText}>Salvar e revisar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
function Field({
  label,
  editable = true,
  ...props
}: {
  label: string;
  editable?: boolean;
  value: string;
  onChangeText(v: string): void;
}) {
  const theme = useAppTheme();
  return (
    <View style={s.field}>
      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
        {label}
      </Text>
      <TextInput
        editable={editable}
        {...props}
        style={[
          s.input,
          {
            borderColor: theme.colors.border,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
          },
        ]}
      />
    </View>
  );
}
const parseNumber = (text: string): number | null =>
  text.trim() === "" ? null : Number(text.replace(",", "."));
/** Keeps the typed text (e.g. "62.") while committing parsed values. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
}) {
  const shown = value === null || Number.isNaN(value) ? "" : String(value);
  const [text, setText] = useState(shown);
  const [committed, setCommitted] = useState(value);
  // Adjust during render when the value changes from outside (React pattern);
  // our own commits keep the typed text (e.g. "62.").
  if (!Object.is(committed, value)) {
    setCommitted(value);
    if (!Object.is(parseNumber(text), value)) setText(shown);
  }
  return (
    <View style={{ flex: 1 }}>
      <Field
        label={label}
        value={text}
        onChangeText={(next) => {
          const parsed = parseNumber(next);
          setText(next);
          setCommitted(parsed);
          onChange(parsed);
        }}
      />
    </View>
  );
}
function Select({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress(): void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.select,
        {
          borderColor: active ? theme.colors.accent : theme.colors.border,
          backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        },
      ]}
    >
      <Text
        style={{
          color: active ? "#fff" : theme.colors.text,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  page: { gap: 14, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  heading: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
  field: { gap: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  chips: { gap: 8 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  card: { borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 },
  set: { gap: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  select: {
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "800" },
});
