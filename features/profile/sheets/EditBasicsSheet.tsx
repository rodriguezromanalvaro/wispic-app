import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';
import { useProfileMutations } from '../hooks/useProfileMutations';

interface EditBasicsSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId?: string;
  initialName?: string | null;
  initialBio?: string | null;
}

export const EditBasicsSheet: React.FC<EditBasicsSheetProps> = ({ visible, onClose, profileId, initialName, initialBio }) => {
  const { t } = useTranslation();
  const { updateBasics } = useProfileMutations(profileId);
  const [name, setName] = useState(initialName || '');
  const [bio, setBio] = useState(initialBio || '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setBio(initialBio || '');
      setDirty(false);
    }
  }, [visible, initialName, initialBio]);

  const save = async () => {
    try {
      await updateBasics.mutateAsync({ display_name: name, bio });
      onClose();
    } catch (e) {
      // TODO: mostrar error
      console.warn('[EditBasicsSheet] save error', e);
    }
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title={t('profile.quickEdit.title')}
      footer={
        <TouchableOpacity disabled={!dirty || updateBasics.isPending} onPress={save} style={{ backgroundColor: !dirty ? theme.colors.border : theme.colors.primary, padding:14, borderRadius:12, alignItems:'center' }}>
          {updateBasics.isPending ? <ActivityIndicator color={theme.colors.primaryText} /> : <Text style={{ color: theme.colors.primaryText, fontWeight:'600' }}>{t('common.edit')}</Text>}
        </TouchableOpacity>
      }
    >
      <View style={{ gap:16 }}>
        <View>
          <Text style={{ color: theme.colors.subtext, fontSize:12, marginBottom:4 }}>{t('profile.quickEdit.name')}</Text>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); setDirty(true); }}
            placeholder={t('profile.quickEdit.name')}
            placeholderTextColor={theme.colors.subtext}
            style={{ backgroundColor: theme.colors.card, borderRadius:12, paddingHorizontal:12, paddingVertical:10, color: theme.colors.text }}
          />
        </View>
        <View>
          <Text style={{ color: theme.colors.subtext, fontSize:12, marginBottom:4 }}>{t('profile.quickEdit.bio')}</Text>
          <TextInput
            value={bio}
            onChangeText={(v) => { setBio(v); setDirty(true); }}
            placeholder={t('profile.quickEdit.bio')}
            placeholderTextColor={theme.colors.subtext}
            multiline
            style={{ backgroundColor: theme.colors.card, borderRadius:12, paddingHorizontal:12, paddingVertical:10, color: theme.colors.text, minHeight:120, textAlignVertical:'top' }}
          />
        </View>
      </View>
    </ModalContainer>
  );
};
