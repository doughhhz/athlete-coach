import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";
import { BrandMark } from "@/presentation/components/brand-mark";

/** Official logo mark + "Athlete Coach" (ADR-0120, ADR-0124). */
export function BrandHeader({
  subtitle,
  right,
}: {
  subtitle: string;
  right?: ReactNode;
}) {
  const { colors, fonts, typography } = useAppTheme();
  return (
    <View style={s.header}>
      <View style={s.row}>
        <BrandMark size={44} />
        <View>
          <Text style={[s.brand, { fontFamily: fonts.bold }]}>
            <Text style={{ color: colors.textPrimary }}>Athlete </Text>
            <Text style={{ color: colors.brandAccent }}>Coach</Text>
          </Text>
          <Text style={[typography.bodyMD, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      {right}
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  logo: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  logoText: { color: "#FFFFFF", fontSize: 24 },
  brand: { fontSize: 20, lineHeight: 26 },
});
