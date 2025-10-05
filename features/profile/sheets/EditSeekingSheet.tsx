import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';
import { useProfileMutations } from '../hooks/useProfileMutations';

const OPTIONS: { key: string; icon: string }[] = [
  { key: 'dating', icon: '❤️' },
  { key: 'friends', icon: '🤝' },
  { key: 'networking', icon: '💼' },
  { key: 'activity', icon: '⚽' },
  { key: 'languageExchange', icon: '🗣️' },
  { key: 'travelBuddy', icon: '✈️' },
];

interface Props { visible: boolean; onClose: () => void; profileId: string; initial: { seeking: string[]; show_seeking: boolean }; }

export const EditSeekingSheet: React.FC<Props> = ({ visible, onClose, profileId, initial }) => {
  const { t } = useTranslation();
  const mutations = useProfileMutations(profileId);
  const [selected, setSelected] = useState<string[]>(initial.seeking || []);
  const [showing, setShowing] = useState<boolean>(initial.show_seeking);
  const toggle = (k: string) => setSelected(cur => cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);
  const save = () => {
    mutations.updateBasics.mutate({ seeking: selected });
    mutations.updateVisibility.mutate({ show_seeking: showing });
    onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('profile.seeking.editTitle','Editar qué buscas')}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>{t('common.close','Cerrar')}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingVertical:12, gap:12 }}>
            <View style={styles.optionsWrap}>
              {OPTIONS.map(o => {
                const active = selected.includes(o.key);
                return (
                  <TouchableOpacity key={o.key} style={[styles.option, active && styles.optionActive]} onPress={() => toggle(o.key)}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.icon} {t(`seeking.${o.key}`, o.key)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setShowing(s=>!s)} style={styles.visibilityRow}>
              <Text style={styles.visLabel}>{showing ? t('profile.visibility.visible','Visible') : t('profile.visibility.hidden','Oculto')}</Text>
              <Text style={styles.visToggle}>{t('common.toggle','Cambiar')}</Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity disabled={selected.length===0} style={[styles.saveBtn, selected.length===0 && { opacity:0.4 }]} onPress={save}>
            <Text style={styles.saveText}>{t('common.save','Guardar')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  sheet: { backgroundColor:'#111926', padding:20, borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:'90%' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  title: { color:'#fff', fontSize:18, fontWeight:'700' },
  close: { color: theme.colors.primary, fontWeight:'600' },
  optionsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  option: { paddingHorizontal:14, paddingVertical:10, borderRadius:24, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.16)' },
  optionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  optionText: { color:'#fff', fontSize:13, fontWeight:'600' },
  optionTextActive: { color:'#fff' },
  visibilityRow: { marginTop:8, padding:14, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  visLabel: { color:'#fff', fontSize:14, fontWeight:'600' },
  visToggle: { color: theme.colors.primary, fontSize:12, fontWeight:'600' },
  saveBtn: { marginTop:12, backgroundColor: theme.colors.primary, paddingVertical:14, borderRadius:16, alignItems:'center' },
  saveText: { color:'#fff', fontSize:16, fontWeight:'700' }
});

export default EditSeekingSheet;