import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

interface BadgesProps {
  isPremium?: boolean | null;
  verified_at?: string | null;
}

export const Badges: React.FC<BadgesProps> = ({ isPremium, verified_at }) => {
  const { t } = useTranslation();
  const items: { label: string; color: string }[] = [];
  if (isPremium) items.push({ label: t('common.premium'), color: theme.colors.primary });
  if (verified_at) items.push({ label: t('common.verified'), color: theme.colors.positive });
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
      {items.map(it => (
        <View key={it.label} style={{ backgroundColor: it.color, paddingHorizontal:10, paddingVertical:4, borderRadius:20 }}>
          <Text style={{ color: theme.colors.primaryText, fontSize:11, fontWeight:'600' }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
};
