import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Outline action with the neon border. */
export function OutlineButton({
  label,
  onPress,
  icon,
  testID,
}: {
  label: string;
  onPress(): void;
  icon?: IconName;
  /** Stable E2E selector (Maestro); never read by application logic. */
  testID?: string;
}) {
  const { colors, fonts } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        s.outline,
        { borderColor: colors.borderGlow, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
      <Text
        style={[
          s.outlineText,
          { color: "#EAF1FB", fontFamily: fonts.semibold },
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function Card({
  children,
  glow = false,
}: {
  children: ReactNode;
  glow?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: glow ? colors.borderGlow : colors.border,
        },
        glow ? [s.glow, { shadowColor: colors.borderGlow }] : null,
      ]}
    >
      {children}
    </View>
  );
}

/** Time-of-day greeting with the athlete's name. */
export function GreetingSection({
  greeting,
  name,
  icon,
  onOpenProfile,
}: {
  greeting: string;
  name: string;
  icon: IconName;
  onOpenProfile(): void;
}) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={s.greeting}>
      <View style={s.greetingText}>
        <Ionicons
          name={icon}
          size={24}
          color="#FFC247"
          style={{ marginTop: 6 }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={[
              typography.titleXL,
              { color: colors.textPrimary, fontSize: 30, lineHeight: 36 },
            ]}
          >
            {greeting}, {name}
          </Text>
          <Text style={[typography.bodyLG, { color: colors.textSecondary }]}>
            Vamos evoluir mais um pouco hoje?
          </Text>
        </View>
      </View>
      <OutlineButton
        label="Abrir perfil"
        onPress={onOpenProfile}
        testID="home-open-profile"
      />
    </View>
  );
}

function Divider() {
  const { colors } = useAppTheme();
  return <View style={[s.vDivider, { backgroundColor: colors.border }]} />;
}

