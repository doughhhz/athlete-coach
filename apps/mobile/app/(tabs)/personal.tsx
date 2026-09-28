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
  CoachConversationMessage,
  CoachDecision,
  InterventionOutcomeEvaluation,
} from "@athlete-coach/domain";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { outcomeStatusLabels } from "@/presentation/outcomes/outcome-labels";

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
    } = useAppSession();
  const [question, setQuestion] = useState(""),
    [analysis, setAnalysis] = useState<CoachAnalysis | null>(null),
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
  async function send() {
    const text = question.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeWithCoach({
        userRequest: text,
        analysisMode: "question",
        conversationContext: history.slice(-6),
      });
      setAnalysis(result);
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
    if (!analysis) return;
    setProposalLoading(true);
    setError(null);
    try {
      const value = await generateCoachProposal(analysis);
      setDecision(value);
      if (value) setDecisions((items) => [value, ...items]);
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
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 12,
  },
});
