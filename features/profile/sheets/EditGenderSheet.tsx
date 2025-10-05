import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../lib/theme';
import { useProfileMutations } from '../hooks/useProfileMutations';

const GENDER_OPTIONS = [
  { key: 'male', labelKey: 'complete.male' },
  { key: 'female', labelKey: 'complete.female' },
  { key: 'other', labelKey: 'complete.other' }
];

interface Props { visible: boolean; onClose: () => void; profileId: string; initial: { gender: string|null; show_gender: boolean }; }

export const EditGenderSheet: React.FC<Props> = ({ visible, onClose, profileId, initial }) => {
  const { t } = useTranslation();
  const mutations = useProfileMutations(profileId);
  const [gender, setGender] = useState<string | null>(initial.gender);
  const [visibleFlag, setVisibleFlag] = useState<boolean>(initial.show_gender);

  const save = () => {
    mutations.updateBasics.mutate({ gender: gender || null } as any); // server must accept gender column
    mutations.updateVisibility.mutate({ show_gender: visibleFlag });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('profile.gender.editTitle','Editar género')}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>{t('common.close')}</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
            {GENDER_OPTIONS.map(o => {
              const active = gender === o.key;
              return (
                <TouchableOpacity key={o.key} onPress={()=> setGender(o.key)} style={[styles.option, active && styles.optionActive]}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{t(o.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={()=> setVisibleFlag(v=>!v)} style={styles.visibilityRow}>
            <Text style={styles.visLabel}>{visibleFlag ? t('complete.genderVisible','Género visible') : t('complete.genderHidden','Género oculto')}</Text>
            <Text style={styles.visToggle}>{t('common.toggle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, !gender && { opacity:0.4 }]} disabled={!gender} onPress={save}>
            <Text style={styles.saveText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  sheet: { backgroundColor:'#111926', padding:20, borderTopLeftRadius:28, borderTopRightRadius:28, gap:20 },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  title: { color:'#fff', fontSize:18, fontWeight:'700' },
  close: { color: theme.colors.primary, fontWeight:'600' },
  option: { paddingHorizontal:14, paddingVertical:10, borderRadius:24, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.16)' },
  optionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  optionText: { color:'#fff', fontSize:13, fontWeight:'600' },
  optionTextActive: { color:'#fff' },
  visibilityRow: { marginTop:4, padding:14, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  visLabel: { color:'#fff', fontSize:14, fontWeight:'600' },
  visToggle: { color: theme.colors.primary, fontSize:12, fontWeight:'600' },
  saveBtn: { marginTop:8, backgroundColor: theme.colors.primary, paddingVertical:14, borderRadius:16, alignItems:'center' },
  saveText: { color:'#fff', fontSize:16, fontWeight:'700' }
});

export default EditGenderSheet;