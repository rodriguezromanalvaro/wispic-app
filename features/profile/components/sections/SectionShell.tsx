import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../../../lib/theme';
import { useTranslation } from 'react-i18next';

interface SectionShellProps {
  title: string;
  icon?: string;
  onEdit?: () => void;
  children: React.ReactNode;
  hiddenBadge?: boolean; // legacy prop
  hidden?: boolean; // alias new API
}

export const SectionShell: React.FC<SectionShellProps> = ({ title, icon, onEdit, children, hiddenBadge, hidden }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
  <Text style={styles.title}>{icon ? `${icon} ` : ''}{title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          {(hiddenBadge || hidden) && (
            <View style={styles.hiddenPill}>
              <Text style={styles.hiddenPillText}>🔒 {t('common.hidden','Oculto')}</Text>
            </View>
          )}
          {onEdit && (
            <TouchableOpacity onPress={onEdit}>
              <Text style={styles.edit}>{t('common.edit')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ gap:12 }}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.12)', padding:20, borderRadius:20, gap:12 },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  title: { color:'#fff', fontSize:18, fontWeight:'700' },
  edit: { color: theme.colors.primary, fontSize:12, fontWeight:'600' },
  hiddenPill: { backgroundColor:'rgba(255,255,255,0.12)', paddingHorizontal:10, paddingVertical:4, borderRadius:14 },
  hiddenPillText: { color:'#fff', fontSize:10, fontWeight:'600', letterSpacing:0.5 }
});
