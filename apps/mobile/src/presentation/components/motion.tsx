import type { PropsWithChildren } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/** Spring used across the app (fluid, no bounce excess). */
const spring = { damping: 18, stiffness: 180, mass: 0.8 } as const;

/**
 * Card entrance: expands and fades in from below, staggered by `index`;
 * later size changes animate with a layout transition (design ADR-0120).
 */
export function Entrance({
  index = 0,
  style,
  children,
}: PropsWithChildren<{ index?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70)
        .springify()
        .damping(spring.damping)
        .stiffness(spring.stiffness)}
      layout={LinearTransition.springify().damping(spring.damping)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that sinks slightly while pressed (buttons and cards). */
export function PressableScale({
  style,
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...props
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, spring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, spring));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