/** Goal, latest weight and the Personal, side by side. */
export function ProfileSummaryCard({
  goal,
  goalDetail,
  weight,
  weightDetail,
}: {
  goal: string;
  goalDetail: string;
  weight: string;
  weightDetail: string;
}) {
  const { colors, typography } = useAppTheme();
  return (
    <Card glow>
      <View style={s.summaryRow}>
        <View style={s.summaryCell}>
          <Text
            style={[
              typography.caption,
              { color: colors.primary, letterSpacing: 1.8 },
            ]}
          >
            SEU PERFIL
          </Text>
          <Text
            style={[typography.titleMD, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {goal}
          </Text>
          <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
            {goalDetail}
          </Text>
        </View>
        <Divider />
        <View style={[s.summaryCell, s.center]}>
          <Ionicons name="scale-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodySM, { color: colors.textSecondary }]}>
            Peso recente
          </Text>
          <Text
            style={[
              typography.titleMD,
              { color: colors.textPrimary, fontSize: 18 },
            ]}
          >
            {weight}
          </Text>
          <Text style={[typography.bodySM, { color: colors.textMuted }]}>
            {weightDetail}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** The visual highlight: today's (or the next) workout. */
export function TodayWorkoutCard({
  caption,
  title,
  subtitle,
  progress,
  action,
}: {
  caption: string;
  title: string;
  subtitle: string | null;
  progress: Readonly<{ finished: number; total: number }> | null;
  action: ReactNode;
}) {
  const { colors, typography } = useAppTheme();
  const ratio =
    progress && progress.total ? progress.finished / progress.total : 0;
  return (
    <Card glow>
      <View style={s.workoutTop}>
        <View style={{ flex: 1, gap: 10 }}>
          <Text
            style={[
              typography.caption,
              { color: colors.primary, letterSpacing: 2 },
            ]}
          >
            {caption}
          </Text>
          <Text
            style={[
              typography.titleLG,
              { color: colors.textPrimary, fontSize: 26, lineHeight: 32 },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={2}
              style={[typography.bodyLG, { color: colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          ) : null}
          {progress ? (
            <>
              <View style={s.row}>
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[typography.titleMD, { color: colors.textPrimary }]}
                >
                  {progress.finished} de {progress.total}
                </Text>
                <Text
                  style={[typography.bodyMD, { color: colors.textSecondary }]}
                >
                  exercícios
                </Text>
              </View>
              <View style={[s.track, { backgroundColor: "#23374F" }]}>
                <View
                  style={[
                    s.fill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.round(ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}
        </View>
        <LinearGradient
          colors={["rgba(30,220,255,0.25)", "rgba(29,92,255,0.08)"]}
          style={s.art}
        >
          <Ionicons name="barbell" size={52} color={colors.primary} />
        </LinearGradient>
      </View>
      {action}
    </Card>
  );
}

export type StatItem = Readonly<{
  title: string;
  value: string;
  detail: string;
  icon: IconName;
  /** 0..1 progress bar, when meaningful. */
  progress?: number;
}>;
/** Compact 2 x 2 facts. */
export function StatsGrid({ items }: { items: readonly StatItem[] }) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={s.grid}>
      {items.map((item) => (
        <View
          key={item.title}
          style={[
            s.stat,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          <View style={s.statHead}>
            <Text
              style={[
                typography.bodySM,
                { color: colors.textSecondary, flex: 1 },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Ionicons name={item.icon} size={18} color={colors.primary} />
          </View>
          <Text
            style={[typography.titleLG, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.value}
          </Text>
          {item.progress !== undefined ? (
            <View style={[s.track, { backgroundColor: "#23374F" }]}>
              <View
                style={[
                  s.fill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.round(Math.min(1, item.progress) * 100)}%`,
                  },
                ]}
              />
            </View>
          ) : null}
          <Text
            style={[typography.bodySM, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {item.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The Personal and a clear way to talk to it. */
export function TrainerCard({ onOpen }: { onOpen(): void }) {
  const { colors, typography } = useAppTheme();
  return (
    <Card>
      <Text
        style={[
          typography.titleMD,
          { color: colors.textPrimary, fontSize: 18 },
        ]}
      >
        Seu Personal
      </Text>
      <View style={s.trainerRow}>
        <View style={[s.avatar, { borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={26} color={colors.primary} />
          <View
            style={[
              s.online,
              {
                backgroundColor: colors.success,
                borderColor: colors.surfaceCard,
              },
            ]}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.titleMD, { color: colors.textPrimary }]}>
            Personal por IA
          </Text>
          <Text
            style={[typography.bodyMD, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            Pergunte sobre seus treinos e peça ajustes no programa.
          </Text>
        </View>
      </View>
      <OutlineButton
        label="Conversar com o Personal"
        icon="chatbubble-ellipses-outline"
        onPress={onOpen}
        testID="home-open-personal"
      />
    </Card>
  );
}

export type QuickAction = Readonly<{
  title: string;
  subtitle: string;
  icon: IconName;
  onPress(): void;
}>;
export function QuickAccessGrid({ items }: { items: readonly QuickAction[] }) {
  const { colors, typography } = useAppTheme();
  return (
    <View style={{ gap: 14 }}>
      <Text
        style={[
          typography.titleMD,
          { color: colors.textPrimary, fontSize: 18 },
        ]}
      >
        Acesso rápido
      </Text>
      <View style={s.grid}>
        {items.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => [
              s.quick,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons name={item.icon} size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.titleMD,
                  { color: colors.textPrimary, fontSize: 15 },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[typography.bodySM, { color: colors.textSecondary }]}
              >
                {item.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#AFC0D8" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  center: { alignItems: "center" },
  outline: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  outlineText: { fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, gap: 16, padding: 16 },
  glow: {
    elevation: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  greeting: { gap: 14 },
  greetingText: { flexDirection: "row", gap: 12 },
  vDivider: { alignSelf: "stretch", width: 1 },
  summaryRow: { flexDirection: "row", gap: 14 },
  summaryCell: { flex: 1, gap: 4 },
  workoutTop: { flexDirection: "row", gap: 12 },
  art: {
    alignItems: "center",
    borderRadius: 18,
    height: 110,
    justifyContent: "center",
    width: 110,
  },
  track: { borderRadius: 999, height: 6, overflow: "hidden" },
  fill: { borderRadius: 999, height: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: {
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 8,
    padding: 14,
  },
  statHead: { flexDirection: "row", gap: 8 },
  trainerRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  avatar: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 1,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  online: {
    borderRadius: 7,
    borderWidth: 2,
    bottom: 2,
    height: 14,
    position: "absolute",
    right: 2,
    width: 14,
  },
  quick: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 10,
    padding: 14,
  },
});
