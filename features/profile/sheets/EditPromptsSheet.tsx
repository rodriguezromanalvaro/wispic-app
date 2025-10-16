import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

// NOTE: Prompts mutation hooks will be added in a later step.

interface EditPromptsSheetProps {
  visible: boolean;
  onClose: () => void;
  prompts: { id: number|string; question?: string; response: string }[];
  onAdd?: () => void;
  onEdit?: (id: any) => void;
  onRemove?: (id: any) => void;
  loading?: boolean;
}

export const EditPromptsSheet: React.FC<EditPromptsSheetProps> = ({ visible, onClose, prompts, onAdd, onEdit, onRemove, loading }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState(prompts);

  useEffect(() => { if (visible) setLocal(prompts); }, [visible, prompts]);

  return (
    <ModalContainer visible={visible} onClose={onClose} title={t('profile.prompts.title')}>
      {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: 16 }} />}
      <FlatList
        data={local}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => <View style={{ height:12 }} />}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: theme.colors.card, padding:12, borderRadius:12, gap:6 }}>
            <Text style={{ color: theme.colors.subtext, fontSize:12 }}>{item.question || '—'}</Text>
            <Text style={{ color: theme.colors.text }}>{item.response}</Text>
            <View style={{ flexDirection:'row', gap:16 }}>
              <TouchableOpacity onPress={() => onEdit && onEdit(item.id)}>
                <Text style={{ color: theme.colors.primary }}>{t('common.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemove && onRemove(item.id)}>
                <Text style={{ color: theme.colors.danger }}>{t('common.delete', 'Delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: theme.colors.subtext }}>{t('promptsSubtitle')}</Text>}
        ListFooterComponent={
          <TouchableOpacity onPress={onAdd} style={{ marginTop:20, backgroundColor: theme.colors.primary, padding:14, borderRadius:12, alignItems:'center' }}>
            <Text style={{ color: theme.colors.primaryText, fontWeight:'600' }}>{t('complete.promptsTitle')}</Text>
          </TouchableOpacity>
        }
      />
    </ModalContainer>
  );
};
