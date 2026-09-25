import {
  availabilityInputSchema,
  bodyWeightInputSchema,
  profileInputSchema,
  trainingContextInputSchema,
} from "@athlete-coach/application";
import { deriveAge, type Weekday } from "@athlete-coach/domain";
import { useState, type PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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

const weekdays: readonly [Weekday, string][] = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [7, "Dom"],
];
const goalLabels = {
  hypertrophy: "Ganho de massa / Hipertrofia",
  fat_loss: "Redução de gordura",
  recomposition: "Recomposição corporal",
  strength: "Força",
  general_fitness: "Condicionamento geral",
} as const;

export function ProfileScreen() {
  const theme = useAppTheme();
  const session = useAppSession();
  const snapshot = session.snapshot;
  const [name, setName] = useState(
    () => snapshot?.profile?.preferredName ?? "",
  );
  const [birth, setBirth] = useState(() => snapshot?.profile?.birthDate ?? "");
  const [height, setHeight] = useState(() =>
    snapshot?.profile ? String(snapshot.profile.heightCm) : "",
  );
  const [months, setMonths] = useState(() =>
    snapshot?.trainingContext
      ? String(snapshot.trainingContext.resistanceTrainingMonths)
      : "",
  );
  const [duration, setDuration] = useState(() =>
    snapshot?.trainingContext
      ? String(snapshot.trainingContext.preferredSessionDurationMinutes)
      : "",
  );
  const [routine, setRoutine] = useState(
    () => snapshot?.trainingContext?.routineSummary ?? "",
  );
  const [constraints, setConstraints] = useState(
    () => snapshot?.trainingContext?.constraintsNotes ?? "",
  );
  const [preferences, setPreferences] = useState(
    () => snapshot?.trainingContext?.preferencesNotes ?? "",
  );
  const [days, setDays] = useState<Weekday[]>(() =>
    snapshot ? [...snapshot.availableWeekdays] : [],
  );
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!snapshot?.profile || !snapshot.trainingContext)
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.text }}>
          Dados do perfil indisponíveis.
        </Text>
      </SafeAreaView>
    );

  async function saveProfile() {
    const input = {
      preferredName: name,
      birthDate: birth,
      heightCm: Number(height.replace(",", ".")),
      timezone: snapshot!.profile!.timezone,
    };
    const parsed = profileInputSchema.safeParse(input);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira os dados.");
      return;
    }
    setBusy(true);
    try {
      await session.updateProfile(parsed.data);
      setMessage("Perfil atualizado.");
    } catch {
    } finally {
      setBusy(false);
    }
  }
  async function saveTraining() {
    const current = snapshot!.trainingContext!;
    const input = {
      resistanceTrainingMonths: Number(months),
      recentTrainingConsistency: current.recentTrainingConsistency,
      preferredSessionDurationMinutes: Number(duration),
      trainingEnvironment: current.trainingEnvironment,
      routineSummary: routine,
      constraintsNotes: constraints || undefined,
      preferencesNotes: preferences || undefined,
      averageSleepMinutes: current.averageSleepMinutes ?? undefined,
    };
    const parsed = trainingContextInputSchema.safeParse(input);
    const availability = availabilityInputSchema.safeParse({
      availableWeekdays: days,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira os dados.");
      return;
    }
    if (!availability.success) {
      setMessage(availability.error.issues[0]?.message ?? "Confira os dados.");
      return;
    }
    setBusy(true);
    try {
      await session.updateTrainingContext(parsed.data);
      await session.setAvailability(availability.data);
      setMessage("Contexto de treino atualizado.");
    } catch {
    } finally {
      setBusy(false);
    }
  }
  async function addWeight() {
    const parsed = bodyWeightInputSchema.safeParse({
      measuredAt: new Date().toISOString(),
      weightKg: Number(weight.replace(",", ".")),
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira o peso.");
      return;
    }
    setBusy(true);
    try {
      await session.recordWeight(parsed.data);
      setWeight("");
      setMessage("Nova pesagem registrada sem alterar o histórico.");
    } catch {
    } finally {
      setBusy(false);
    }
  }
  function toggle(day: Weekday) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.summary, { color: theme.colors.textMuted }]}>
          Idade derivada: {deriveAge(snapshot.profile.birthDate, new Date())}{" "}
          anos
        </Text>
        <Section title="Objetivo atual">
          <Text style={{ color: theme.colors.text }}>
            {snapshot.activeGoal
              ? goalLabels[snapshot.activeGoal.goalType]
              : "Nenhum objetivo ativo"}
          </Text>
          {snapshot.activeGoal?.targetWeightKg ? (
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
              Meta opcional: {snapshot.activeGoal.targetWeightKg} kg
            </Text>
          ) : null}
        </Section>
        <Section title="Dados pessoais">
          <FormField
            label="Nome preferido"
            value={name}
            onChangeText={setName}
          />
          <FormField
            label="Nascimento (AAAA-MM-DD)"
            value={birth}
            onChangeText={setBirth}
          />
          <FormField
            label="Altura (cm)"
            keyboardType="decimal-pad"
            value={height}
            onChangeText={setHeight}
          />
          <PrimaryButton
            disabled={busy}
            label="Salvar dados pessoais"
            onPress={() => void saveProfile()}
          />
        </Section>
        <Section title="Contexto de treino">
          <FormField
            label="Meses de treino resistido"
            keyboardType="number-pad"
            value={months}
            onChangeText={setMonths}
          />
          <FormField
            label="Duração disponível (minutos)"
            keyboardType="number-pad"
            value={duration}
            onChangeText={setDuration}
          />
          <FormField
            label="Resumo da rotina"
            multiline
            maxLength={500}
            value={routine}
            onChangeText={setRoutine}
          />
          <FormField
            label="Limitações ou desconfortos"
            multiline
            maxLength={1000}
            value={constraints}
            onChangeText={setConstraints}
          />
          <FormField
            label="Preferências"
            multiline
            maxLength={1000}
            value={preferences}
            onChangeText={setPreferences}
          />
          <View style={styles.days}>
            {weekdays.map(([day, label]) => (
              <ChoiceButton
                key={day}
                label={label}
                selected={days.includes(day)}
                onPress={() => toggle(day)}
              />
            ))}
          </View>
          <PrimaryButton
            disabled={busy}
            label="Salvar contexto"
            onPress={() => void saveTraining()}
          />
        </Section>
        <Section title="Peso">
          <Text style={{ color: theme.colors.textMuted, marginBottom: 12 }}>
            Mais recente:{" "}
            {snapshot.latestWeight
              ? `${snapshot.latestWeight.weightKg.toLocaleString("pt-BR")} kg em ${new Date(snapshot.latestWeight.measuredAt).toLocaleDateString("pt-BR")}`
              : "não informado"}
          </Text>
          <FormField
            label="Novo peso (kg)"
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />
          <PrimaryButton
            disabled={busy}
            label="Registrar nova pesagem"
            onPress={() => void addWeight()}
          />
        </Section>
        {message ? (
          <FormMessage
            tone={
              message.includes("atualiz") || message.includes("registrada")
                ? "info"
                : "error"
            }
          >
            {message}
          </FormMessage>
        ) : null}
        {session.error ? <FormMessage>{session.error}</FormMessage> : null}
        <SecondaryButton
          label="Sair da conta"
          onPress={() => void session.signOut()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ children, title }: PropsWithChildren<{ title: string }>) {
  const theme = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  summary: { marginBottom: 14 },
  section: { borderRadius: 16, marginBottom: 18, padding: 18 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
});
