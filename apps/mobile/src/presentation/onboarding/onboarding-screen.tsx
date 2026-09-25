import {
  availabilityInputSchema,
  bodyWeightInputSchema,
  createCompleteOnboardingSchema,
  goalInputSchema,
  profileInputSchema,
  trainingContextInputSchema,
} from "@athlete-coach/application";
import type {
  GoalType,
  TrainingConsistency,
  TrainingEnvironment,
  Weekday,
} from "@athlete-coach/domain";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppSession } from "@/presentation/auth/app-session";
import {
  ChoiceButton,
  FormField,
  FormMessage,
  PrimaryButton,
  SecondaryButton,
} from "@/presentation/components/form-controls";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { nextOnboardingStep } from "./onboarding-flow";

const goalOptions: readonly [GoalType, string][] = [
  ["hypertrophy", "Ganho de massa / Hipertrofia"],
  ["fat_loss", "Redução de gordura"],
  ["recomposition", "Recomposição corporal"],
  ["strength", "Força"],
  ["general_fitness", "Condicionamento geral"],
];
const consistencyOptions: readonly [TrainingConsistency, string][] = [
  ["restarting", "Retomando"],
  ["irregular", "Irregular"],
  ["consistent", "Consistente"],
];
const environmentOptions: readonly [TrainingEnvironment, string][] = [
  ["commercial_gym", "Academia comercial"],
  ["home_gym", "Academia em casa"],
  ["mixed", "Misto"],
  ["other", "Outro"],
];
const weekdayOptions: readonly [Weekday, string][] = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [7, "Dom"],
];

type Draft = {
  preferredName: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goalType: GoalType;
  targetWeightKg: string;
  goalNotes: string;
  resistanceTrainingMonths: string;
  recentTrainingConsistency: TrainingConsistency;
  preferredSessionDurationMinutes: string;
  trainingEnvironment: TrainingEnvironment;
  routineSummary: string;
  availableWeekdays: Weekday[];
  constraintsNotes: string;
  preferencesNotes: string;
};

const initialDraft: Draft = {
  preferredName: "",
  birthDate: "",
  heightCm: "",
  weightKg: "",
  goalType: "general_fitness",
  targetWeightKg: "",
  goalNotes: "",
  resistanceTrainingMonths: "0",
  recentTrainingConsistency: "restarting",
  preferredSessionDurationMinutes: "60",
  trainingEnvironment: "commercial_gym",
  routineSummary: "",
  availableWeekdays: [],
  constraintsNotes: "",
  preferencesNotes: "",
};

function optionalNumber(value: string): number | undefined {
  return value.trim() ? Number(value.replace(",", ".")) : undefined;
}
function numberValue(value: string): number {
  return Number(value.replace(",", "."));
}

