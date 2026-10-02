import { useEffect, useRef, useState, type ReactNode } from "react";
import { type Href, router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  CoachAnalysis,
  CoachAutonomyMode,
  CoachDraftAuthorityMode,
  DraftReviewStatus,
  CoachConversationMessage,
  CoachDecision,
  InterventionOutcomeEvaluation,
} from "@athlete-coach/domain";
import { useAppSession } from "@/presentation/auth/app-session";
import {
  ChatComposer,
  ChecklistCard,
  CoachMessage,
  PersonalHeader,
  QuickSuggestionGrid,
  TypingIndicator,
  UserMessage,
  type Suggestion,
} from "@/presentation/coach/chat-components";
import { Entrance } from "@/presentation/components/motion";
import { ScreenBackground } from "@/presentation/components/screen-background";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { outcomeStatusLabels } from "@/presentation/outcomes/outcome-labels";
import {
  PROACTIVE_CONSENT_TEXT,
  PROACTIVE_COST_NOTICE,
  autonomyModeCopy,
  NO_PROPOSAL_MESSAGE,
  proactiveStatusMessages,
  proposalOriginLabels,
  reviewClassLabels,
  type ProactiveStatus,
} from "@/presentation/coach/governance-labels";
import { newAnalysisRequestId } from "@/presentation/coach/analysis-request-id";
import type { AutoDraftResult } from "@athlete-coach/application";
import {
  AutoDraftCard,
  DraftAuthoritySection,
} from "@/presentation/coach/auto-draft-components";
import { materializationOriginLabels } from "@/presentation/coach/auto-draft-labels";
import { draftReviewStatusLabels } from "@/presentation/coach/draft-review-labels";

