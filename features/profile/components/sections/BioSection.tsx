import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, TextInput, View, StyleSheet } from 'react-native';
import { SectionShell } from './SectionShell';
import { theme } from '../../../../lib/theme';
import { useProfileMutations } from '../../hooks/useProfileMutations';
import { useTranslation } from 'react-i18next';

export const BioSection: React.FC<{ bio?: string | null; profileId?: string; }> = ({ bio, profileId }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bio || '');
  useEffect(()=> { if (!editing) setValue(bio || ''); }, [bio, editing]);
  const [expanded, setExpanded] = useState(false);
  const mutations = useProfileMutations(profileId);
  const limit = 180;
  const isLong = (bio || '').length > limit;
  const display = !isLong || expanded ? (bio || '') : (bio || '').slice(0, limit) + '…';

  const startEdit = () => { setValue(bio || ''); setEditing(true); };
  const cancel = () => { setEditing(false); };
  const save = () => { mutations.updateBasics.mutate({ bio: value }); setEditing(false); };

  return (
  <SectionShell title={t('complete.bioTitle','Tu bio')} icon="📝" onEdit={editing ? undefined : startEdit}>
      {editing ? (
        <View style={{ gap:8 }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            multiline
            placeholder={t('complete.bioPlaceholder')}
            placeholderTextColor={theme.colors.subtext}
            style={styles.input}
          />
          <View style={{ flexDirection:'row', gap:12 }}>
            <TouchableOpacity onPress={cancel}><Text style={styles.cancel}>{t('common.close')}</Text></TouchableOpacity>
            <TouchableOpacity disabled={mutations.updateBasics.isPending} onPress={save}><Text style={styles.save}>{t('common.save')}</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {bio ? <Text style={{ color: theme.colors.text, lineHeight:20 }}>{display}</Text> : <Text style={{ color: theme.colors.subtext }}>—</Text>}
          {isLong && (
            <TouchableOpacity onPress={() => setExpanded(e=>!e)}>
              <Text style={{ color: theme.colors.primary, fontSize:12, fontWeight:'600' }}>{expanded ? t('common.showLess','Ver menos') : t('common.showMore','Ver más')}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </SectionShell>
  );
};

const styles = StyleSheet.create({
  input: { minHeight:120, textAlignVertical:'top', color: theme.colors.text, borderWidth:1, borderColor:'rgba(255,255,255,0.15)', padding:12, borderRadius:14, fontSize:14, lineHeight:20 },
  cancel: { color: theme.colors.subtext, fontSize:13, fontWeight:'600' },
  save: { color: theme.colors.primary, fontSize:13, fontWeight:'700' }
});