export function OnboardingScreen() {
  const theme = useAppTheme();
  const session = useAppSession();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [validation, setValidation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const payload = () => ({
    preferredName: draft.preferredName,
    birthDate: draft.birthDate,
    heightCm: numberValue(draft.heightCm),
    timezone,
    weightKg: numberValue(draft.weightKg),
    measuredAt: new Date().toISOString(),
    goalType: draft.goalType,
    targetWeightKg: optionalNumber(draft.targetWeightKg),
    goalNotes: draft.goalNotes || undefined,
    resistanceTrainingMonths: numberValue(draft.resistanceTrainingMonths),
    recentTrainingConsistency: draft.recentTrainingConsistency,
    preferredSessionDurationMinutes: numberValue(
      draft.preferredSessionDurationMinutes,
    ),
    trainingEnvironment: draft.trainingEnvironment,
    routineSummary: draft.routineSummary,
    availableWeekdays: draft.availableWeekdays,
    constraintsNotes: draft.constraintsNotes || undefined,
    preferencesNotes: draft.preferencesNotes || undefined,
  });

  function validateCurrent(): boolean {
    const value = payload();
    const result =
      step === 1
        ? profileInputSchema.and(bodyWeightInputSchema).safeParse(value)
        : step === 2
          ? goalInputSchema.safeParse(value)
          : step === 3
            ? trainingContextInputSchema
                .pick({
                  resistanceTrainingMonths: true,
                  recentTrainingConsistency: true,
                })
                .safeParse(value)
            : step === 4
              ? trainingContextInputSchema
                  .pick({
                    preferredSessionDurationMinutes: true,
                    trainingEnvironment: true,
                    routineSummary: true,
                  })
                  .safeParse(value)
              : step === 5
                ? availabilityInputSchema.safeParse(value)
                : step === 6
                  ? trainingContextInputSchema.safeParse(value)
                  : createCompleteOnboardingSchema().safeParse(value);
    if (!result.success) {
      setValidation(result.error.issues[0]?.message ?? "Confira os campos.");
      return false;
    }
    setValidation(null);
    return true;
  }

  async function finish() {
    const result = createCompleteOnboardingSchema().safeParse(payload());
    if (!result.success) {
      setValidation(result.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setBusy(true);
    try {
      await session.completeOnboarding(result.data);
    } catch {
      /* context exposes safe error */
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const valid = step === 0 || validateCurrent();
    setStep((current) => nextOnboardingStep(current, valid));
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function toggleWeekday(day: Weekday) {
    update(
      "availableWeekdays",
      draft.availableWeekdays.includes(day)
        ? draft.availableWeekdays.filter((value) => value !== day)
        : [...draft.availableWeekdays, day].sort(),
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.progress, { color: theme.colors.accent }]}>
            ETAPA {step + 1} DE 8
          </Text>
          {step === 0 ? (
            <Step
              title="Vamos começar"
              text="Essas informações serão usadas para personalizar futuramente seu treinamento. Coletamos somente o necessário e você poderá editar depois."
            />
          ) : null}
          {step === 1 ? (
            <>
              <Step
                title="Sobre você"
                text="Use medidas atuais em kg e cm. Estes limites detectam erros de digitação; não são avaliação de saúde."
              />
              <FormField
                label="Como prefere ser chamado"
                value={draft.preferredName}
                onChangeText={(v) => update("preferredName", v)}
              />
              <FormField
                label="Data de nascimento (AAAA-MM-DD)"
                keyboardType="numbers-and-punctuation"
                value={draft.birthDate}
                onChangeText={(v) => update("birthDate", v)}
              />
              <FormField
                label="Altura (cm)"
                keyboardType="decimal-pad"
                value={draft.heightCm}
                onChangeText={(v) => update("heightCm", v)}
              />
              <FormField
                label="Peso atual (kg)"
                keyboardType="decimal-pad"
                value={draft.weightKg}
                onChangeText={(v) => update("weightKg", v)}
              />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Step
                title="Seu objetivo"
                text="Escolha o foco principal. Meta de peso é opcional e não representa peso ideal."
              />
              <ChoiceList
                options={goalOptions}
                selected={draft.goalType}
                onSelect={(v) => update("goalType", v)}
              />
              <FormField
                label="Meta de peso opcional (kg)"
                keyboardType="decimal-pad"
                value={draft.targetWeightKg}
                onChangeText={(v) => update("targetWeightKg", v)}
              />
              <FormField
                label="Notas opcionais"
                maxLength={1000}
                multiline
                value={draft.goalNotes}
                onChangeText={(v) => update("goalNotes", v)}
              />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Step
                title="Experiência"
                text="Informe o tempo aproximado de treino resistido e sua consistência recente."
              />
              <FormField
                label="Meses de treino resistido"
                keyboardType="number-pad"
                value={draft.resistanceTrainingMonths}
                onChangeText={(v) => update("resistanceTrainingMonths", v)}
              />
              <ChoiceList
                options={consistencyOptions}
                selected={draft.recentTrainingConsistency}
                onSelect={(v) => update("recentTrainingConsistency", v)}
              />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Step
                title="Sua rotina"
                text="Não informe empresa, endereço ou localização exata."
              />
              <ChoiceList
                options={environmentOptions}
                selected={draft.trainingEnvironment}
                onSelect={(v) => update("trainingEnvironment", v)}
              />
              <FormField
                label="Duração típica disponível (minutos)"
                keyboardType="number-pad"
                value={draft.preferredSessionDurationMinutes}
                onChangeText={(v) =>
                  update("preferredSessionDurationMinutes", v)
                }
              />
              <FormField
                label="Resumo curto da rotina"
                maxLength={500}
                multiline
                value={draft.routineSummary}
                onChangeText={(v) => update("routineSummary", v)}
              />
            </>
          ) : null}
          {step === 5 ? (
            <>
              <Step
                title="Disponibilidade"
                text="Selecione os dias normalmente disponíveis. 1 representa segunda-feira e 7 domingo."
              />
              <View style={styles.wrap}>
                {weekdayOptions.map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    label={label}
                    selected={draft.availableWeekdays.includes(value)}
                    onPress={() => toggleWeekday(value)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {step === 6 ? (
            <>
              <Step
                title="Observações"
                text="Campos opcionais. Não diagnosticamos lesões; se houver dor ou sintomas preocupantes, procure avaliação profissional."
              />
              <FormField
                label="Limitações ou desconfortos relevantes"
                maxLength={1000}
                multiline
                value={draft.constraintsNotes}
                onChangeText={(v) => update("constraintsNotes", v)}
              />
              <FormField
                label="Preferências"
                maxLength={1000}
                multiline
                value={draft.preferencesNotes}
                onChangeText={(v) => update("preferencesNotes", v)}
              />
            </>
          ) : null}
          {step === 7 ? (
            <>
              <Step
                title="Revise seus dados"
                text="Nada será salvo até você confirmar."
              />
              <Review label="Nome" value={draft.preferredName} />
              <Review label="Nascimento" value={draft.birthDate} />
              <Review label="Altura" value={`${draft.heightCm} cm`} />
              <Review label="Peso atual" value={`${draft.weightKg} kg`} />
              <Review
                label="Objetivo"
                value={
                  goalOptions.find(
                    ([value]) => value === draft.goalType,
                  )?.[1] ?? draft.goalType
                }
              />
              <Review
                label="Disponibilidade"
                value={draft.availableWeekdays
                  .map(
                    (day) =>
                      weekdayOptions.find(([value]) => value === day)?.[1],
                  )
                  .join(", ")}
              />
            </>
          ) : null}
          {validation ? <FormMessage>{validation}</FormMessage> : null}
          {session.error ? <FormMessage>{session.error}</FormMessage> : null}
          <View style={styles.actions}>
            {step > 0 ? (
              <SecondaryButton
                label="Voltar"
                onPress={() => {
                  setValidation(null);
                  setStep((current) => current - 1);
                }}
              />
            ) : null}
            <PrimaryButton
              disabled={busy}
              label={
                step === 7
                  ? busy
                    ? "Salvando…"
                    : "Concluir onboarding"
                  : "Continuar"
              }
              onPress={() => (step === 7 ? void finish() : next())}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ text, title }: { text: string; title: string }) {
  const theme = useAppTheme();
  return (
    <View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text }]}
      >
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}
function ChoiceList<T extends string>({
  onSelect,
  options,
  selected,
}: {
  onSelect(value: T): void;
  options: readonly (readonly [T, string])[];
  selected: T;
}) {
  return (
    <View style={styles.choiceList}>
      {options.map(([value, label]) => (
        <ChoiceButton
          key={value}
          label={label}
          selected={selected === value}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.review, { borderBottomColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.textMuted }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
        {value || "Não informado"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  progress: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: { fontSize: 30, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginBottom: 24 },
  choiceList: { gap: 10, marginBottom: 18 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  actions: { gap: 10, marginTop: 10 },
  review: { borderBottomWidth: 1, gap: 5, paddingVertical: 12 },
});
