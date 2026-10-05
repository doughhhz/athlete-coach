import type { SetAssessment } from "@athlete-coach/domain";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Entrance } from "@/presentation/components/motion";
import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { formatSetAssessment } from "../set-assessment-format";

/**
 * The Personal's reading of the set just recorded (ADR-0130): deterministic
 * facts from the domain, worded by the formatter. Shown during the rest.
 */
export function SetAssessmentCard({
  assessment,
}: {
  assessment: SetAssessment;
}) {
  const { colors, fonts, typography } = useAppTheme();
  const text = formatSetAssessment(assessment);
  const accent =
    text.tone === "below"
      ? colors.warning
      : text.tone === "above"
        ? colors.primary
        : colors.success;
  const icon =
    text.tone === "below"
      ? "trending-down"
      : text.tone === "above"
        ? "trending-up"
        : "checkmark-circle";
  return (
    <Entrance
      key={assessment.workoutSetId}
      style={[
        styles.card,
        { borderColor: accent, backgroundColor: colors.surfaceSoft },
      ]}
    >
      <View style={styles.head}>
        <Ionicons name="person-circle-outline" size={20} color={accent} />
        <Text style={[typography.caption, { color: accent, letterSpacing: 2 }]}>
          PERSONAL · SÉRIE {assessment.setSequence}
        </Text>
      </View>
      <View style={styles.head}>
        <Ionicons name={icon} size={20} color={accent} />
        <Text
          testID="set-assessment-title"
          style={[typography.titleMD, { color: colors.textPrimary }]}
        >
          {text.title}
        </Text>
      </View>
      {text.records.map((record) => (
        <View key={record} style={styles.head}>
          <Ionicons name="trophy" size={16} color={colors.success} />
          <Text
            style={[
              typography.bodyMD,
              { color: colors.success, fontFamily: fonts.semibold, flex: 1 },
            ]}
          >
            {record}
          </Text>
        </View>
      ))}
      {text.lines.map((line) => (
        <Text
          key={line}
          style={[typography.bodyMD, { color: colors.textSecondary }]}
        >
          {line}
        </Text>
      ))}
      <View style={[styles.next, { borderColor: colors.border }]}>
        <Text
          testID="set-assessment-next"
          style={[
            typography.bodyMD,
            { color: colors.textPrimary, fontFamily: fonts.semibold },
          ]}
        >
          {text.next}
        </Text>
      </View>
      {text.caution ? (
        <View style={styles.head}>
          <Ionicons name="warning-outline" size={16} color={colors.danger} />
          <Text style={[typography.bodySM, { color: colors.danger, flex: 1 }]}>
            {text.caution}
          </Text>
        </View>
      ) : null}
    </Entrance>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 16 },
  head: { alignItems: "center", flexDirection: "row", gap: 8 },
  next: { borderTopWidth: 1, marginTop: 4, paddingTop: 10 },
});
