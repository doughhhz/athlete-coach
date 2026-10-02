import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/presentation/theme/use-app-theme";

/** Gradient "A" mark + "Athlete Coach" (design ADR-0120). */
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
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.logo}
        >
          <Text style={[s.logoText, { fontFamily: fonts.bold }]}>A</Text>
        </LinearGradient>
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
