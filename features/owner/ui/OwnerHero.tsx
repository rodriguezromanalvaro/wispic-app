import React from 'react';

import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { H1, P, Button } from 'components/ui';
import { theme } from 'lib/theme';

/**
 * OwnerHero
 * - Big header area with owner brand gradient and optional primary CTA
 * - Mirrors end-user "hero" feel but keeps owner blue palette
 */
export const OwnerHero: React.FC<{
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  illustrationSource?: any; // ImageSourcePropType
  rightAccessory?: React.ReactNode; // custom node at top-right (e.g., icon/illustration)
  bottomContent?: React.ReactNode; // custom content below text (e.g., chips)
  style?: any;
}> = ({ title, subtitle, ctaLabel, onPressCta, illustrationSource, rightAccessory, bottomContent, style }) => {
  return (
    <View style={[styles.wrap, style]}>
      {/* Soft gradient background filling the hero */}
      <LinearGradient
        colors={[
          (theme.gradients.brandSoft as [string, string])[0],
          (theme.gradients.brandSoft as [string, string])[1],
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Optional top-right accessory (illustration or custom) */}
      {rightAccessory ? (
        <View style={{ position: 'absolute', right: 8, top: 8 }}>{rightAccessory}</View>
      ) : null}
  <H1 style={{ fontSize: 28 }}>{title}</H1>
      {subtitle ? <P style={{ marginTop: 6 }}>{subtitle}</P> : null}
      {ctaLabel && onPressCta ? (
        <View style={{ marginTop: 12, width: '100%', maxWidth: 360 }}>
          <Button title={ctaLabel} onPress={onPressCta} size="lg" />
        </View>
      ) : null}
      {bottomContent}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
    gap: 2,
  },
});

export default OwnerHero;
