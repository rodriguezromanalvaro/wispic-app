import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

interface EditableRowProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress?: () => void;
}

export const EditableRow: React.FC<EditableRowProps> = ({ label, value, placeholder, onPress }) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10 }}>
      <View style={{ flex:1 }}>
        <Text style={{ color: theme.colors.subtext, fontSize: 12, marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: value ? theme.colors.text : theme.colors.subtext }}>{value || placeholder || '—'}</Text>
      </View>
      <Text style={{ color: theme.colors.primary, fontSize: 12 }}>{t('common.edit', 'Edit')}</Text>
    </TouchableOpacity>
  );
};
