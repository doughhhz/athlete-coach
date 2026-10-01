import { programIntakeInputSchema } from "@athlete-coach/application";
import type { Equipment } from "@athlete-coach/domain";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppSession } from "@/presentation/auth/app-session";
import {
  ChoiceButton,
  FormField,
  FormMessage,
  PrimaryButton,
  SecondaryButton,
} from "@/presentation/components/form-controls";
import { newIdempotencyKey } from "@/presentation/idempotency-key";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import {
  BASIC_TEMPLATE_NOTICE,
  canOfferBasicTemplate,
  DRAFT_NOTICE,
  EQUIPMENT_HINT,
  INITIAL_PROGRAM_GENERATING,
  INITIAL_PROGRAM_INTRO,
  initialProgramErrorMessage,
} from "./initial-program-labels";

type Draft = {
  currentPainOrInjury: boolean;
  painOrInjuryNotes: string;
  medicalExerciseRestriction: boolean;
  preferredExercisesNotes: string;
  avoidedExercisesNotes: string;
  otherSportsNotes: string;
  informEquipment: boolean;
  availableEquipment: string[];
};
const emptyDraft: Draft = {
  currentPainOrInjury: false,
  painOrInjuryNotes: "",
  medicalExerciseRestriction: false,
  preferredExercisesNotes: "",
  avoidedExercisesNotes: "",
  otherSportsNotes: "",
  informEquipment: false,
  availableEquipment: [],
};
type Failure = Readonly<{ message: string; offerBasic: boolean }>;
/** Server error code and reason, read by shape (no infrastructure import). */
function errorDetails(error: unknown): { code: string; reason: string | null } {
  const value = error as { code?: unknown; reason?: unknown } | null;
  return {
    code: typeof value?.code === "string" ? value.code : "program_failed",
    reason: typeof value?.reason === "string" ? value.reason : null,
  };
}

/**
 * Last onboarding step (ADR-0119): a few more answers, then the Personal
 * builds the first program as a draft. The screen only collects input and
 * shows outcomes; rules live in the domain/application and the backend.
 */
