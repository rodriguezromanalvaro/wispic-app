import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, UIManager, LayoutAnimation } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { translatePrompt } from '../../prompts/promptTranslations';
import { SectionShell } from './SectionShell';
import { theme } from '../../../../lib/theme';

interface PromptItem { id: any; prompt_id?: number; question?: string; response: any; }

interface Props { prompts: PromptItem[]; showAll?: boolean; onEditPrompt?: (id: any) => void; }

// Avoid spamming warning: In New Architecture (Fabric) setLayoutAnimationEnabledExperimental is a no-op and warns.
// We detect Fabric via global.nativeFabricUIManager and skip. Run once at module load.
const _hasTriedEnableLayoutAnim = (() => {
  if (Platform.OS === 'android') {
    const isFabric = (global as any).nativeFabricUIManager != null; // RN official detection
    // Some custom builds may expose _IS_NEW_ARCHITECTURE_ENABLED; treat either as new arch.
    const isNewArchFlag = !!(global as any)._IS_NEW_ARCHITECTURE_ENABLED;
    const isNewArch = isFabric || isNewArchFlag;
    if (!isNewArch && UIManager && (UIManager as any).setLayoutAnimationEnabledExperimental) {
      try {
        (UIManager as any).setLayoutAnimationEnabledExperimental(true);
      } catch (e) {
        // silently ignore
      }
    }
  }
  return true;
})();

export const PromptsSection: React.FC<Props> = ({ prompts, onEditPrompt }) => {
  const { t, i18n } = useTranslation();
  // lazy require to avoid circular
  const { usePromptTemplates } = require('../../hooks/usePromptTemplates');
  const { data: templates } = usePromptTemplates();
  const templateList: { id: number; question: string; choices?: string[]; choicesLabels?: Record<string,string>|null; icon?: string|null; max_choices?: number|null; categories?: { key:string; icon?: string|null; color?: string|null }[] }[] = templates || [];
  const answeredMap = new Map<string|number, PromptItem>();
  prompts.forEach(p => answeredMap.set(p.prompt_id ?? p.id, p));
  const ordered = useMemo(() => {
    const base = templateList.map(tmp => ({ template: tmp, answer: answeredMap.get(tmp.id) }));
    return base.sort((a,b) => {
      const aA = a.answer ? 1 : 0; const bA = b.answer ? 1 : 0;
      if (aA !== bA) return bA - aA; // answered first
      return a.template.id - b.template.id;
    });
  }, [templateList, prompts]);

  // Removed per-new-architecture warning; initialization handled once above.
  return (
    <SectionShell title={t('profile.prompts.title','Prompts')} icon="💬">
      <View style={styles.list}>
        {ordered.map(({ template, answer }, idx) => {
          // template.question is already localized via usePromptTemplates; translatePrompt kept for future fallback.
          const promptText = translatePrompt(template.id, template.question, i18n.language, { [template.id]: template.question });
          const isAnswered = !!answer;
          const borderColor = isAnswered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
          const bg = isAnswered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
          const icon = template.icon || template.categories?.[0]?.icon;
          const max = template.max_choices || (Array.isArray(template.choices) ? (template.choices.length > 1 ? template.choices.length : 1) : 1);
          const count = Array.isArray(answer?.response) ? answer.response.length : (answer ? 1 : 0);
          const accentColor = template.categories && template.categories[0]?.color;
          return (
            <View key={template.id} style={[styles.cardWrapper]}
              onLayout={() => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)}> 
              <LinearGradient
                colors={accentColor ? [accentColor+'B3', accentColor+'00'] : ['rgba(255,255,255,0.08)','rgba(255,255,255,0)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={[styles.card,{ borderColor, backgroundColor:bg }]}
              >
              <View style={styles.headRow}>
                <View style={styles.indexBadge}><Text style={styles.indexText}>{idx+1}</Text></View>
                {icon ? <Text style={styles.icon}>{icon}</Text> : null}
                <Text style={styles.question}>{promptText}</Text>
              </View>
              {answer ? (
                Array.isArray(answer.response) ? (
                  <View style={styles.chipsRow}>
                    {answer.response.map((c: string) => (
                      <View key={c} style={styles.answerChip} onLayout={() => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)}>
                        <Text style={styles.answerChipText}>{template.choicesLabels?.[c] || c}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.answerText}>{answer.response}</Text>
                )
              ) : (
                <Text style={styles.unanswered}>{t('profile.prompts.unanswered','Sin respuesta')}</Text>
              )}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{count}/{max}</Text>
                {onEditPrompt && (
                  <Text onPress={() => onEditPrompt(answer ? (answer.id) : template.id)} style={styles.actionLink}>
                    {answer ? t('common.edit') : t('profile.prompts.answerCta','Responder')}
                  </Text>
                )}
              </View>
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </SectionShell>
  );
};

const styles = StyleSheet.create({
  list: { gap: 14 },
  cardWrapper: { borderRadius:18 },
  card: { borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, overflow:'hidden' },
  headRow: { flexDirection:'row', alignItems:'flex-start', gap:8 },
  icon: { fontSize:16, marginTop:1 },
  indexBadge: { backgroundColor:'rgba(255,255,255,0.10)', width:22, height:22, borderRadius:11, alignItems:'center', justifyContent:'center', marginTop:2 },
  indexText: { color:'#fff', fontSize:11, fontWeight:'700' },
  question: { flex:1, color:'#F1F5F9', fontSize:14, fontWeight:'700', lineHeight:18 },
  answerText: { color: theme.colors.text, fontSize:14, lineHeight:20 },
  chipsRow: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  answerChip: { backgroundColor:'rgba(255,255,255,0.12)', paddingVertical:6, paddingHorizontal:12, borderRadius:16 },
  answerChipText: { color:'#fff', fontSize:12, fontWeight:'600' },
  unanswered: { color: theme.colors.subtext, fontStyle:'italic', fontSize:13 },
  actionLink: { color: theme.colors.primary, fontSize:11, fontWeight:'700', marginTop:2, letterSpacing:0.3 },
  metaRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4 },
  metaText: { color:'#64748B', fontSize:11, fontWeight:'600' }
});
