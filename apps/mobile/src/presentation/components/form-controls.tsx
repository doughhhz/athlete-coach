import type { PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";

export function FormField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        {...props}
      />
    </View>
  );
}

export function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress(): void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.accent,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress(): void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.secondary, { borderColor: theme.colors.border }]}
    >
      <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoiceButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected
            ? theme.colors.accent
            : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? "#FFFFFF" : theme.colors.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FormMessage({
  children,
  tone = "error",
}: PropsWithChildren<{ tone?: "error" | "info" }>) {
  const theme = useAppTheme();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.message,
        { color: tone === "error" ? theme.colors.danger : theme.colors.accent },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7, marginBottom: 16 },
  label: { fontSize: 15, fontWeight: "700" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  secondaryText: { fontSize: 16, fontWeight: "700" },
  choice: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
});
