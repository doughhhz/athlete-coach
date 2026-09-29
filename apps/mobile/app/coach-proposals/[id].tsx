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
  type CoachDraftReviewEvidence,
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
import {
  ELEVATED_REVIEW_CONFIRMATION,
  ELEVATED_REVIEW_NOTICE,
  displayReviewClass,
  proposalOriginLabels,
  reviewClassLabels,
} from "@/presentation/coach/governance-labels";
import { materializationOriginLabels } from "@/presentation/coach/auto-draft-labels";
import { DraftReviewDetail } from "@/presentation/coach/draft-review-components";

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
    getCoachDraftReviewEvidence,
  } = useAppSession();
  const [review, setReview] = useState<CoachDraftReviewEvidence | null>(null);
  const [exerciseNames, setExerciseNames] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  const [decision, setDecision] = useState<CoachDecision | null>(null);
  const [sourceProgram, setSourceProgram] = useState<TrainingProgram | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Always starts unchecked; the backend re-checks the class and this flag.
  const [reviewed, setReviewed] = useState(false);

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
    if (decision?.status !== "materialized") return;
    void getCoachDraftReviewEvidence(decision.id)
      .then(setReview)
      .catch(() => undefined);
  }, [decision, getCoachDraftReviewEvidence]);
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
      setDecision(
        await materializeCoachProposal(decision.id, {
          confirmElevatedReview: elevated && reviewed,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error &&
          caught.message === "Confirme que revisou as alterações propostas."
          ? caught.message
          : "A proposta ficou desatualizada ou não pôde ser materializada.",
      );
    } finally {
      setLoading(false);
    }
  }

  const reviewClass = decision
    ? displayReviewClass(decision, sourceProgram)
    : "elevated_review";
  const elevated = reviewClass === "elevated_review";

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
      <View style={styles.badges}>
        {[
          proposalOriginLabels[decision.proposalOrigin],
          reviewClassLabels[reviewClass],
        ].map((label) => (
          <Text
            key={label}
            style={[
              styles.badge,
              { color: theme.colors.text, borderColor: theme.colors.border },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
      {elevated && decision.status === "proposed" && (
        <Text style={{ color: theme.colors.text }}>
          {ELEVATED_REVIEW_NOTICE}
        </Text>
      )}
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
      {decision.status === "proposed" && elevated && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: reviewed }}
          onPress={() => setReviewed((value) => !value)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: theme.colors.border,
                backgroundColor: reviewed ? theme.colors.accent : "transparent",
              },
            ]}
          />
          <Text style={{ color: theme.colors.text }}>
            {ELEVATED_REVIEW_CONFIRMATION}
          </Text>
        </Pressable>
      )}
      {decision.status === "proposed" && (
        <Pressable
          accessibilityRole="button"
          disabled={loading || (elevated && !reviewed)}
          onPress={() => void materialize()}
          style={[
            styles.button,
            { backgroundColor: theme.colors.accent },
            (loading || (elevated && !reviewed)) && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>
            {loading ? "Criando revisão…" : "Criar revisão em rascunho"}
          </Text>
        </Pressable>
      )}
      {decision.status === "materialized" && decision.materializationOrigin && (
        <Text style={{ color: theme.colors.textMuted }}>
          {materializationOriginLabels[decision.materializationOrigin]}. O
          programa ativo não foi alterado; a ativação é sempre sua.
        </Text>
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
      {review && <DraftReviewDetail evidence={review} />}
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
  disabled: { opacity: 0.45 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontSize: 13,
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 4 },
});
