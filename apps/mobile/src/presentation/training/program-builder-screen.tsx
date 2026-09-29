import type {
  ExerciseSummary,
  LoadPrescriptionKind,
  TargetMetric,
} from "@athlete-coach/domain";
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
type DraftSet = {
  targetMetric: TargetMetric;
  min: string;
  max: string;
  rir: string;
  rest: string;
  tempo: string;
  loadKind: LoadPrescriptionKind;
  loadKg: string;
  /** Existing set lineage (never shown); absent for sets added here. */
  lineageId?: string;
};
/**
 * `lineageId` keeps structural identity across revisions (Implementation
 * Phase 18): a swapped exercise keeps its prescription lineage; new items
 * have none and receive one from the server.
 */
type Picked = {
  exercise: ExerciseSummary;
  sets: DraftSet[];
  lineageId?: string;
};
type ParentLineage = { block?: string; week?: string; day?: string };
const emptySet = (): DraftSet => ({
  targetMetric: "reps",
  min: "8",
  max: "10",
  rir: "2",
  rest: "120",
  tempo: "",
  loadKind: "athlete_selected",
  loadKg: "",
});
export function ProgramBuilderScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState(""),
    [block, setBlock] = useState("Bloco 1"),
    [week, setWeek] = useState("Semana 1"),
    [day, setDay] = useState("Treino A"),
    [catalog, setCatalog] = useState<readonly ExerciseSummary[]>([]),
    [picked, setPicked] = useState<Picked[]>([]),
    [parentLineage, setParentLineage] = useState<ParentLineage>({}),
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
        const firstBlock = program.blocks[0];
        const firstWeek = firstBlock?.weeks[0];
        const firstDay = firstWeek?.days[0];
        setName(program.name);
        setBlock(firstBlock?.name ?? "Bloco 1");
        setWeek(firstWeek?.name ?? "Semana 1");
        setDay(firstDay?.name ?? "Treino A");
        setParentLineage({
          block: firstBlock?.lineageId ?? undefined,
          week: firstWeek?.lineageId ?? undefined,
          day: firstDay?.lineageId ?? undefined,
        });
        setPicked(
          (firstDay?.prescriptions ?? []).flatMap((prescription) => {
            const exercise = exercises.find(
              (item) => item.id === prescription.exerciseId,
            );
            if (!exercise) return [];
            return [
              {
                exercise,
                lineageId: prescription.lineageId ?? undefined,
                sets: prescription.sets.map((set) => ({
                  lineageId: set.lineageId ?? undefined,
                  targetMetric: set.targetMetric,
                  min: String(set.targetMin),
                  max: String(set.targetMax),
                  rir: set.rirMin === null ? "" : String(set.rirMin),
                  rest:
                    set.restMinSeconds === null
                      ? ""
                      : String(set.restMinSeconds),
                  tempo: set.tempo ?? "",
                  loadKind: set.loadKind,
                  loadKg: set.loadKg === null ? "" : String(set.loadKg),
                })),
              },
            ];
          }),
        );
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "Erro ao carregar exercícios.",
          ),
      );
    return () => {
      active = false;
    };
  }, [app, id]);
  function updateSet(
    pi: number,
    si: number,
    key: keyof DraftSet,
    value: string,
  ) {
    setPicked((all) =>
      all.map((p, i) =>
        i === pi
          ? {
              ...p,
              sets: p.sets.map((s, j) =>
                j === si ? { ...s, [key]: value } : s,
              ),
            }
          : p,
      ),
    );
  }
  async function save() {
    setError(null);
    if (!name.trim() || !picked.length) {
      setError("Informe o nome e selecione ao menos um exercício.");
      return;
    }
    setBusy(true);
    try {
      const programId = id ?? (await app.createProgramDraft({ name })).id;
      await app.saveProgramStructure(programId, {
        blocks: [
          {
            lineageId: parentLineage.block,
            sequence: 1,
            name: block,
            weeks: [
              {
                lineageId: parentLineage.week,
                sequence: 1,
                name: week,
                days: [
                  {
                    lineageId: parentLineage.day,
                    sequence: 1,
                    name: day,
                    prescriptions: picked.map((p, i) => ({
                      lineageId: p.lineageId,
                      sequence: i + 1,
                      exerciseId: p.exercise.id,
                      sets: p.sets.map((x, j) => ({
                        lineageId: x.lineageId,
                        sequence: j + 1,
                        targetMetric: x.targetMetric,
                        targetMin: Number(x.min),
                        targetMax: Number(x.max),
                        rirMin: x.rir === "" ? null : Number(x.rir),
                        rirMax: x.rir === "" ? null : Number(x.rir),
                        restMinSeconds: x.rest === "" ? null : Number(x.rest),
                        restMaxSeconds: x.rest === "" ? null : Number(x.rest),
                        tempo: x.tempo || null,
                        loadKind: x.loadKind,
                        loadKg:
                          x.loadKind === "absolute" ? Number(x.loadKg) : null,
                      })),
                    })),
                  },
                ],
              },
            ],
          },
        ],
      });
      router.replace(`/programs/${programId}` as Href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar o programa.",
      );
    } finally {
      setBusy(false);
    }
  }
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
      <Field label="Bloco" value={block} onChangeText={setBlock} />
      <Field label="Semana" value={week} onChangeText={setWeek} />
      <Field label="Dia de treino" value={day} onChangeText={setDay} />
      <Text style={[s.heading, { color: theme.colors.text }]}>
        Selecionar exercícios
      </Text>
      {replacing !== null ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.accent }}>
          Toque no exercício que substituirá{" "}
          {picked[replacing]?.exercise.namePt}. As séries são mantidas; revise a
          carga, que não é convertida entre exercícios.
        </Text>
      ) : null}
      <ScrollView horizontal contentContainerStyle={s.chips}>
        {catalog.map((ex) => (
          <Pressable
            key={ex.id}
            onPress={() => {
              if (replacing !== null) {
                const index = replacing;
                setPicked((v) =>
                  v.some((p) => p.exercise.id === ex.id)
                    ? v
                    : v.map((p, i) =>
                        i === index ? { ...p, exercise: ex } : p,
                      ),
                );
                setReplacing(null);
                return;
              }
              setPicked((v) =>
                v.some((p) => p.exercise.id === ex.id)
                  ? v
                  : [...v, { exercise: ex, sets: [emptySet()] }],
              );
            }}
            style={[s.chip, { borderColor: theme.colors.border }]}
          >
            <Text style={{ color: theme.colors.text }}>{ex.namePt}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {picked.map((p, pi) => (
        <View
          key={p.exercise.id}
          style={[
            s.card,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={s.row}>
            <Text style={[s.heading, { color: theme.colors.text }]}>
              {p.exercise.namePt}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReplacing(replacing === pi ? null : pi)}
            >
              <Text style={{ color: theme.colors.accent }}>
                {replacing === pi ? "Cancelar troca" : "Trocar exercício"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPicked((v) => v.filter((_, i) => i !== pi))}
            >
              <Text style={{ color: theme.colors.danger }}>Remover</Text>
            </Pressable>
          </View>
          {p.sets.map((set, si) => (
            <View key={si} style={s.set}>
              <View style={s.row}>
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                  Série {si + 1}
                </Text>
                {p.sets.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover série ${si + 1} de ${p.exercise.namePt}`}
                    onPress={() =>
                      setPicked((v) =>
                        v.map((x, i) =>
                          i === pi
                            ? { ...x, sets: x.sets.filter((_, j) => j !== si) }
                            : x,
                        ),
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
                <Select
                  label="Reps"
                  active={set.targetMetric === "reps"}
                  onPress={() => updateSet(pi, si, "targetMetric", "reps")}
                />
                <Select
                  label="Segundos"
                  active={set.targetMetric === "seconds"}
                  onPress={() => updateSet(pi, si, "targetMetric", "seconds")}
                />
                <Select
                  label="Metros"
                  active={set.targetMetric === "meters"}
                  onPress={() => updateSet(pi, si, "targetMetric", "meters")}
                />
              </View>
              <View style={s.row}>
                <Small
                  label="Mín."
                  value={set.min}
                  onChange={(v) => updateSet(pi, si, "min", v)}
                />
                <Small
                  label="Máx."
                  value={set.max}
                  onChange={(v) => updateSet(pi, si, "max", v)}
                />
                <Small
                  label="RIR"
                  value={set.rir}
                  onChange={(v) => updateSet(pi, si, "rir", v)}
                />
              </View>
              <View style={s.row}>
                <Small
                  label="Descanso (s)"
                  value={set.rest}
                  onChange={(v) => updateSet(pi, si, "rest", v)}
                />
                <Small
                  label="Tempo"
                  value={set.tempo}
                  onChange={(v) => updateSet(pi, si, "tempo", v)}
                  keyboard="default"
                />
              </View>
              <View style={s.row}>
                {(
                  ["unprescribed", "athlete_selected", "absolute"] as const
                ).map((k) => (
                  <Select
                    key={k}
                    label={
                      {
                        unprescribed: "Sem carga",
                        athlete_selected: "Atleta/RIR",
                        absolute: "kg",
                      }[k]
                    }
                    active={set.loadKind === k}
                    onPress={() => updateSet(pi, si, "loadKind", k)}
                  />
                ))}
              </View>
              {set.loadKind === "absolute" ? (
                <Small
                  label="Carga (kg)"
                  value={set.loadKg}
                  onChange={(v) => updateSet(pi, si, "loadKg", v)}
                />
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={() =>
              setPicked((v) =>
                v.map((x, i) =>
                  i === pi ? { ...x, sets: [...x.sets, emptySet()] } : x,
                ),
              )
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
function Small({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  keyboard?: "numeric" | "default";
}) {
  return (
    <View style={{ flex: 1 }}>
      <Field label={label} value={value} onChangeText={onChange} />
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
