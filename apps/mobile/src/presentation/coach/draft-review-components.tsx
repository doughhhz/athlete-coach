import { StyleSheet, Text, View } from "react-native";
import type {
  CoachDraftReviewEvidence,
  DossierDraftReviewHistory,
} from "@athlete-coach/domain";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  REVIEW_CHANGED_LABEL,
  REVIEW_EDITOR_NOTE,
  REVIEW_OVERSIGHT_NOTE,
  draftReviewCategoryLabels,
  draftReviewStatusLabels,
  formatReviewValue,
} from "@/presentation/coach/draft-review-labels";

/** Before / prepared / reviewed values per proposal action; no judgment. */
export function DraftReviewDetail({
  evidence,
}: {
  evidence: CoachDraftReviewEvidence;
}) {
  const theme = useAppTheme();
  const reviewedLabel =
    evidence.activatedAt !== null ? "Ativado" : "Revisado (rascunho atual)";
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        Revisão do rascunho
      </Text>
      <Text style={{ color: theme.colors.text }}>
        {draftReviewStatusLabels[evidence.reviewStatus]}
      </Text>
      {evidence.actionComparisons.map((comparison) => (
        <View key={comparison.actionIndex} style={styles.row}>
          <Text style={{ color: theme.colors.text }}>
            Antes: {formatReviewValue(comparison.sourceValue)}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            Preparado: {formatReviewValue(comparison.materializedValue)}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            {reviewedLabel}: {formatReviewValue(comparison.reviewedValue)}
          </Text>
          {comparison.reviewedDiffersFromMaterialized && (
            <Text style={{ color: theme.colors.textMuted }}>
              {REVIEW_CHANGED_LABEL}
            </Text>
          )}
        </View>
      ))}
      {evidence.changeCategories.length > 0 && (
        <Text style={{ color: theme.colors.textMuted }}>
          Diferenças no rascunho:{" "}
          {evidence.changeCategories
            .map((category) => draftReviewCategoryLabels[category])
            .join(", ")}
          {evidence.changesOutsideProposal
            ? " (inclui partes que a proposta não alterava)"
            : ""}
        </Text>
      )}
      <Text style={{ color: theme.colors.textMuted }}>
        {REVIEW_EDITOR_NOTE}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {REVIEW_OVERSIGHT_NOTE}
      </Text>
    </View>
  );
}

/** Transparent counts only; no derived ratios or percentages. */
export function DraftReviewSummary({
  history,
}: {
  history: DossierDraftReviewHistory | null;
}) {
  const theme = useAppTheme();
  if (!history || history.counts.materializedDrafts === 0) return null;
  const { counts } = history;
  const lines = [
    `${counts.byMaterializationOrigin.auto_draft} rascunho(s) automático(s)`,
    `${counts.byMaterializationOrigin.human} rascunho(s) criado(s) por você`,
    ...(
      [
        "activated_unchanged",
        "activated_with_edits",
        "archived_without_activation",
        "awaiting_review",
        "limited_data",
      ] as const
    )
      .filter((status) => counts.byStatus[status] > 0)
      .map(
        (status) =>
          `${counts.byStatus[status]} ${draftReviewStatusLabels[status].toLowerCase()}`,
      ),
  ];
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        Revisões do Personal
      </Text>
      {lines.map((line) => (
        <Text key={line} style={{ color: theme.colors.text }}>
          {line}
        </Text>
      ))}
      <Text style={{ color: theme.colors.textMuted }}>
        {REVIEW_OVERSIGHT_NOTE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: "700" },
  row: { gap: 2, paddingVertical: 4 },
});
