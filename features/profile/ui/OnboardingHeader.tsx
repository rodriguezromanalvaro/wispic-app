// features/profile/ui/OnboardingHeader.tsx
import { View, StyleSheet } from 'react-native';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { YStack as TgYStack } from 'components/tg';
import { P } from 'components/ui';
import { theme } from 'lib/theme';

export function OnboardingHeader({ step, total }: { step: number; total: number }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const top = insets.top + 8;
  return (
    <TgYStack pos="absolute" l={20} r={20} zIndex={10} gap="$0.5" style={{ top }}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${(step/total)*100}%` }]} />
      </View>
      <P style={styles.progressText}>{t('complete.progress', { current: step, total })}</P>
    </TgYStack>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, gap: 6, zIndex: 10 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
});
