import {
  clampPath,
  cleanDraftEditSession,
  dayAt,
  draftEditTransition,
  draftLeaveOptions,
  emptyDays,
  emptyStructure,
  listDays,
  ProgramCreationConflictError,
  programToStructureInput,
  shouldGuardDraftLeave,
  structureEdits,
  structureRemovalRules,
  structureSummaries,
  type DayPath,
  type DraftEditEvent,
  type DraftEditSession,
  type StructureInput,
  type StructureSetInput,
} from "@athlete-coach/application";
import type { ExerciseSummary } from "@athlete-coach/domain";
import {
  type Href,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppSession } from "@/presentation/auth/app-session";
import { newIdempotencyKey } from "@/presentation/idempotency-key";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  lastNodeExplanation,
  removalConfirmLabel,
  removalMessage,
  removalTitle,
  structureLevelLabels,
  type StructureLevel,
} from "@/presentation/training/structure-labels";

/**
 * The builder holds the WHOLE draft (every block, week, day, prescription and
 * set, with lineage) and always saves the whole tree. The selected day is
 * only a viewport: switching days never discards edits, and nodes are removed
 * only by explicit actions (corrective pass after Implementation Phase 18).
 * Blocks, weeks and days are added, removed (with a factual confirmation)
 * and reordered through the pure editor; leaving with unsaved edits asks
 * first (Implementation Phase 19, ADR-0097..0099).
 */