/** Origin and backend review class; legacy decisions show origin only. */
function DecisionBadges({ decision }: { decision: CoachDecision }) {
  const theme = useAppTheme();
  const labels = [
    proposalOriginLabels[decision.proposalOrigin],
    ...(decision.governance
      ? [reviewClassLabels[decision.governance.reviewClass]]
      : []),
    // Factual materialization source; an automatic draft is not an approval.
    ...(decision.materializationOrigin
      ? [materializationOriginLabels[decision.materializationOrigin]]
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
          backgroundColor: theme.colors.surfaceCard,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.heading,
          { color: theme.colors.text, fontFamily: theme.fonts.bold },
        ]}
      >
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
/** One Personal answer as chat cards (facts stay with their evidence). */
function Analysis({
  value,
  latest,
}: {
  value: CoachAnalysis;
  latest: boolean;
}) {
  const theme = useAppTheme();
  return (
    <CoachMessage {...(latest ? { testID: "coach-analysis" } : {})}>
      <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
        Resumo
      </Text>
      <Text
        style={[theme.typography.bodyLG, { color: theme.colors.textPrimary }]}
      >
        {value.summary}
      </Text>
      {value.safetyFlags.length > 0 && (
        <ChecklistCard
          title="Atenção"
          icon="warning"
          tone="warning"
          items={value.safetyFlags.map((item) => item.message)}
          empty=""
        />
      )}
      <ChecklistCard
        title="Observações"
        items={value.observations.map(
          (item) =>
            `${item.statement}${item.evidence.length ? ` — baseado em ${item.evidence.length} referência(s) factual(is)` : ""}`,
        )}
        empty={NOTHING_TO_HIGHLIGHT}
      />
      {value.hypotheses.length > 0 && (
        <ChecklistCard
          title="O que pode estar acontecendo"
          icon="bulb-outline"
          items={value.hypotheses.map((item) => item.statement)}
          empty={NOTHING_TO_HIGHLIGHT}
        />
      )}
      <ChecklistCard
        title="Sugestões"
        icon="arrow-forward-circle"
        items={value.recommendations.map(
          (item) =>
            `${item.statement} — proposta para sua revisão${item.evidence.length ? `, baseada em ${item.evidence.length} referência(s) factual(is)` : ""}`,
        )}
        empty={NOTHING_TO_HIGHLIGHT}
      />
      {value.questions.length + value.uncertainties.length > 0 && (
        <ChecklistCard
          title="O que ainda falta saber"
          icon="help-circle-outline"
          items={[
            ...value.questions,
            ...value.uncertainties.map((item) => item.statement),
          ]}
          empty={NOTHING_TO_HIGHLIGHT}
        />
      )}
    </CoachMessage>
  );
}
const NOTHING_TO_HIGHLIGHT = "Nada a destacar com os dados disponíveis.";
type ThreadEntry =
  | Readonly<{ id: string; role: "user"; text: string }>
  | Readonly<{ id: string; role: "coach"; analysis: CoachAnalysis }>;
const SUGGESTIONS: readonly Suggestion[] = [
  {
    label: "Ajustar meu treino",
    icon: "barbell-outline",
    prompt:
      "Analise meus últimos treinos e sugira um ajuste concreto no meu programa ativo.",
  },
  {
    label: "Dúvida de execução",
    icon: "play-circle-outline",
    prompt: "Tenho uma dúvida sobre a execução de um exercício: ",
  },
  {
    label: "Analisar meu progresso",
    icon: "stats-chart-outline",
    prompt: "Analise meu progresso nas últimas semanas.",
  },
  {
    label: "Dúvida geral de nutrição",
    icon: "nutrition-outline",
    prompt: "Tenho uma dúvida geral de nutrição: ",
  },
];

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
      getCoachDraftAuthorityMode,
      setCoachDraftAuthorityMode,
      listCoachDraftReviewHistory,
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
    [draftAuthority, setDraftAuthority] =
      useState<CoachDraftAuthorityMode | null>(null),
    [autoDraft, setAutoDraft] = useState<AutoDraftResult | null>(null),
    [reviewStatuses, setReviewStatuses] = useState<
      ReadonlyMap<string, DraftReviewStatus>
    >(new Map()),
    [history, setHistory] = useState<CoachConversationMessage[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [proposalLoading, setProposalLoading] = useState(false),
    [decision, setDecision] = useState<CoachDecision | null>(null),
    // The proposal request finished without a concrete change (not an error).
    [noProposal, setNoProposal] = useState(false),
    [decisions, setDecisions] = useState<readonly CoachDecision[]>([]),
    [outcomes, setOutcomes] = useState<
      readonly InterventionOutcomeEvaluation[]
    >([]),
    // Shown as a chat; kept in memory only (no chat persistence).
    [thread, setThread] = useState<readonly ThreadEntry[]>([]),
    [settingsOpen, setSettingsOpen] = useState(false);
  const { snapshot } = useAppSession();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
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
  useEffect(() => {
    void getCoachDraftAuthorityMode()
      .then(setDraftAuthority)
      .catch(() => undefined);
  }, [getCoachDraftAuthorityMode]);
  useEffect(() => {
    void listCoachDraftReviewHistory(50)
      .then((history) =>
        setReviewStatuses(
          new Map(
            history.items.map((item) => [item.decisionId, item.reviewStatus]),
          ),
        ),
      )
      .catch(() => undefined);
  }, [listCoachDraftReviewHistory, decisions]);
  async function changeDraftAuthority(next: CoachDraftAuthorityMode) {
    try {
      setDraftAuthority(await setCoachDraftAuthorityMode(next));
    } catch {
      setError("Não foi possível salvar a criação automática de rascunho.");
    }
  }
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
      setNoProposal(false);
      setAnalysisRequestId(response.analysisRequestId);
      if (response.autonomyMode) setAutonomyMode(response.autonomyMode);
      setProactiveStatus(response.proactiveProposal.status);
      setAutoDraft(response.autoDraft);
      const prepared =
        response.autoDraft.decision ?? response.proactiveProposal.decision;
      setDecision(prepared);
      if (prepared)
        setDecisions((items) => [
          prepared,
          ...items.filter((item) => item.id !== prepared.id),
        ]);
      setPending(null);
      setThread((items) => [
        ...items,
        { id: `${requestId}-q`, role: "user", text },
        { id: requestId, role: "coach", analysis: result },
      ]);
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
      setNoProposal(value === null);
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
  const latestCoachId = [...thread]
    .reverse()
    .find((entry) => entry.role === "coach")?.id;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScreenBackground />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <PersonalHeader
          settingsOpen={settingsOpen}
          onOpenSettings={() => setSettingsOpen((open) => !open)}
        />
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() =>
          !settingsOpen && scroll.current?.scrollToEnd({ animated: true })
        }
      >
        {settingsOpen ? (
          <Entrance style={styles.analysis}>
            <Text style={[styles.intro, { color: theme.colors.textMuted }]}>
              O Personal analisa seu dossier de treino e responde com
              interpretações, incertezas e sugestões. Seus fatos e seu programa
              não são alterados.
            </Text>
            <AutonomyModeSection mode={autonomyMode} onChange={changeMode} />
            <DraftAuthoritySection
              mode={draftAuthority}
              autonomyMode={autonomyMode}
              onChange={changeDraftAuthority}
            />
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
                      {reviewStatuses.get(item.id) ? (
                        <Text
                          style={[
                            styles.muted,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          →{" "}
                          {
                            draftReviewStatusLabels[
                              reviewStatuses.get(item.id)!
                            ]
                          }
                        </Text>
                      ) : null}
                      {outcome ? (
                        <Text
                          style={[
                            styles.muted,
                            { color: theme.colors.textMuted },
                          ]}
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
                            style={{
                              color: theme.colors.accent,
                              fontWeight: "700",
                            }}
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
          </Entrance>
        ) : (
          <>
            <CoachMessage>
              <Text
                style={[
                  theme.typography.bodyLG,
                  { color: theme.colors.textPrimary },
                ]}
              >
                Olá
                {snapshot?.profile?.preferredName
                  ? `, ${snapshot.profile.preferredName}`
                  : ""}
                ! Como posso te ajudar hoje?
              </Text>
              <Text
                style={[
                  theme.typography.bodySM,
                  { color: theme.colors.textMuted },
                ]}
              >
                Eu analiso seus treinos registrados e respondo com
                interpretações e sugestões. Nada muda no seu programa sem a sua
                revisão.
              </Text>
            </CoachMessage>
            {thread.length === 0 ? (
              <QuickSuggestionGrid items={SUGGESTIONS} onPick={setQuestion} />
            ) : null}
            {thread.map((entry) =>
              entry.role === "user" ? (
                <UserMessage key={entry.id} text={entry.text} />
              ) : (
                <Analysis
                  key={entry.id}
                  value={entry.analysis}
                  latest={entry.id === latestCoachId}
                />
              ),
            )}
            {loading && <TypingIndicator label="Analisando…" />}
            {error && (
              <Section title="Não foi possível concluir">
                <Text
                  style={{ color: theme.colors.danger }}
                  testID="coach-error"
                >
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void send()}
                >
                  <Text style={[styles.retry, { color: theme.colors.accent }]}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </Section>
            )}
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
                  style={[
                    styles.button,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  <Text style={styles.buttonText}>
                    {proposalLoading
                      ? "Gerando proposta…"
                      : "Ver proposta de ajuste"}
                  </Text>
                </Pressable>
              )}
            {analysis && noProposal && !decision && (
              <Section title="Proposta de ajuste">
                <Text
                  style={{ color: theme.colors.textMuted }}
                  testID="coach-no-proposal"
                >
                  {NO_PROPOSAL_MESSAGE}
                </Text>
              </Section>
            )}
            {analysis && autoDraft && <AutoDraftCard result={autoDraft} />}
            {decision && (
              <Section title="Proposta de ajuste">
                <DecisionBadges decision={decision} />
                <Text style={{ color: theme.colors.text }}>
                  {decision.proposal.summary}
                </Text>
                <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
                  Programa de origem: revisão{" "}
                  {decision.proposal.sourceProgramRevision}. A proposta não
                  altera seu programa até sua decisão.
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
                      <Text
                        style={{
                          color: theme.colors.accent,
                          fontWeight: "700",
                        }}
                      >
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
          </>
        )}
      </ScrollView>
      <ChatComposer
        value={question}
        onChange={setQuestion}
        onSend={() => void send()}
        disabled={loading}
        placeholder="Pergunte ao seu Personal"
        shortcuts={[
          {
            label: "Treino de hoje",
            icon: "barbell-outline",
            onPress: () => router.push("/treino" as Href),
          },
          {
            label: "Meu progresso",
            icon: "stats-chart-outline",
            onPress: () => router.push("/progresso" as Href),
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  header: { paddingBottom: 8, paddingHorizontal: 18 },
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
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  analysis: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
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
