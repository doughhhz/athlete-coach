import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  isAdjustAction,
  summarizeReplacementChanges,
  summarizeSetCountChanges,
  type CoachDecision,
  type CoachProposalAdjustAction,
  type PrescriptionSet,
  type TrainingProgram,
} from "@athlete-coach/domain";
import {
  CROSS_EXERCISE_WARNING,
  RELATION_CONTEXT_WARNING,
  formatLoadTransition,
  formatPlannedSet,
  formatRelation,
} from "@/presentation/outcomes/outcome-labels";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

const labels = {
  adjust_prescription_target: "Faixa de execução",
  adjust_prescription_rir: "Faixa de RIR",
  adjust_prescription_rest: "Descanso planejado",
  adjust_absolute_load_target: "Carga absoluta planejada",
} as const;
type ProposalAction = CoachProposalAdjustAction;

function findSourceSet(
  program: TrainingProgram | null,
  action: ProposalAction,
): PrescriptionSet | null {
  return (
    program?.blocks
      .flatMap((block) => block.weeks)
      .flatMap((week) => week.days)
      .find((day) => day.id === action.trainingDayId)
      ?.prescriptions.find(
        (prescription) => prescription.id === action.exercisePrescriptionId,
      )
      ?.sets.find((set) => set.id === action.prescriptionSetId) ?? null
  );
}

function formatBefore(
  set: PrescriptionSet | null,
  action: ProposalAction,
): string {
  if (!set) return "indisponível (baseline não encontrado)";
  if (action.kind === "adjust_prescription_target")
    return `${set.targetMin}–${set.targetMax} ${set.targetMetric}`;
  if (action.kind === "adjust_prescription_rir")
    return `RIR ${set.rirMin ?? "sem alvo"}–${set.rirMax ?? "sem alvo"}`;
  if (action.kind === "adjust_prescription_rest")
    return `${set.restMinSeconds ?? "sem alvo"}–${set.restMaxSeconds ?? "sem alvo"} s`;
  return set.loadKind === "absolute"
    ? `${set.loadKg} kg`
    : "sem carga absoluta";
}

function formatAfter(action: ProposalAction): string {
  if (action.kind === "adjust_prescription_target")
    return `${action.targetMin}–${action.targetMax} ${action.targetMetric}`;
  if (action.kind === "adjust_prescription_rir")
    return `RIR ${action.rirMin ?? "sem alvo"}–${action.rirMax ?? "sem alvo"}`;
  if (action.kind === "adjust_prescription_rest")
    return `${action.restMinSeconds ?? "sem alvo"}–${action.restMaxSeconds ?? "sem alvo"} s`;
  return `${action.loadKg} kg`;
}

