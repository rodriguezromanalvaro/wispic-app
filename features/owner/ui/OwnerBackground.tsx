import type { ReactNode } from 'react';

import { View, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { theme } from 'lib/theme';

export const OWNER_BLUE_GRADIENT: [string, string] = ['#60A5FA', '#2563EB'];
export const OWNER_BLUE_SOFT: [string, string] = ['rgba(59,130,246,0.26)', 'rgba(59,130,246,0.10)'];
export const OWNER_GLOW_TOP: [string, string] = ['rgba(59,130,246,0.20)', 'rgba(59,130,246,0)'];
export const OWNER_GLOW_BOTTOM: [string, string] = ['rgba(59,130,246,0)', 'rgba(59,130,246,0.20)'];
export const OWNER_BLUE_VEIL: [string, string] = ['rgba(59,130,246,0.06)', 'rgba(59,130,246,0.12)'];

export const OwnerBackground = ({ children }: { children: ReactNode }) => {
  return (
    <View style={{ flex: 1 }}>
      {/* Base app palette */}
      <LinearGradient
        colors={(theme.gradients.appBg as any)}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Subtle blue veil */}
      <LinearGradient
        colors={OWNER_BLUE_VEIL}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {children}

      {/* Blue glows over content */}
      <LinearGradient colors={OWNER_GLOW_TOP} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFillObject, { top: -12, bottom: undefined, height: 200 }]} pointerEvents="none" />
      <LinearGradient colors={OWNER_GLOW_BOTTOM} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFillObject, { top: undefined, bottom: -12, height: 240 }]} pointerEvents="none" />
    </View>
  );
};
