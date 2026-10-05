import type { ExerciseLoadSuggestion } from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Entrance } from "@/presentation/components/motion";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { formatLoadSuggestion } from "../load-suggestion-format";

/**
 * Before the first set (ADR-0131): suggested working load and a warm-up
 * checklist. The checks are local only (warm-ups are not recorded and never
 * count as training volume).
 */
export function LoadSuggestionCard({
  suggestion,
}: {
  suggestion: ExerciseLoadSuggestion;
}) {
  const { colors, fonts, typography } = useAppTheme();
  const [done, setDone] = useState<readonly number[]>([]);
  const text = formatLoadSuggestion(suggestion);
  if (!text) return null;
  return (
    <Entrance
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.surfaceSoft },
      ]}
    >
      <View style={styles.row}>
        <Ionicons
          name="person-circle-outline"
          size={20}
          color={colors.primary}
        />
        <Text
          style={[
            typography.caption,
            { color: colors.primary, letterSpacing: 2 },
          ]}
        >
          SUGESTÃO DO PERSONAL
        </Text>
      </View>
      <Text
        testID="load-suggestion-title"
        style={[typography.titleMD, { color: colors.textPrimary }]}
      >
        {text.title}
      </Text>
      {text.lines.map((line) => (
        <Text
          key={line}
          style={[typography.bodyMD, { color: colors.textSecondary }]}
        >
          {line}
        </Text>
      ))}
      {text.warmUpTitle ? (
        <View style={[styles.warmUp, { borderColor: colors.border }]}>
          <Text
            style={[
              typography.bodyMD,
              { color: colors.textPrimary, fontFamily: fonts.semibold },
            ]}
          >
            {text.warmUpTitle}
          </Text>
          {text.warmUp.map((line, index) => {
            const checked = done.includes(index);
            return (
              <Pressable
                key={line}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() =>
                  setDone(
                    checked
                      ? done.filter((item) => item !== index)
                      : [...done, index],
                  )
                }
                style={styles.row}
              >
                <Ionicons
                  name={checked ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={checked ? colors.success : colors.textMuted}
                />
                <Text
                  style={[
                    typography.bodyMD,
                    {
                      color: checked ? colors.textMuted : colors.textSecondary,
                      textDecorationLine: checked ? "line-through" : "none",
                    },
                  ]}
                >
                  {line}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[typography.bodySM, { color: colors.textMuted }]}>
            Aquecimento não conta como série de treino.
          </Text>
        </View>
      ) : null}
    </Entrance>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 16 },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  warmUp: { borderTopWidth: 1, gap: 8, marginTop: 4, paddingTop: 10 },
});
