import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

interface VisibilityBadgesProps {
  locks?: { genderHidden?: boolean; orientationHidden?: boolean; seekingHidden?: boolean };
}

export const VisibilityBadges: React.FC<VisibilityBadgesProps> = ({ locks }) => {
  const { t } = useTranslation();
  if (!locks) return null;
  const items: string[] = [];
  if (locks.genderHidden) items.push(t('profile.visibility.genderHidden'));
  if (locks.orientationHidden) items.push(t('profile.visibility.orientationHidden'));
  if (locks.seekingHidden) items.push(t('profile.visibility.seekingHidden'));
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap: 6 }}>
      {items.map(it => (
        <View key={it} style={{ backgroundColor: '#1f252c', paddingHorizontal:10, paddingVertical:6, borderRadius: 20 }}>
          <Text style={{ color: theme.colors.subtext, fontSize: 11 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
};
