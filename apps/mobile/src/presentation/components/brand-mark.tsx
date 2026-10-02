import { Image, type ImageStyle, type StyleProp } from "react-native";

// Official Athlete Coach logo (user-provided, 2026-10-02; ADR-0124).
const MARK = require("../../../assets/brand/logo-mark.png");
const FULL = require("../../../assets/brand/logo-full.png");

/** The "A" mark alone (headers, small spaces). Transparent background. */
export function BrandMark({
  size = 44,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={MARK}
      accessibilityRole="image"
      accessibilityLabel="Athlete Coach"
      resizeMode="contain"
      style={[{ height: size, width: size }, style]}
    />
  );
}

/** Mark + "Athlete Coach" wordmark (sign-in, large spaces). 3:2 ratio. */
export function BrandLogo({
  width = 240,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={FULL}
      accessibilityRole="image"
      accessibilityLabel="Athlete Coach"
      resizeMode="contain"
      style={[{ height: (width * 2) / 3, width }, style]}
    />
  );
}
