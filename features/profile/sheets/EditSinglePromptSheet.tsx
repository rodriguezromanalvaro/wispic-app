import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';
import { usePromptTemplates } from '../hooks/usePromptTemplates';
import { useProfileMutations } from '../hooks/useProfileMutations';

interface EditSinglePromptSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId?: string;
  editingPrompt?: { id?: number|string; prompt_id?: number; response?: string; question?: string } | null;
}

export const EditSinglePromptSheet: React.FC<EditSinglePromptSheetProps> = ({ visible, onClose, profileId, editingPrompt }) => {
  const { t } = useTranslation();
  const { data: templates, isLoading: loadingTemplates } = usePromptTemplates();
  const { upsertPrompt } = useProfileMutations(profileId);
  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditingExisting = !!editingPrompt?.id;

  useEffect(() => {
    if (visible) {
      if (editingPrompt) {
        setSelectedTemplate(editingPrompt.prompt_id);
        setResponse(editingPrompt.response || '');
      } else {
        setSelectedTemplate(undefined);
        setResponse('');
      }
    }
  }, [visible, editingPrompt?.id]);

  const canSave = !!selectedTemplate && response.trim().length > 0;

  const currentQuestion = useMemo(() => {
    if (editingPrompt?.question) return editingPrompt.question;
    const tpl = templates?.find(t => t.id === selectedTemplate);
    return tpl?.question || '';
  }, [editingPrompt?.question, templates, selectedTemplate]);

  const onSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      await upsertPrompt.mutateAsync({ id: editingPrompt?.id, prompt_id: selectedTemplate!, response: response.trim() });
      onClose();
    } catch (e) {
      console.warn('[EditSinglePromptSheet] save error', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title={isEditingExisting ? t('profile.prompts.title') : t('profile.prompts.title')}
      footer={
        <TouchableOpacity disabled={!canSave || saving} onPress={onSave} style={{ backgroundColor: !canSave ? theme.colors.border : theme.colors.primary, padding:14, borderRadius:12, alignItems:'center' }}>
          {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Text style={{ color: theme.colors.primaryText, fontWeight:'600' }}>{t('common.save', 'Save')}</Text>}
        </TouchableOpacity>
      }
    >
      <View style={{ gap:16, flex:1 }}>
        <View style={{ flex:1 }}>
          {loadingTemplates && <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: 8 }} />}
          <Text style={{ color: theme.colors.subtext, fontSize:12, marginBottom:4 }}>{t('complete.promptsTitle')}</Text>
          <FlatList
            data={templates}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap:8 }}
            renderItem={({ item }) => {
              const active = item.id === selectedTemplate;
              return (
                <TouchableOpacity onPress={() => setSelectedTemplate(item.id)} style={{ backgroundColor: active ? theme.colors.primary : theme.colors.card, paddingHorizontal:14, paddingVertical:10, borderRadius:24 }}>
                  <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text, fontSize:12 }}>{item.question}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={!loadingTemplates ? <Text style={{ color: theme.colors.subtext }}>{t('promptsSubtitle')}</Text> : null}
          />
        </View>
        <View style={{ flex:2 }}>
          <Text style={{ color: theme.colors.subtext, fontSize:12, marginBottom:4 }}>{currentQuestion || t('profile.prompts.title')}</Text>
          <TextInput
            value={response}
            onChangeText={setResponse}
            placeholder={t('common.typeAnswer', 'Type your answer')}
            placeholderTextColor={theme.colors.subtext}
            multiline
            style={{ backgroundColor: theme.colors.card, borderRadius:12, paddingHorizontal:12, paddingVertical:10, color: theme.colors.text, minHeight:160, textAlignVertical:'top' }}
          />
        </View>
      </View>
    </ModalContainer>
  );
};
