import React from 'react';

import { View, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { H1, P } from 'components/ui';
import { theme } from 'lib/theme';

export function OwnerHeader({
  title,
  subtitle,
  children,
  accentOpacity = 0.28,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** 0..1 opacity for the soft gradient band */
  accentOpacity?: number;
  centered?: boolean;
}){
  return (
    <View style={{ width:'100%', marginBottom: 6, alignItems: centered ? 'center' : undefined }}>
      {/* Soft gradient band behind the title to "fuse" with owner palette */}
      <LinearGradient
        colors={theme.gradients.brand as any}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={[StyleSheet.absoluteFillObject, styles.band, { opacity: accentOpacity }]}
        pointerEvents="none"
      />
      <H1 style={centered ? { textAlign: 'center' } : undefined}>{title}</H1>
      {subtitle ? <P style={[{ marginTop: 4 }, centered ? { textAlign: 'center' } : null]}>{subtitle}</P> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    top: -10,
    height: 96,
    borderRadius: 22,
    left: -12,
    right: -12,
  }
});
