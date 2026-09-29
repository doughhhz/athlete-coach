import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  CoachAutonomyMode,
  CoachDecision,
  CoachDraftAuthorityMode,
} from "@athlete-coach/domain";
import type { AutoDraftResult } from "@athlete-coach/application";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { reviewClassLabels } from "@/presentation/coach/governance-labels";
import {
  AUTO_DRAFT_CONSENT,
  AUTO_DRAFT_PROACTIVE_ONLY,
  autoDraftReasonLabels,
  autoDraftStatusMessages,
  draftAuthorityCopy,
} from "@/presentation/coach/auto-draft-labels";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Separate from the autonomy mode (no hidden coupling). Nothing is
 * preselected; "Conservadora" needs an explicit confirmation.
 */
export function DraftAuthoritySection({
  mode,
  autonomyMode,
  onChange,
}: {
  mode: CoachDraftAuthorityMode | null;
  autonomyMode: CoachAutonomyMode | null;
  onChange(mode: CoachDraftAuthorityMode): Promise<void>;
}) {
  const theme = useAppTheme();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  async function save(next: CoachDraftAuthorityMode) {
    setSaving(true);
    try {
      await onChange(next);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card title="Criação automática de rascunho">
      {(["manual_draft", "standard_auto_draft"] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === value, disabled: saving }}
          disabled={saving || mode === value}
          onPress={() =>
            value === "manual_draft"
              ? void save("manual_draft")
              : setConfirming(true)
          }
          style={[
            styles.option,
            {
              borderColor:
                mode === value ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
            {draftAuthorityCopy[value].title}
            {mode === value ? " (atual)" : ""}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            {draftAuthorityCopy[value].description}
          </Text>
        </Pressable>
      ))}
      {autonomyMode !== "proactive" && (
        <Text style={{ color: theme.colors.textMuted }}>
          {AUTO_DRAFT_PROACTIVE_ONLY}
        </Text>
      )}
      {confirming && mode !== "standard_auto_draft" && (
        <View style={styles.consent}>
          {AUTO_DRAFT_CONSENT.map((line) => (
            <Text key={line} style={{ color: theme.colors.text }}>
              {line}
            </Text>
          ))}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(false)}
            >
              <Text style={{ color: theme.colors.text }}>Manter desligada</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save("standard_auto_draft")}
            >
              <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
                Ativar criação conservadora
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}

/** Never silent: every automatic draft is surfaced with its provenance. */
export function AutoDraftCard({ result }: { result: AutoDraftResult }) {
  const theme = useAppTheme();
  const message = autoDraftStatusMessages[result.status];
  if (!message) return null;
  const decision: CoachDecision | null = result.decision;
  if (result.status !== "materialized" || !decision || !result.draftProgramId)
    return (
      <Card title="Criação automática de rascunho">
        <Text style={{ color: theme.colors.text }}>{message}</Text>
      </Card>
    );
  const draftProgramId = result.draftProgramId;
  return (
    <Card title="Rascunho preparado">
      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
        Rascunho preparado automaticamente
      </Text>
      <Text style={{ color: theme.colors.text }}>{message}</Text>
      <Text style={{ color: theme.colors.text }}>
        {decision.proposal.summary}
      </Text>
      {result.reasons.map((reason) => (
        <Text key={reason} style={{ color: theme.colors.text }}>
          O que muda: {autoDraftReasonLabels[reason] ?? reason}
        </Text>
      ))}
      {decision.governance && (
        <Text style={{ color: theme.colors.textMuted }}>
          {reviewClassLabels[decision.governance.reviewClass]}
        </Text>
      )}
      <Text style={{ color: theme.colors.textMuted }}>
        Regra: {result.policyVersion} — ajuste restrito elegível para rascunho
        automático.
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Programa de origem: revisão {decision.proposal.sourceProgramRevision}{" "}
        (continua ativo). Nova revisão em rascunho:{" "}
        {decision.proposal.sourceProgramRevision + 1}.
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Seu programa ativo não foi alterado nem ativado. Você decide se ativa
        esta revisão.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/programs/[id]",
            params: { id: draftProgramId },
          })
        }
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
      >
        <Text style={styles.buttonText}>Revisar rascunho</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: "700" },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  optionTitle: { fontWeight: "700", fontSize: 16 },
  consent: { gap: 8 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