export default function CoachProposalReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const {
    getProgram,
    listCoachDecisions,
    listExercises,
    materializeCoachProposal,
  } = useAppSession();
  const [exerciseNames, setExerciseNames] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  const [decision, setDecision] = useState<CoachDecision | null>(null);
  const [sourceProgram, setSourceProgram] = useState<TrainingProgram | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listCoachDecisions()
      .then(async (items) => {
        const found = items.find((item) => item.id === id) ?? null;
        setDecision(found);
        setSourceProgram(
          found ? await getProgram(found.proposal.sourceProgramId) : null,
        );
      })
      .catch(() => setError("Não foi possível carregar a proposta."))
      .finally(() => setLoading(false));
  }, [getProgram, id, listCoachDecisions]);
  useEffect(() => {
    void listExercises()
      .then((items) =>
        setExerciseNames(new Map(items.map((item) => [item.id, item.namePt]))),
      )
      .catch(() => undefined);
  }, [listExercises]);

  async function materialize() {
    if (!decision) return;
    setLoading(true);
    setError(null);
    try {
      setDecision(await materializeCoachProposal(decision.id));
    } catch {
      setError("A proposta ficou desatualizada ou não pôde ser materializada.");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !decision) return <ActivityIndicator />;
  if (!decision) return <Text>{error ?? "Proposta não encontrada."}</Text>;
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Revisar proposta
      </Text>
      <Text style={{ color: theme.colors.text }}>
        {decision.proposal.rationale}
      </Text>
      {summarizeReplacementChanges(decision.proposal, sourceProgram).map(
        (change) => {
          const replacementName =
            exerciseNames.get(change.replacementExerciseId) ??
            "exercício do catálogo";
          return (
            <View
              key={`replace-${change.exercisePrescriptionId}`}
              style={[
                styles.card,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Text style={[styles.heading, { color: theme.colors.text }]}>
                Troca de exercício
              </Text>
              <Text style={{ color: theme.colors.text }}>
                Antes: {change.sourceExerciseName}
              </Text>
              <Text style={{ color: theme.colors.text }}>
                Proposto: {replacementName}
              </Text>
              <Text style={{ color: theme.colors.text }}>
                Relações conhecidas:
              </Text>
              {change.relationshipContext.map((relation) => (
                <Text
                  key={`${relation.relationType}-${relation.direction}`}
                  style={{ color: theme.colors.textMuted }}
                >
                  •{" "}
                  {formatRelation(
                    relation,
                    change.sourceExerciseName,
                    replacementName,
                  )}
                </Text>
              ))}
              <Text style={{ color: theme.colors.textMuted }}>
                {RELATION_CONTEXT_WARNING}
              </Text>
              <Text style={{ color: theme.colors.text }}>
                Carga planejada anterior:{" "}
                {change.loadsBefore
                  .map((load) =>
                    load.loadKind === "absolute"
                      ? `${load.loadKg} kg`
                      : load.loadKind === "athlete_selected"
                        ? "selecionada pelo atleta"
                        : "não prescrita",
                  )
                  .join(" · ")}
              </Text>
              <Text style={{ color: theme.colors.text }}>
                Carga após troca: {formatLoadTransition(change.loadTransition)}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Séries mantidas: {change.setCount}. Históricos de carga e 1RM
                estimado desses exercícios são separados.{" "}
                {CROSS_EXERCISE_WARNING}
              </Text>
            </View>
          );
        },
      )}
      {summarizeSetCountChanges(decision.proposal, sourceProgram).map(
        (change) => (
          <View
            key={change.exercisePrescriptionId}
            style={[
              styles.card,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              {change.exerciseName}
            </Text>
            <Text style={{ color: theme.colors.text }}>
              Séries planejadas: {change.beforeSetCount} →{" "}
              {change.afterSetCount}
            </Text>
            {change.addedSets.map((set, index) => (
              <Text key={`add-${index}`} style={{ color: theme.colors.text }}>
                Nova série: {formatPlannedSet(set)}
              </Text>
            ))}
            {change.removedSets.map((set) => (
              <Text key={set.id} style={{ color: theme.colors.text }}>
                Série removida: Série {set.sequence} · {formatPlannedSet(set)}
              </Text>
            ))}
            <Text style={{ color: theme.colors.textMuted }}>
              Quantidade de séries planejadas desta prescrição; não representa
              volume muscular.
            </Text>
          </View>
        ),
      )}
      {decision.proposal.actions
        .filter((action): action is CoachProposalAdjustAction =>
          isAdjustAction(action),
        )
        .map((action, index) => (
          <View
            key={`${action.kind}-${index}`}
            style={[
              styles.card,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              {labels[action.kind]}
            </Text>
            <Text style={{ color: theme.colors.text }}>
              Antes:{" "}
              {formatBefore(findSourceSet(sourceProgram, action), action)}
            </Text>
            <Text style={{ color: theme.colors.text }}>
              Proposto: {formatAfter(action)}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {action.rationale} · {action.evidence.length} evidência(s)
            </Text>
          </View>
        ))}
      <Text style={{ color: theme.colors.textMuted }}>
        A proposta será aplicada a uma nova revisão do programa. Seu programa
        ativo não será alterado até você revisar e ativar a nova versão.
      </Text>
      {decision.status === "proposed" && (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void materialize()}
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
        >
          <Text style={styles.buttonText}>
            {loading ? "Criando revisão…" : "Criar revisão em rascunho"}
          </Text>
        </Pressable>
      )}
      {decision.status === "materialized" && decision.materializedProgramId && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/programs/[id]",
              params: { id: decision.materializedProgramId! },
            })
          }
        >
          <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
            Revisar rascunho
          </Text>
        </Pressable>
      )}
      {decision.status === "stale" && (
        <Text style={{ color: theme.colors.danger }}>
          Esta proposta está desatualizada e não alterou o programa.
        </Text>
      )}
      {error && <Text style={{ color: theme.colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: "700" },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontWeight: "700" },
});
