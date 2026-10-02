import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";

/** Primary action with the neon gradient (design 2026-10-01). */
export function GradientButton({
  label,
  onPress,
  disabled,
  busy,
  icon = "arrow-forward",
  testID,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap | null;
  /** Stable E2E selector (Maestro); never read by application logic. */
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.shadow,
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient
        colors={[
          theme.colors.primaryGradientStart,
          theme.colors.primaryGradientEnd,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, { borderRadius: theme.spacing.radiusButton }]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={[styles.label, { fontFamily: theme.fonts.bold }]}>
              {label}
            </Text>
            {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" /> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#1D8CFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    height: 58,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: { color: "#FFFFFF", fontSize: 18 },
});
