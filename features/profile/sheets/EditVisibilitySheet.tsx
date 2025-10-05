import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';
import { useProfileMutations } from '../hooks/useProfileMutations';

interface EditVisibilitySheetProps {
  visible: boolean;
  onClose: () => void;
  profileId?: string;
  initial: { show_gender?: boolean; show_orientation?: boolean; show_seeking?: boolean };
}

export const EditVisibilitySheet: React.FC<EditVisibilitySheetProps> = ({ visible, onClose, profileId, initial }) => {
  const { t } = useTranslation();
  const { updateVisibility } = useProfileMutations(profileId);
  const [state, setState] = useState(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (visible) { setState(initial); setDirty(false); }
  }, [visible, initial.show_gender, initial.show_orientation, initial.show_seeking]);

  const toggle = (key: keyof typeof state) => {
    setState(s => { const next = { ...s, [key]: !s[key] }; setDirty(true); return next; });
  };

  const save = async () => {
    try {
      await updateVisibility.mutateAsync(state);
      onClose();
    } catch(e) {
      console.warn('[EditVisibilitySheet] save error', e);
    }
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title={t('profile.quickEdit.visibility')}
      footer={
        <TouchableOpacity disabled={!dirty || updateVisibility.isPending} onPress={save} style={{ backgroundColor: !dirty ? theme.colors.border : theme.colors.primary, padding:14, borderRadius:12, alignItems:'center' }}>
          {updateVisibility.isPending ? <ActivityIndicator color={theme.colors.primaryText} /> : <Text style={{ color: theme.colors.primaryText, fontWeight:'600' }}>{t('common.edit')}</Text>}
        </TouchableOpacity>
      }
    >
      <View style={{ gap: 20 }}>
        <Row label={t('genderTitle', 'Género')} value={!!state.show_gender} onToggle={() => toggle('show_gender')} />
        <Row label={t('orientationTitle', 'Orientación')} value={!!state.show_orientation} onToggle={() => toggle('show_orientation')} />
        <Row label={t('seekingTitle', 'Buscando')} value={!!state.show_seeking} onToggle={() => toggle('show_seeking')} />
        <Text style={{ color: theme.colors.subtext, fontSize: 12 }}>{t('hiddenNote')}</Text>
      </View>
    </ModalContainer>
  );
};

const Row = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
    <Text style={{ color: theme.colors.text }}>{label}</Text>
    <Switch value={value} onValueChange={onToggle} />
  </View>
);
