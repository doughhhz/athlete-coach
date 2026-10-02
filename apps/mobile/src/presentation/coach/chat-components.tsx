import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PressableScale } from "@/presentation/components/motion";
import { useAppTheme } from "@/presentation/theme/use-app-theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Personal avatar: an icon mark (no persona photo, personal-spec-v1). */
export function PersonalAvatar({ size = 48 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ height: size, width: size }}>
      <LinearGradient
        colors={["rgba(30,220,255,0.28)", "rgba(29,92,255,0.12)"]}
        style={[
          s.avatar,
          {
            borderColor: colors.borderGlow,
            borderRadius: size / 2,
            height: size,
            width: size,
          },
        ]}
      >
        <Ionicons name="sparkles" size={size * 0.45} color={colors.primary} />
      </LinearGradient>
    </View>
  );
}

/** Compact header: who the Personal is, availability and the settings menu. */
export function PersonalHeader({
  onOpenSettings,
  settingsOpen,
}: {
  onOpenSettings(): void;
  settingsOpen: boolean;
}) {
  const { colors, typography, fonts } = useAppTheme();
  return (
    <View style={s.header}>
      <PersonalAvatar size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          accessibilityRole="header"
          style={[typography.titleLG, { color: colors.textPrimary }]}
        >
          Seu Personal IA
        </Text>
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: colors.success }]} />
          <Text
            style={[
              typography.bodySM,
              { color: colors.success, fontFamily: fonts.semibold },
            ]}
          >
            Disponível
          </Text>
        </View>
        <Text
          style={[typography.bodySM, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          Treinos, dúvidas e evolução.
        </Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Configurações e histórico do Personal"
        accessibilityState={{ expanded: settingsOpen }}
        onPress={onOpenSettings}
        style={[
          s.iconButton,
          {
            backgroundColor: colors.surfaceSoft,
            borderColor: settingsOpen ? colors.borderGlow : colors.border,
          },
        ]}
      >
        <Ionicons
          name={settingsOpen ? "close" : "options-outline"}
          size={22}
          color={colors.textPrimary}
        />
      </PressableScale>
    </View>
  );
}

/** Athlete message: right, blue. */
export function UserMessage({ text }: { text: string }) {
  const { typography } = useAppTheme();
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      style={[s.bubble, s.user]}
    >
      <Text style={[typography.bodyLG, { color: "#FFFFFF" }]}>{text}</Text>
    </Animated.View>
  );
}

/** Personal message: left, navy card, with the avatar. */
export function CoachMessage({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      style={s.coachRow}
      testID={testID}
    >
      <PersonalAvatar size={32} />
      <View
        style={[
          s.bubble,
          s.coach,
          { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** Rich list inside a Personal message (observations, suggestions...). */
export function ChecklistCard({
  title,
  items,
  icon = "checkmark-circle",
  tone = "primary",
  empty,
}: {
  title: string;
  items: readonly string[];
  icon?: IconName;
  tone?: "primary" | "warning";
  empty: string;
}) {
  const { colors, typography, fonts } = useAppTheme();
  const color = tone === "warning" ? "#FFC247" : colors.primary;
  return (
    <View
      style={[
        s.checklist,
        { borderColor: colors.border, backgroundColor: colors.surfaceCard },
      ]}
    >
      <Text
        style={[
          typography.titleMD,
          { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bold },
        ]}
      >
        {title}
      </Text>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${index}-${item}`} style={s.checkItem}>
            <Ionicons
              name={icon}
              size={18}
              color={color}
              style={{ marginTop: 1 }}
            />
            <Text
              style={[
                typography.bodyMD,
                { color: colors.textSecondary, flex: 1 },
              ]}
            >
              {item}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
          {empty}
        </Text>
      )}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { colors } = useAppTheme();
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 350 }),
            withTiming(0.3, { duration: 350 }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[s.typingDot, { backgroundColor: colors.primary }, style]}
    />
  );
}

/** "The Personal is analyzing" indicator (no fake streaming of content). */
export function TypingIndicator({ label }: { label: string }) {
  const { colors, typography } = useAppTheme();
  return (
    <CoachMessage>
      <View style={s.row}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
        <Text
          style={[
            typography.bodyMD,
            { color: colors.textSecondary, marginLeft: 6 },
          ]}
        >
          {label}
        </Text>
      </View>
    </CoachMessage>
  );
}

export type Suggestion = Readonly<{
  label: string;
  icon: IconName;
  prompt: string;
}>;
/** Starting points; they only prefill the question (nothing is sent). */
export function QuickSuggestionGrid({
  items,
  onPick,
}: {
  items: readonly Suggestion[];
  onPick(prompt: string): void;
}) {
  const { colors, typography, fonts } = useAppTheme();
  return (
    <View style={s.suggestions}>
      {items.map((item) => (
        <PressableScale
          key={item.label}
          accessibilityRole="button"
          onPress={() => onPick(item.prompt)}
          style={[
            s.suggestion,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name={item.icon} size={18} color={colors.primary} />
          <Text
            style={[
              typography.bodyMD,
              {
                color: colors.textPrimary,
                fontFamily: fonts.semibold,
                flexShrink: 1,
              },
            ]}
          >
            {item.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

/** Composer fixed above the keyboard; shortcuts open real app areas. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  shortcuts,
}: {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  disabled: boolean;
  placeholder: string;
  shortcuts: readonly Readonly<{
    label: string;
    icon: IconName;
    onPress(): void;
  }>[];
}) {
  const { colors, typography, fonts } = useAppTheme();
  const canSend = !!value.trim() && !disabled;
  return (
    <View
      style={[
        s.composer,
        { backgroundColor: colors.background, borderColor: colors.divider },
      ]}
    >
      <View style={s.inputRow}>
        <TextInput
          accessibilityLabel={placeholder}
          testID="coach-question"
          multiline
          maxLength={2000}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          style={[
            s.input,
            typography.bodyLG,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={!canSend}
          onPress={onSend}
          testID="coach-send"
          style={[s.send, { opacity: canSend ? 1 : 0.45 }]}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.sendInner}
          >
            <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
          </LinearGradient>
        </PressableScale>
      </View>
      <View style={s.shortcuts}>
        {shortcuts.map((item) => (
          <PressableScale
            key={item.label}
            accessibilityRole="button"
            onPress={item.onPress}
            style={[
              s.chip,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name={item.icon} size={14} color={colors.primary} />
            <Text
              style={[
                typography.bodySM,
                { color: colors.textPrimary, fontFamily: fonts.semibold },
              ]}
            >
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 6 },
  header: { alignItems: "center", flexDirection: "row", gap: 12 },
  avatar: { alignItems: "center", borderWidth: 1.5, justifyContent: "center" },
  dot: { borderRadius: 5, height: 9, width: 9 },
  iconButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  bubble: {
    borderRadius: 20,
    maxWidth: "86%",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: "#168CFF",
    borderBottomRightRadius: 6,
  },
  coachRow: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  coach: { borderBottomLeftRadius: 6, borderWidth: 1, flexShrink: 1, gap: 10 },
  checklist: { borderRadius: 16, borderWidth: 1, gap: 8, padding: 12 },
  checkItem: { flexDirection: "row", gap: 8 },
  typingDot: { borderRadius: 4, height: 8, width: 8 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  suggestion: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  composer: {
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  inputRow: { alignItems: "flex-end", flexDirection: "row", gap: 10 },
  input: {
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    maxHeight: 120,
    minHeight: 50,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
  },
  send: { borderRadius: 26, height: 52, overflow: "hidden", width: 52 },
  sendInner: { alignItems: "center", flex: 1, justifyContent: "center" },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
