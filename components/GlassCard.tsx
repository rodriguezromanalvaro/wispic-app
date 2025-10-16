import React, { useCallback } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Pressable } from 'react-native';
import { theme } from '../lib/theme';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface GlassCardProps {
  children: React.ReactNode;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  subdued?: boolean; // slightly more transparent
  tint?: 'success' | 'danger' | 'primary' | 'none';
  elevationLevel?: 0 | 1 | 2;
  interactive?: boolean; // scale feedback on press
  onPress?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  padding = 20,
  radius = theme.radii.lg,
  style,
  subdued,
  tint = 'none',
  elevationLevel = 0,
  interactive = false,
  onPress
}) => {
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

  const Content = (
    <Animated.View
      style={[
        styles.base,
        { padding, borderRadius: radius, opacity: subdued ? 0.9 : 1 },
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
        style={{ borderRadius: radius }}
      >
        {Content}
      </Pressable>
    );
  }
  return Content;
};

export const CardSoft: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; padding?: number; radius?: number; onPress?: () => void; }> = ({ children, style, padding=20, radius=theme.radii.lg, onPress }) => {
  const core = (
    <View style={[softStyles.base, { padding, borderRadius: radius }, style]}>
      {children}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} style={{ borderRadius: radius }}>{core}</Pressable>;
  return core;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(20,29,41,0.85)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    overflow: 'hidden'
  }
});

const softStyles = StyleSheet.create({
  base: {
    backgroundColor: theme.mode === 'dark' ? theme.colors.card : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
  }
});
