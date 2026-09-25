import { Link, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppSession } from "@/presentation/auth/app-session";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

export default function TodayScreen() {
  const theme = useAppTheme();
  const { snapshot } = useAppSession();
  if (!snapshot?.profile) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={[styles.safe, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.text }}>
          Perfil indisponível. Tente novamente.
        </Text>
      </SafeAreaView>
    );
  }
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const goalLabels = {
    hypertrophy: "Ganho de massa / Hipertrofia",
    fat_loss: "Redução de gordura",
    recomposition: "Recomposição corporal",
    strength: "Força",
    general_fitness: "Condicionamento geral",
  } as const;
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text }]}
      >
        {greeting}, {snapshot.profile.preferredName}
      </Text>
      <Link
        href={"/profile" as Href}
        style={{
          color: theme.colors.accent,
          fontWeight: "700",
          marginBottom: 24,
        }}
      >
        Abrir Perfil
      </Link>
      <Card
        title="PERFIL"
        color={theme.colors.surface}
        textColor={theme.colors.text}
        muted={theme.colors.textMuted}
      >
        <Text style={{ color: theme.colors.textMuted }}>Objetivo</Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {snapshot.activeGoal
            ? goalLabels[snapshot.activeGoal.goalType]
            : "Nenhum objetivo ativo"}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 14 }}>
          Peso mais recente
        </Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {snapshot.latestWeight
            ? `${snapshot.latestWeight.weightKg.toLocaleString("pt-BR")} kg`
            : "Ainda não informado"}
        </Text>
      </Card>
      <Card
        title="TREINO"
        color={theme.colors.surface}
        textColor={theme.colors.text}
        muted={theme.colors.textMuted}
      >
        <Text style={{ color: theme.colors.textMuted }}>
          Ainda não existe programa de treino.
        </Text>
      </Card>
      <Card
        title="PERSONAL"
        color={theme.colors.surface}
        textColor={theme.colors.text}
        muted={theme.colors.textMuted}
      >
        <Text style={{ color: theme.colors.textMuted }}>
          Será habilitado em uma fase futura.
        </Text>
      </Card>
    </SafeAreaView>
  );
}

function Card({
  children,
  color,
  muted,
  textColor,
  title,
}: {
  children: React.ReactNode;
  color: string;
  muted: string;
  textColor: string;
  title: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <Text style={[styles.eyebrow, { color: muted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24 },
  title: { fontSize: 30, fontWeight: "800", marginBottom: 8 },
  card: { borderRadius: 16, marginBottom: 14, padding: 18 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
  },
  value: { fontSize: 18, fontWeight: "700", marginTop: 3 },
});
