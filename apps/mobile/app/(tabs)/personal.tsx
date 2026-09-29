import { useEffect, useState, type ReactNode } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  CoachAnalysis,
  CoachAutonomyMode,
  CoachConversationMessage,
  CoachDecision,
  InterventionOutcomeEvaluation,
} from "@athlete-coach/domain";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { outcomeStatusLabels } from "@/presentation/outcomes/outcome-labels";
import {
  PROACTIVE_CONSENT_TEXT,
  PROACTIVE_COST_NOTICE,
  autonomyModeCopy,
  proactiveStatusMessages,
  proposalOriginLabels,
  reviewClassLabels,
  type ProactiveStatus,
} from "@/presentation/coach/governance-labels";
import { newAnalysisRequestId } from "@/presentation/coach/analysis-request-id";

/** Origin and backend review class; legacy decisions show origin only. */
function DecisionBadges({ decision }: { decision: CoachDecision }) {
  const theme = useAppTheme();
  const labels = [
    proposalOriginLabels[decision.proposalOrigin],
    ...(decision.governance
      ? [reviewClassLabels[decision.governance.reviewClass]]
      : []),
  ];
  return (
    <View style={styles.badges}>
      {labels.map((label) => (
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
  );
}

/** Explicit opt-in; nothing is preselected and proactive needs confirmation. */
function AutonomyModeSection({
  mode,
  onChange,
}: {
  mode: CoachAutonomyMode | null;
  onChange(mode: CoachAutonomyMode): Promise<void>;
}) {
  const theme = useAppTheme();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  async function save(next: CoachAutonomyMode) {
    setSaving(true);
    try {
      await onChange(next);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Section title="Modo do Personal">
      {(["manual", "proactive"] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === value, disabled: saving }}
          disabled={saving || mode === value}
          onPress={() =>
            value === "manual" ? void save("manual") : setConfirming(true)
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
            {autonomyModeCopy[value].title}
            {mode === value ? " (atual)" : ""}
          </Text>
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
            {autonomyModeCopy[value].description}
          </Text>
        </Pressable>
      ))}
      {confirming && mode !== "proactive" && (
        <View style={styles.consent}>
          <Text style={{ color: theme.colors.text }}>
            {PROACTIVE_CONSENT_TEXT}
          </Text>
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
            {PROACTIVE_COST_NOTICE}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(false)}
            >
              <Text style={{ color: theme.colors.text }}>Manter manual</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save("proactive")}
            >
              <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
                Ativar modo proativo
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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
function Lines({ values }: { values: readonly string[] }) {
  const theme = useAppTheme();
  return values.length ? (
    values.map((value, index) => (
      <Text
        key={`${index}-${value}`}
        style={[styles.item, { color: theme.colors.text }]}
      >
        • {value}
      </Text>
    ))
  ) : (
    <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
      Nada a destacar com os dados disponíveis.
    </Text>
  );
}
function Analysis({ value }: { value: CoachAnalysis }) {
  const theme = useAppTheme();
  return (
    <View style={styles.analysis}>
      <Section title="Resumo">
        <Text style={{ color: theme.colors.text }}>{value.summary}</Text>
      </Section>
      {value.safetyFlags.length > 0 && (
        <Section title="Atenção">
          <Lines values={value.safetyFlags.map((item) => item.message)} />
        </Section>
      )}
      <Section title="Observações">
        <Lines
          values={value.observations.map(
            (item) =>
              `${item.statement}${item.evidence.length ? ` — baseado em ${item.evidence.length} referência(s) factual(is)` : ""}`,
          )}
        />
      </Section>
      <Section title="O que pode estar acontecendo">
        <Lines values={value.hypotheses.map((item) => item.statement)} />
      </Section>
      <Section title="Sugestões">
        <Lines
          values={value.recommendations.map(
            (item) =>
              `${item.statement} — proposta para sua revisão${item.evidence.length ? `, baseada em ${item.evidence.length} referência(s) factual(is)` : ""}`,
          )}
        />
      </Section>
      <Section title="O que ainda falta saber">
        <Lines
          values={[
            ...value.questions,
            ...value.uncertainties.map((item) => item.statement),
          ]}
        />
      </Section>
    </View>
  );
}
export default function CoachScreen() {
  const theme = useAppTheme(),
    {
      analyzeWithCoach,
      generateCoachProposal,
      listCoachDecisions,
      listInterventionOutcomes,
      rejectCoachProposal,
      getCoachAutonomyMode,
      setCoachAutonomyMode,
    } = useAppSession();
  const [question, setQuestion] = useState(""),
    [analysis, setAnalysis] = useState<CoachAnalysis | null>(null),
    [analysisRequestId, setAnalysisRequestId] = useState<string | null>(null),
    // Same key while retrying the same question (idempotent backend).
    [pending, setPending] = useState<{ text: string; id: string } | null>(null),
    [proactiveStatus, setProactiveStatus] = useState<ProactiveStatus | null>(
      null,
    ),
    [autonomyMode, setAutonomyMode] = useState<CoachAutonomyMode | null>(null),
    [history, setHistory] = useState<CoachConversationMessage[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [proposalLoading, setProposalLoading] = useState(false),
    [decision, setDecision] = useState<CoachDecision | null>(null),
    [decisions, setDecisions] = useState<readonly CoachDecision[]>([]),
    [outcomes, setOutcomes] = useState<
      readonly InterventionOutcomeEvaluation[]
    >([]);
  useEffect(() => {
    void listCoachDecisions()
      .then(setDecisions)
      .catch(() => undefined);
    void listInterventionOutcomes()
      .then(setOutcomes)
      .catch(() => undefined);
  }, [listCoachDecisions, listInterventionOutcomes]);
  useEffect(() => {
    void getCoachAutonomyMode()
      .then(setAutonomyMode)
      .catch(() => undefined);
  }, [getCoachAutonomyMode]);
  async function changeMode(next: CoachAutonomyMode) {
    try {
      setAutonomyMode(await setCoachAutonomyMode(next));
    } catch {
      setError("Não foi possível salvar o modo do Personal.");
    }
  }
  async function send() {
    const text = (question.trim() || pending?.text) ?? "";
    if (!text || loading) return;
    const requestId =
      pending?.text === text ? pending.id : newAnalysisRequestId();
    setPending({ text, id: requestId });
    setLoading(true);
    setError(null);
    try {
      const response = await analyzeWithCoach({
        userRequest: text,
        analysisMode: "question",
        conversationContext: history.slice(-6),
        analysisRequestId: requestId,
      });
      const result = response.analysis;
      setAnalysis(result);
      setAnalysisRequestId(response.analysisRequestId);
      if (response.autonomyMode) setAutonomyMode(response.autonomyMode);
      setProactiveStatus(response.proactiveProposal.status);
      const prepared = response.proactiveProposal.decision;
      setDecision(prepared);
      if (prepared)
        setDecisions((items) => [
          prepared,
          ...items.filter((item) => item.id !== prepared.id),
        ]);
      setPending(null);
      setHistory((items) =>
        [
          ...items,
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: result.summary },
        ].slice(-6),
      );
      setQuestion("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível obter a análise do Personal.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function propose() {
    if (!analysis || !analysisRequestId) return;
    setProposalLoading(true);
    setError(null);
    try {
      // Only the server-owned analysis identity is sent; an existing decision
      // for the same analysis is reused (no new AI call).
      const value = await generateCoachProposal(analysisRequestId);
      setDecision(value);
      if (value)
        setDecisions((items) => [
          value,
          ...items.filter((item) => item.id !== value.id),
        ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível gerar a proposta estruturada.",
      );
    } finally {
      setProposalLoading(false);
    }
  }
  async function reject() {
    if (!decision) return;
    try {
      const value = await rejectCoachProposal(decision.id, "not_now");
      setDecision(value);
      setDecisions((items) =>
        items.map((item) => (item.id === value.id ? value : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível rejeitar a proposta.",
      );
    }
  }
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Personal</Text>
      <Text style={[styles.intro, { color: theme.colors.textMuted }]}>
        Analisa seu dossier de treino e responde com interpretações, incertezas
        e sugestões. Seus fatos e seu programa não são alterados.
      </Text>
      <AutonomyModeSection mode={autonomyMode} onChange={changeMode} />
      <TextInput
        accessibilityLabel="Pergunte ao seu Personal"
        multiline
        maxLength={2000}
        onChangeText={setQuestion}
        placeholder="Pergunte ao seu Personal"
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
        value={question}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!question.trim() || loading}
        onPress={() => void send()}
        style={[
          styles.button,
          { backgroundColor: theme.colors.accent },
          (!question.trim() || loading) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Analisando…" : "Enviar"}
        </Text>
      </Pressable>
      {loading && <ActivityIndicator color={theme.colors.accent} />}
      {error && (
        <Section title="Não foi possível concluir">
          <Text style={{ color: theme.colors.danger }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void send()}>
            <Text style={[styles.retry, { color: theme.colors.accent }]}>
              Tentar novamente
            </Text>
          </Pressable>
        </Section>
      )}
      {analysis && <Analysis value={analysis} />}
      {analysis &&
        proactiveStatus &&
        proactiveStatusMessages[proactiveStatus] && (
          <Section title="Proposta preparada pelo Personal">
            <Text style={{ color: theme.colors.text }}>
              {proactiveStatusMessages[proactiveStatus]}
            </Text>
          </Section>
        )}
      {analysis?.recommendations.some(
        (item) => item.category === "training_adjustment",
      ) &&
        !analysis.safetyFlags.some((item) => item.blocksTrainingAdvice) &&
        !decision && (
          <Pressable
            accessibilityRole="button"
            disabled={proposalLoading}
            onPress={() => void propose()}
            style={[styles.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.buttonText}>
              {proposalLoading ? "Gerando proposta…" : "Ver proposta de ajuste"}
            </Text>
          </Pressable>
        )}
      {decision && (
        <Section title="Proposta de ajuste">
          <DecisionBadges decision={decision} />
          <Text style={{ color: theme.colors.text }}>
            {decision.proposal.summary}
          </Text>
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
            Programa de origem: revisão{" "}
            {decision.proposal.sourceProgramRevision}. A proposta não altera seu
            programa até sua decisão.
          </Text>
          {decision.status === "proposed" && (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void reject()}
              >
                <Text style={{ color: theme.colors.danger }}>
                  Rejeitar proposta
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/coach-proposals/[id]",
                    params: { id: decision.id },
                  } as never)
                }
              >
                <Text style={{ color: theme.colors.accent, fontWeight: "700" }}>
                  Revisar proposta
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
            Status: {decision.status}
          </Text>
        </Section>
      )}
      <Section title="Histórico de decisões">
        {decisions.length === 0 ? (
          <Lines values={[]} />
        ) : (
          decisions.map((item) => {
            const outcome = outcomes.find(
              (value) => value.decisionId === item.id,
            );
            return (
              <View key={item.id} style={styles.historyItem}>
                <Text style={[styles.item, { color: theme.colors.text }]}>
                  • {item.proposal.summary} — {item.status}
                </Text>
                <DecisionBadges decision={item} />
                {outcome ? (
                  <Text
                    style={[styles.muted, { color: theme.colors.textMuted }]}
                  >
                    {outcomeStatusLabels[outcome.status]}
                  </Text>
                ) : null}
                {outcome &&
                (outcome.status === "evaluable" ||
                  outcome.status === "limited_data") ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/coach-decisions/[id]",
                        params: { id: item.id },
                      } as never)
                    }
                  >
                    <Text
                      style={{ color: theme.colors.accent, fontWeight: "700" }}
                    >
                      Ver resposta observada
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </Section>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 30, fontWeight: "700" },
  intro: { fontSize: 16, lineHeight: 23 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    textAlignVertical: "top",
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  analysis: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: "700" },
  item: { lineHeight: 22 },
  muted: { lineHeight: 22 },
  retry: { fontWeight: "700", marginTop: 10 },
  historyItem: { gap: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontSize: 13,
  },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  optionTitle: { fontWeight: "700", fontSize: 16 },
  consent: { gap: 8 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 12,
  },
});