export function InitialProgramScreen() {
  const app = useAppSession(),
    theme = useAppTheme(),
    router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft),
    [equipment, setEquipment] = useState<readonly Equipment[]>([]),
    [loading, setLoading] = useState(true),
    [generating, setGenerating] = useState(false),
    [validation, setValidation] = useState<string | null>(null),
    [failure, setFailure] = useState<Failure | null>(null),
    [refusal, setRefusal] = useState<string | null>(null);
  // One creation intent per mode: a retry of the same intent reuses its key.
  const intents = useRef({
    personal: newIdempotencyKey(),
    basic: newIdempotencyKey(),
  });

  useEffect(() => {
    app.dismissInitialProgramOffer();
    let active = true;
    void Promise.all([app.getProgramIntake(), app.listExerciseFacets()])
      .then(([intake, facets]) => {
        if (!active) return;
        setEquipment(facets.equipment);
        if (intake)
          setDraft({
            currentPainOrInjury: intake.currentPainOrInjury,
            painOrInjuryNotes: intake.painOrInjuryNotes ?? "",
            medicalExerciseRestriction: intake.medicalExerciseRestriction,
            preferredExercisesNotes: intake.preferredExercisesNotes ?? "",
            avoidedExercisesNotes: intake.avoidedExercisesNotes ?? "",
            otherSportsNotes: intake.otherSportsNotes ?? "",
            informEquipment: !!intake.availableEquipment?.length,
            availableEquipment: [...(intake.availableEquipment ?? [])],
          });
      })
      .catch(() => {
        /* the form still works without previous answers */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Load once per screen visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function toggleEquipment(slug: string) {
    setDraft((current) => ({
      ...current,
      availableEquipment: current.availableEquipment.includes(slug)
        ? current.availableEquipment.filter((item) => item !== slug)
        : [...current.availableEquipment, slug],
    }));
  }

  async function generate(mode: "personal" | "basic") {
    setValidation(null);
    setFailure(null);
    setRefusal(null);
    const parsed = programIntakeInputSchema.safeParse({
      currentPainOrInjury: draft.currentPainOrInjury,
      painOrInjuryNotes: draft.currentPainOrInjury
        ? draft.painOrInjuryNotes
        : undefined,
      medicalExerciseRestriction: draft.medicalExerciseRestriction,
      preferredExercisesNotes: draft.preferredExercisesNotes,
      avoidedExercisesNotes: draft.avoidedExercisesNotes,
      otherSportsNotes: draft.otherSportsNotes,
      availableEquipment: draft.informEquipment
        ? draft.availableEquipment
        : undefined,
    });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? "Confira as respostas.");
      return;
    }
    setGenerating(true);
    try {
      await app.saveProgramIntake(parsed.data);
      const result = await app.generateInitialProgram(
        mode,
        intents.current[mode],
      );
      if (result.status === "created") {
        router.replace(`/programs/${result.programId}` as Href);
        return;
      }
      setRefusal(result.reason);
    } catch (error) {
      const { code, reason } = errorDetails(error);
      setFailure({
        message: initialProgramErrorMessage(code, reason),
        offerBasic: mode === "personal" && canOfferBasicTemplate(code),
      });
    } finally {
      setGenerating(false);
    }
  }

  if (loading)
    return (
      <ActivityIndicator style={{ margin: 40 }} color={theme.colors.accent} />
    );
  if (generating)
    return (
      <View style={[s.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text
          testID="initial-program-generating"
          style={[s.centerText, { color: theme.colors.text }]}
        >
          {INITIAL_PROGRAM_GENERATING}
        </Text>
      </View>
    );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
    >
      <Text
        accessibilityRole="header"
        style={[s.title, { color: theme.colors.text }]}
      >
        Seu programa
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {INITIAL_PROGRAM_INTRO}
      </Text>

      <Text style={[s.question, { color: theme.colors.text }]}>
        Você tem alguma dor ou lesão atualmente?
      </Text>
      <View style={s.row}>
        <ChoiceButton
          label="Não"
          selected={!draft.currentPainOrInjury}
          onPress={() => update("currentPainOrInjury", false)}
          testID="intake-pain-no"
        />
        <ChoiceButton
          label="Sim"
          selected={draft.currentPainOrInjury}
          onPress={() => update("currentPainOrInjury", true)}
          testID="intake-pain-yes"
        />
      </View>
      {draft.currentPainOrInjury ? (
        <FormField
          label="Onde é e como se manifesta?"
          value={draft.painOrInjuryNotes}
          onChangeText={(value) => update("painOrInjuryNotes", value)}
          multiline
          testID="intake-pain-notes"
        />
      ) : null}

      <Text style={[s.question, { color: theme.colors.text }]}>
        Algum profissional de saúde restringiu atividade física para você?
      </Text>
      <View style={s.row}>
        <ChoiceButton
          label="Não"
          selected={!draft.medicalExerciseRestriction}
          onPress={() => update("medicalExerciseRestriction", false)}
          testID="intake-medical-no"
        />
        <ChoiceButton
          label="Sim"
          selected={draft.medicalExerciseRestriction}
          onPress={() => update("medicalExerciseRestriction", true)}
          testID="intake-medical-yes"
        />
      </View>

      <FormField
        label="Exercícios de que você gosta (opcional)"
        value={draft.preferredExercisesNotes}
        onChangeText={(value) => update("preferredExercisesNotes", value)}
        testID="intake-preferred"
      />
      <FormField
        label="Exercícios que prefere evitar (opcional)"
        value={draft.avoidedExercisesNotes}
        onChangeText={(value) => update("avoidedExercisesNotes", value)}
        testID="intake-avoided"
      />
      <FormField
        label="Outros esportes ou atividades (opcional)"
        placeholder="Ex.: futebol aos sábados"
        value={draft.otherSportsNotes}
        onChangeText={(value) => update("otherSportsNotes", value)}
        testID="intake-other-sports"
      />

      <Text style={[s.question, { color: theme.colors.text }]}>
        Equipamentos disponíveis
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>{EQUIPMENT_HINT}</Text>
      <View style={s.row}>
        <ChoiceButton
          label="Não informar"
          selected={!draft.informEquipment}
          onPress={() => update("informEquipment", false)}
          testID="intake-equipment-skip"
        />
        <ChoiceButton
          label="Informar"
          selected={draft.informEquipment}
          onPress={() => update("informEquipment", true)}
          testID="intake-equipment-inform"
        />
      </View>
      {draft.informEquipment ? (
        <View style={s.wrap}>
          {equipment.map((item) => (
            <ChoiceButton
              key={item.slug}
              label={item.namePt}
              selected={draft.availableEquipment.includes(item.slug)}
              onPress={() => toggleEquipment(item.slug)}
            />
          ))}
        </View>
      ) : null}

      {validation ? <FormMessage>{validation}</FormMessage> : null}
      {refusal ? (
        <View testID="initial-program-refusal" style={s.notice}>
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
            O Personal preferiu não montar um programa agora
          </Text>
          <Text style={{ color: theme.colors.text }}>{refusal}</Text>
        </View>
      ) : null}
      {failure ? (
        <View testID="initial-program-error" style={s.notice}>
          <FormMessage>{failure.message}</FormMessage>
          {failure.offerBasic ? (
            <>
              <Text style={{ color: theme.colors.textMuted }}>
                {BASIC_TEMPLATE_NOTICE}
              </Text>
              <SecondaryButton
                label="Usar modelo básico do sistema"
                onPress={() => void generate("basic")}
                testID="initial-program-basic"
              />
            </>
          ) : null}
        </View>
      ) : null}

      <Text style={{ color: theme.colors.textMuted }}>{DRAFT_NOTICE}</Text>
      <PrimaryButton
        label={
          failure
            ? "Tentar de novo com o Personal"
            : "Montar meu programa com o Personal"
        }
        onPress={() => void generate("personal")}
        testID="initial-program-generate"
      />
      <SecondaryButton
        label="Agora não, prefiro montar depois"
        onPress={() => router.replace("/" as Href)}
        testID="initial-program-skip"
      />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { gap: 14, padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  question: { fontSize: 16, fontWeight: "700", marginTop: 6 },
  row: { flexDirection: "row", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  notice: { gap: 8 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  centerText: { fontSize: 16, textAlign: "center" },
});
