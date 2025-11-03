import React from 'react';

import { View, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { P } from 'components/ui';
import { theme } from 'lib/theme';

export const ProgressHeader: React.FC<{ step: number; total: number; style?: any }> = ({ step, total, style }) => {
  const progress = Math.max(0, Math.min(1, step / total));
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top }, style]}>
      <View style={styles.barBg}>
        <LinearGradient
          colors={theme.gradients.brand as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${progress * 100}%` }]}
        />
      </View>
      <P style={styles.text}>{t('complete.progress', { current: step, total })}</P>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, gap: 6 },
  barBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  text: { color: theme.colors.textDim, fontSize: 12 },
});
