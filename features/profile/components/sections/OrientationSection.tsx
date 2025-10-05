import React from 'react';
import { View, Text } from 'react-native';
import { SectionShell } from './SectionShell';
import { theme } from '../../../../lib/theme';
import { useTranslation } from 'react-i18next';

export const OrientationSection: React.FC<{ items?: string[]; hidden?: boolean; onEdit?: () => void; }> = ({ items, hidden, onEdit }) => {
  const { t } = useTranslation();
  return (
  <SectionShell title={t('complete.orientationTitle','¿Quién te interesa?')} icon="🌈" onEdit={onEdit} hiddenBadge={hidden}>
      {(!items || items.length===0) && <Text style={{ color: theme.colors.subtext }}>—</Text>}
      {items && items.length>0 && (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
          {items.map((o,i)=>(
            <View key={i} style={{ backgroundColor:'rgba(255,255,255,0.10)', paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>
              <Text style={{ color:'#fff', fontSize:12 }}>{t(`orientation.${o}`, o)}</Text>
            </View>
          ))}
        </View>
      )}
    </SectionShell>
  );
};
