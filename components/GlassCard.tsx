import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { View, StyleSheet, ViewStyle, StyleProp, Pressable } from 'react-native';

import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useThemeMode } from 'lib/theme-context';

interface GlassCardProps {
  children: ReactNode;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  subdued?: boolean; // slightly more transparent
  tint?: 'success' | 'danger' | 'primary' | 'none';
  elevationLevel?: 0 | 1 | 2;
  interactive?: boolean; // scale feedback on press
  onPress?: () => void;
}

export const GlassCard = ({
  children,
  padding = 20,
  radius,
  style,
  subdued,
  tint = 'none',
  elevationLevel = 0,
  interactive = false,
  onPress
}: GlassCardProps) => {
  const { theme } = useThemeMode();
  const resolvedRadius = radius ?? theme.radii.lg;
  const tintStyles: StyleProp<ViewStyle> = (() => {
    const isDark = theme.mode === 'dark';
    const alpha = (hex: string, a: number) => {
      // simple hex to rgba (assuming #RRGGBB)
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    switch (tint) {
      case 'success':
        return { borderColor: alpha(theme.colors.success, 0.35), backgroundColor: alpha(theme.colors.success, isDark ? 0.06 : 0.08) };
      case 'danger':
        return { borderColor: alpha(theme.colors.danger, 0.35), backgroundColor: alpha(theme.colors.danger, isDark ? 0.06 : 0.08) };
      case 'primary':
        return { borderColor: alpha(theme.colors.primaryAlt, 0.45), backgroundColor: alpha(theme.colors.primaryAlt, isDark ? 0.07 : 0.10) };
      default:
        return {};
    }
  })();

  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(() => {
    if (interactive) scale.value = withTiming(0.97, { duration: 120 });
  }, [interactive]);
  const handlePressOut = useCallback(() => {
    if (interactive) scale.value = withTiming(1, { duration: 140 });
  }, [interactive]);

  const elevationStyle = elevationLevel ? theme.elevation[elevationLevel] : {};

  const styles = useMemo(() => StyleSheet.create({
    base: {
      // Full white in light mode to avoid mixed grey/white blocks; subtle translucent only in dark
      backgroundColor: theme.mode === 'dark' ? 'rgba(20,29,41,0.85)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : theme.colors.border,
      overflow: 'hidden'
    }
  }), [theme.mode, theme.colors.border]);

  const Content = (
    <Animated.View
      style={[
        styles.base,
        { padding, borderRadius: resolvedRadius, opacity: subdued ? 0.9 : 1 },
        tintStyles,
        elevationStyle,
        animated,
        style
      ]}
    >
      {children}
    </Animated.View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ borderRadius: resolvedRadius }}
      >
        {Content}
      </Pressable>
    );
  }
  return Content;
};

export const CardSoft = ({ children, style, padding=20, radius, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; padding?: number; radius?: number; onPress?: () => void; }) => {
  const { theme } = useThemeMode();
  const resolvedRadius = radius ?? theme.radii.lg;
  const softStyles = useMemo(() => StyleSheet.create({
    base: {
      backgroundColor: theme.mode === 'dark' ? theme.colors.card : '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    }
  }), [theme.mode, theme.colors.card]);
  const core = (
    <View style={[softStyles.base, { padding, borderRadius: resolvedRadius }, style]}>
      {children}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} style={{ borderRadius: resolvedRadius }}>{core}</Pressable>;
  return core;
};

