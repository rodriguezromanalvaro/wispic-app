import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../../lib/theme';
import { CompletionResult } from '../logic/computeCompletion';
import { useTranslation } from 'react-i18next';

interface CompletionMeterProps {
  completion: CompletionResult;
  compact?: boolean;
  hideTitle?: boolean;
}

const LABELS: Record<string,string> = {
  display_name: 'Name',
  bio: 'Bio',
  birthdate: 'Birthdate',
  gender: 'Gender',
  prompts: 'Prompts',
  photos: 'Photos'
};

export const CompletionMeter: React.FC<CompletionMeterProps> = ({ completion, compact, hideTitle }) => {
  const { t } = useTranslation();
  const pct = completion.score;
  const radius = 40;
  const stroke = 8;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const offset = circ - (pct / 100) * circ;
  return (
    <View style={styles.wrap}>
      <View style={styles.ringWrap}>
        <View style={{ position:'absolute', alignItems:'center', justifyContent:'center', inset:0 }}>
          <Text style={styles.percent}>{pct}%</Text>
        </View>
        {/* Using SVG-like illusion with two overlapping circles via nested Views */}
        <View style={[styles.circleBase,{ width: radius*2, height: radius*2, borderRadius: radius }]} />
        <View style={[styles.circleProgress,{ width: radius*2, height: radius*2, borderRadius: radius }]}>
          <View style={[styles.circleMask,{ transform:[{ rotate: `${(pct/100)*360}deg` }] }]} />
        </View>
      </View>
      <View style={{ flex:1, gap:6 }}>
        {!hideTitle && <Text style={styles.title}>{t('profile.completion.title')}</Text>}
        {completion.missing.length > 0 ? (
          <Text style={styles.subtitle}>
            {completion.missing.length === 1 ? t('profile.completion.missingOne') : t('profile.completion.missingMany',{ count: completion.missing.length })}
          </Text>
        ) : (
          <Text style={styles.subtitle}>{t('profile.completion.allSet','Listo ✅')}</Text>
        )}
        {!compact && completion.missing.length > 0 && (
          <View style={styles.tagsWrap}>
            {completion.missing.map(m => (
              <View key={m} style={styles.tag}>
                <Text style={styles.tagText}>{LABELS[m] || m}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:16 },
  ringWrap: { width:80, height:80, position:'relative' },
  circleBase: { backgroundColor:'rgba(255,255,255,0.08)', position:'absolute', top:0, left:0 },
  circleProgress: { position:'absolute', top:0, left:0, overflow:'hidden' },
  circleMask: { position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:999, backgroundColor: theme.colors.primary, opacity:0.85 },
  percent: { color:'#fff', fontSize:18, fontWeight:'800' },
  title: { color:'#fff', fontSize:16, fontWeight:'700' },
  subtitle: { color: theme.colors.subtext, fontSize:12 },
  tagsWrap: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  tag: { backgroundColor:'#1f252c', paddingHorizontal:10, paddingVertical:6, borderRadius: 20 },
  tagText: { color: theme.colors.subtext, fontSize:11 }
});
