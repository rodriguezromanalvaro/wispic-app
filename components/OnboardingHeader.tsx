// no default React import needed
import { View, StyleSheet } from 'react-native';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from 'lib/theme';

import { P } from './ui';

export function OnboardingHeader({ step, total }: { step: number; total: number }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Alineamos con las pantallas de la primera parte: añadimos insets.top + 8
  // aunque exista paddingTop en el contenedor, para mantener la misma altura visual.
  const top = insets.top + 8;
  return (
    <View style={[styles.wrap, { top }] }>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${(step/total)*100}%` }]} />
      </View>
      <P style={styles.progressText}>{t('complete.progress', { current: step, total })}</P>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, gap: 6, zIndex: 10 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
});
