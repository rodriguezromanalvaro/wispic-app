import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../lib/theme';
import { usePromptTemplates } from '../hooks/usePromptTemplates';
import { useProfileMutations } from '../hooks/useProfileMutations';
import { useToast } from '../../../lib/toast';
import { translatePrompt } from '../prompts/promptTranslations';

interface Props {
  visible: boolean;
  onClose: () => void;
  profileId?: string;
  targetId?: number | string | null; // template id or existing answer id
  existingPrompts: { id: any; prompt_id?: number; response: any; }[]; // response can be string or string[] legacy
}

export const PromptAnswerSheet: React.FC<Props> = ({ visible, onClose, profileId, targetId, existingPrompts }) => {
  const { t, i18n } = useTranslation();
  const { data: templates, isLoading } = usePromptTemplates();
  const { upsertPrompt, deletePrompt } = useProfileMutations(profileId);
  const toast = useToast();
  const [response, setResponse] = useState<string>('');
  const [multiAnswers, setMultiAnswers] = useState<string[]>([]); // for choice type
  const [saving, setSaving] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const runPulse = () => {
    pulse.setValue(0);
    Animated.timing(pulse, { toValue:1, duration:600, easing:Easing.out(Easing.quad), useNativeDriver:true }).start();
  };

  const { template, answer } = useMemo(() => {
    if (!templates) return { template: undefined, answer: undefined };
    // If targetId matches an existing answer id -> find answer and its template
  const existing = existingPrompts.find(p => p.id === targetId);
    if (existing) {
      const tpl = templates.find(t => t.id === (existing.prompt_id || existing.id));
      return { template: tpl, answer: existing };
    }
    // else treat targetId as template id
    const tpl = templates.find(t => t.id === Number(targetId));
    const existingFromTpl = existingPrompts.find(p => (p.prompt_id ?? p.id) === tpl?.id);
    return { template: tpl, answer: existingFromTpl };
  }, [templates, targetId, existingPrompts]);

  useEffect(() => {
    if (visible) {
      const raw = answer?.response;
      if (Array.isArray(raw)) {
        setMultiAnswers(raw.map(String));
        setResponse('');
      } else {
        setResponse(raw || '');
        setMultiAnswers([]);
      }
    }
  }, [visible, answer?.response]);
  const isChoice = template && (template as any).type === 'choice' && Array.isArray((template as any).choices) && (template as any).choices.length > 0;
  const maxChoices = (template as any)?.max_choices || 1;
  const canSave = !!template && (isChoice ? true : response.trim().length > 0 || (answer && !isChoice));

  const save = async () => {
    if (!template || !canSave) return;
    try {
      setSaving(true);
  const value = isChoice ? multiAnswers.filter(Boolean) : response.trim();
      if ((!isChoice && value.length === 0 && answer?.id) || (isChoice && value.length === 0 && answer?.id)) {
        await deletePrompt.mutateAsync({ id: answer.id });
        toast.show(t('profile.prompts.deleted','Respuesta eliminada'),'info');
      } else {
        await upsertPrompt.mutateAsync({ id: answer?.id, prompt_id: template.id, response: value as any });
        if (answer?.id) {
          toast.show(t('profile.prompts.updated','Respuesta actualizada'),'success');
        } else {
          toast.show(t('profile.prompts.saved','Respuesta guardada'),'success');
        }
      }
  runPulse();
      // Reset local state to reflect saved data
      if (isChoice) {
        setMultiAnswers(value as string[]);
      } else {
        setResponse(value as string);
      }
      onClose();
    } finally { setSaving(false); }
  };

  const toggleChoice = (choice: string) => {
    setMultiAnswers(prev => {
      const exists = prev.includes(choice);
      if (exists) return prev.filter(c => c !== choice);
      if (prev.length >= maxChoices) return prev; // enforce cap
      return [...prev, choice];
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{template ? translatePrompt(template.id, template.question, i18n.language) : t('profile.prompts.title')}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>{t('common.close')}</Text></TouchableOpacity>
          </View>
          {isLoading && !template && <ActivityIndicator color={theme.colors.primary} style={{ marginVertical:20 }} />}
          {isChoice ? (
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
              {(template as any).choices?.map((c: string) => {
                const active = multiAnswers.includes(c);
                return (
                  <TouchableOpacity key={c} onPress={() => toggleChoice(c)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                    <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{(template as any).choicesLabels?.[c] || c}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ width:'100%', marginTop:12 }}>
                <Text style={styles.helperText}>{t('profile.prompts.selectHint', 'Selecciona opciones')}</Text>
                <Text style={styles.helperText}>{multiAnswers.length}/{maxChoices}</Text>
              </View>
            </ScrollView>
          ) : (
            <TextInput
              value={response}
              onChangeText={setResponse}
              multiline
              placeholder={(template as any)?.placeholder || t('common.typeAnswer')}
              placeholderTextColor={theme.colors.subtext}
              style={styles.input}
            />
          )}
          <Animated.View pointerEvents="none" style={[styles.pulseOverlay, { opacity: pulse.interpolate({ inputRange:[0,0.4,1], outputRange:[0,0.8,0] }), transform:[{ scale: pulse.interpolate({ inputRange:[0,1], outputRange:[0.9,1.05] }) }] }]} />
          <View style={{ flexDirection:'row', gap:12 }}>
            {isChoice && !!multiAnswers.length && (
              <TouchableOpacity disabled={saving} onPress={() => setMultiAnswers([])} style={[styles.clearBtn, saving && { opacity:0.5 }]}>
                <Text style={styles.clearText}>{t('common.delete','Eliminar')}</Text>
              </TouchableOpacity>
            )}
            {!isChoice && answer && !response.trim().length && (
              <TouchableOpacity disabled={saving} onPress={save} style={[styles.clearBtn, saving && { opacity:0.5 }]}>
                {saving ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.clearText}>{t('common.delete','Eliminar')}</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity disabled={!canSave || saving} onPress={save} style={[styles.saveBtn, (!canSave || saving) && { opacity:0.5 }]}>
              {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  sheet: { backgroundColor:'#111926', padding:20, borderTopLeftRadius:28, borderTopRightRadius:28, gap:16, maxHeight:'80%' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  title: { color:'#fff', fontSize:16, fontWeight:'700', flex:1, paddingRight:12 },
  close: { color: theme.colors.primary, fontWeight:'600' },
  input: { minHeight:140, textAlignVertical:'top', backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)', borderRadius:16, padding:12, color:'#fff', fontSize:14, lineHeight:20 },
  choiceChip: { paddingVertical:8, paddingHorizontal:14, borderRadius:24, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  choiceChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  choiceChipText: { color:'#CBD5E1', fontSize:13, fontWeight:'600' },
  choiceChipTextActive: { color: theme.colors.primaryText },
  helperText: { color:'#64748B', fontSize:11 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius:16, paddingVertical:14, alignItems:'center' },
  saveText: { color: theme.colors.primaryText, fontSize:15, fontWeight:'700' },
  clearBtn: { backgroundColor:'rgba(255,255,255,0.08)', borderRadius:16, paddingVertical:14, paddingHorizontal:18, alignItems:'center', flexGrow:1 },
  clearText: { color:'#F87171', fontSize:13, fontWeight:'700', letterSpacing:0.3 }
 ,pulseOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:28, backgroundColor: theme.colors.primary }
});

export default PromptAnswerSheet;