export function ProgramBuilderScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter(),
    navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState(""),
    [structure, setStructure] = useState<StructureInput | null>(
      id ? null : emptyStructure(),
    ),
    [selected, setSelected] = useState<DayPath>({ block: 0, week: 0, day: 0 }),
    [catalog, setCatalog] = useState<readonly ExerciseSummary[]>([]),
    [session, setSession] = useState<DraftEditSession>(cleanDraftEditSession),
    // Set after a successful save; navigation happens once the clean state
    // has rendered, so the leave guard is already released.
    [savedProgramId, setSavedProgramId] = useState<string | null>(null),
    // One new-program creation intent per builder visit: generated once and
    // reused on every retry (network failure, timeout, unknown result).
    // Leaving the builder abandons the intent; a new visit is a new intent.
    [creationRequestId] = useState<string>(newIdempotencyKey),
    // Same intent already created with a different payload (409).
    [conflictProgramId, setConflictProgramId] = useState<string | null>(null),
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
  const dirty = session.dirty,
    busy = session.saving;
  const track = (event: DraftEditEvent) =>
    setSession((current) => draftEditTransition(current, event));
  // Unsaved edits: leaving (back, gesture, hardware back) asks first.
  // Switching block/week/day inside the builder is not leaving.
  usePreventRemove(shouldGuardDraftLeave(session), ({ data }) => {
    const [keep, discard] = draftLeaveOptions;
    Alert.alert(
      "Sair sem salvar?",
      "Este rascunho tem alterações que ainda não foram salvas.",
      [
        { text: keep.label, style: "cancel" },
        {
          text: discard.label,
          style: "destructive",
          // Discard never saves: the screen closes and the stored draft stays.
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  useEffect(() => {
    if (savedProgramId && !session.dirty)
      router.replace(`/programs/${savedProgramId}` as Href);
  }, [router, savedProgramId, session.dirty]);
  function edit(update: (current: StructureInput) => StructureInput) {
    setStructure((current) => (current ? update(current) : current));
    track("edited");
  }
  /** Applies a structural edit and keeps the viewport inside the tree. */
  function commit(next: StructureInput, path: DayPath) {
    setStructure(next);
    track("edited");
    setReplacing(null);
    setSelected(clampPath(next, path));
  }
  function select(path: DayPath) {
    setReplacing(null);
    setSelected(path);
  }
  const canRemove = (level: StructureLevel) =>
    !structure
      ? false
      : level === "block"
        ? structureRemovalRules.canRemoveBlock(structure)
        : level === "week"
          ? structureRemovalRules.canRemoveWeek(structure, selected)
          : structureRemovalRules.canRemoveDay(structure, selected);
  /** Structural deletion requires explicit intent (ADR-0098). */
  function confirmRemoval(level: StructureLevel) {
    if (!structure || !canRemove(level)) return;
    const summary = structureSummaries[level](structure, selected);
    if (!summary) return;
    const current = structure,
      path = selected;
    Alert.alert(removalTitle(level, summary), removalMessage(level, summary), [
      { text: "Cancelar", style: "cancel" },
      {
        text: removalConfirmLabel[level],
        style: "destructive",
        onPress: () =>
          level === "block"
            ? commit(structureEdits.removeBlock(current, path), {
                block: path.block,
                week: 0,
                day: 0,
              })
            : level === "week"
              ? commit(structureEdits.removeWeek(current, path), {
                  ...path,
                  day: 0,
                })
              : commit(structureEdits.removeDay(current, path), path),
      },
    ]);
  }
  function add(level: StructureLevel) {
    if (!structure) return;
    const blockCount = structure.blocks.length,
      weekCount = structure.blocks[selected.block]?.weeks.length ?? 0,
      dayCount =
        structure.blocks[selected.block]?.weeks[selected.week]?.days.length ??
        0;
    if (level === "block")
      commit(structureEdits.addBlock(structure, `Bloco ${blockCount + 1}`), {
        block: blockCount,
        week: 0,
        day: 0,
      });
    else if (level === "week")
      commit(structureEdits.addWeek(structure, selected), {
        ...selected,
        week: weekCount,
        day: 0,
      });
    else
      commit(
        structureEdits.addDay(
          structure,
          selected,
          `Treino ${String.fromCharCode(65 + dayCount)}`,
        ),
        { ...selected, day: dayCount },
      );
  }
  function move(level: StructureLevel, offset: -1 | 1) {
    if (!structure) return;
    if (level === "block")
      commit(structureEdits.moveBlock(structure, selected, offset), {
        ...selected,
        block: selected.block + offset,
      });
    else if (level === "week")
      commit(structureEdits.moveWeek(structure, selected, offset), {
        ...selected,
        week: selected.week + offset,
      });
    else
      commit(structureEdits.moveDay(structure, selected, offset), {
        ...selected,
        day: selected.day + offset,
      });
  }
  // Only the days of the selected week; exercise counts per day.
  const days = structure
    ? listDays(structure).filter(
        (item) =>
          item.path.block === selected.block &&
          item.path.week === selected.week,
      )
    : [];
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
    setConflictProgramId(null);
    track("save_started");
    try {
      let programId: string;
      if (id) {
        programId = id;
        // Always the full tree: the viewport is never the save scope.
        await app.saveProgramStructure(programId, structure);
      } else {
        // New program: ONE atomic, idempotent creation (program + complete
        // tree). Zero drafts or one complete draft; a retry of this intent
        // resolves to the same draft.
        programId = (
          await app.createProgramWithStructure({
            creationRequestId,
            name,
            structure,
          })
        ).id;
      }
      track("save_succeeded");
      setSavedProgramId(programId);
    } catch (e) {
      // Edits stay dirty and the local tree is kept: nothing is marked saved
      // after a failure, and "Salvar e revisar" retries the same intent.
      track("save_failed");
      if (e instanceof ProgramCreationConflictError)
        setConflictProgramId(e.existingProgramId);
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar o programa.",
      );
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
      // No edits while saving: the saved tree is the tree on screen.
      style={busy ? s.locked : undefined}
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
        testID="builder-program-name"
        onChangeText={(value) => {
          setName(value);
          track("edited");
        }}
        editable={!id}
      />
      <LevelSelector
        level="block"
        items={structure.blocks.map((item) => item.name)}
        selectedIndex={selected.block}
        onSelect={(index) => select({ block: index, week: 0, day: 0 })}
        onAdd={() => add("block")}
        onMove={(offset) => move("block", offset)}
        canRemove={canRemove("block")}
        onRemove={() => confirmRemoval("block")}
      />
      <Field
        label="Nome do bloco"
        value={block?.name ?? ""}
        onChangeText={(value) =>
          edit((current) =>
            structureEdits.renameBlock(current, selected, value),
          )
        }
      />
      <LevelSelector
        level="week"
        items={(block?.weeks ?? []).map(
          (item, index) => item.name || `Semana ${index + 1}`,
        )}
        selectedIndex={selected.week}
        onSelect={(index) => select({ ...selected, week: index, day: 0 })}
        onAdd={() => add("week")}
        onMove={(offset) => move("week", offset)}
        canRemove={canRemove("week")}
        onRemove={() => confirmRemoval("week")}
      />
      <Field
        label="Nome da semana"
        value={week?.name ?? ""}
        onChangeText={(value) =>
          edit((current) => structureEdits.renameWeek(current, selected, value))
        }
      />
      <LevelSelector
        level="day"
        items={days.map(
          (item) =>
            `${week?.days[item.path.day]?.name ?? ""} (${item.exerciseCount})`,
        )}
        selectedIndex={selected.day}
        onSelect={(index) => select({ ...selected, day: index })}
        onAdd={() => add("day")}
        onMove={(offset) => move("day", offset)}
        canRemove={canRemove("day")}
        onRemove={() => confirmRemoval("day")}
      />
      <Field
        label="Nome do dia"
        value={day?.name ?? ""}
        onChangeText={(value) =>
          edit((current) => structureEdits.renameDay(current, selected, value))
        }
      />
      {dirty ? (
        <Text style={{ color: theme.colors.textMuted }}>
          Alterações não salvas em todo o programa — trocar de dia não as
          descarta.
        </Text>
      ) : null}
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
            testID={`builder-exercise-${ex.slug}`}
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
                    testID={`builder-set-load-kind-${kind}`}
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
                  testID="builder-set-load-kg"
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
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.danger }}
          testID="builder-error"
        >
          {error}
        </Text>
      ) : null}
      {conflictProgramId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/programs/${conflictProgramId}` as Href)}
        >
          <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
            Abrir o programa já criado
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        disabled={busy}
        onPress={save}
        testID="builder-save"
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
/**
 * One hierarchy level: chips to select, add, move ↑/↓ and remove. On the
 * last node the remove action is replaced by the invariant explanation.
 */
function LevelSelector({
  level,
  items,
  selectedIndex,
  onSelect,
  onAdd,
  onMove,
  canRemove,
  onRemove,
}: {
  level: StructureLevel;
  items: readonly string[];
  selectedIndex: number;
  onSelect(index: number): void;
  onAdd(): void;
  onMove(offset: -1 | 1): void;
  canRemove: boolean;
  onRemove(): void;
}) {
  const theme = useAppTheme();
  const labels = structureLevelLabels[level];
  return (
    <View style={s.field}>
      <Text style={[s.heading, { color: theme.colors.text }]}>
        {labels.title}
      </Text>
      <ScrollView horizontal contentContainerStyle={s.chips}>
        {items.map((label, index) => {
          const active = index === selectedIndex;
          return (
            <Pressable
              key={`${level}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(index)}
              testID={`builder-${level}-${index}`}
              style={[
                s.chip,
                {
                  borderColor: active
                    ? theme.colors.accent
                    : theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text }}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          testID={`builder-add-${level}`}
          style={[s.chip, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.accent }}>{labels.add}</Text>
        </Pressable>
      </ScrollView>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mover ${labels.noun} para cima`}
          accessibilityState={{ disabled: selectedIndex === 0 }}
          disabled={selectedIndex === 0}
          onPress={() => onMove(-1)}
          style={s.action}
        >
          <Text
            style={{
              color:
                selectedIndex === 0
                  ? theme.colors.textMuted
                  : theme.colors.accent,
            }}
          >
            ↑
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mover ${labels.noun} para baixo`}
          accessibilityState={{ disabled: selectedIndex >= items.length - 1 }}
          disabled={selectedIndex >= items.length - 1}
          onPress={() => onMove(1)}
          style={s.action}
        >
          <Text
            style={{
              color:
                selectedIndex >= items.length - 1
                  ? theme.colors.textMuted
                  : theme.colors.accent,
            }}
          >
            ↓
          </Text>
        </Pressable>
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRemove}
            style={s.action}
          >
            <Text style={{ color: theme.colors.danger }}>
              {removalConfirmLabel[level]}
            </Text>
          </Pressable>
        ) : (
          <Text style={[s.hint, { color: theme.colors.textMuted }]}>
            {lastNodeExplanation[level]}
          </Text>
        )}
      </View>
    </View>
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
  /** Stable E2E selector (Maestro); never read by application logic. */
  testID?: string;
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
  testID,
}: {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
  /** Stable E2E selector (Maestro); never read by application logic. */
  testID?: string;
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
        {...(testID ? { testID } : {})}
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
  testID,
}: {
  label: string;
  active: boolean;
  onPress(): void;
  /** Stable E2E selector (Maestro); never read by application logic. */
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
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
  action: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  hint: { flex: 1, fontSize: 13 },
  locked: { pointerEvents: "none" },
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
