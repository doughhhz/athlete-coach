import { useState, type ReactNode } from "react";
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
} from "@athlete-coach/domain";
import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

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
    { analyzeWithCoach } = useAppSession();
  const [question, setQuestion] = useState(""),
    [analysis, setAnalysis] = useState<CoachAnalysis | null>(null),
    [history, setHistory] = useState<CoachConversationMessage[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
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
});
