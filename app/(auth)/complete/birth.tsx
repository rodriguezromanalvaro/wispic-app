import { useState, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, Alert, TextInput as RNTextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Card, H1, P, TextInput, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StepBirth() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = useCompleteProfile();
  // Parse existing draft birthdate into segments
  const initial = draft.birthdate || '';
  const [year, setYear] = useState(initial.slice(0,4));
  const [month, setMonth] = useState(initial.slice(5,7));
  const [day, setDay] = useState(initial.slice(8,10));
  const birthdate = useMemo(() => (year && month && day ? `${year}-${month}-${day}` : ''), [year, month, day]);
  const refYear = useRef<RNTextInput|null>(null);
  const refMonth = useRef<RNTextInput|null>(null);
  const refDay = useRef<RNTextInput|null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const validation = useMemo(() => {
    const dob = birthdate.trim();
    if (!dob) return { ok: false, reason: t('complete.birthRequired', 'Fecha requerida') };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, reason: t('complete.birthInvalidFormat', 'Formato inválido (YYYY-MM-DD)') };
    const [yy, mm, dd] = dob.split('-').map(Number);
    if (mm < 1 || mm > 12) return { ok: false, reason: t('complete.birthMonthOut', 'Mes fuera de rango') };
    const leap = (yy % 400 === 0) || (yy % 4 === 0 && yy % 100 !== 0);
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
    if (dd < 1 || dd > dim) return { ok: false, reason: t('complete.birthDayOut', 'Día fuera de rango') };
    if (new Date(dob) > new Date()) return { ok: false, reason: t('complete.birthFuture', 'No puede ser futura') };
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (isFinite(years) && years < 18) return { ok: false, reason: t('complete.birthUnderage', 'Debes ser mayor de 18') };
    return { ok: true, reason: '' };
  }, [birthdate, t]);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <LinearGradient colors={[theme.colors.primary, '#101828']} style={[styles.gradient, { paddingTop: Math.max(insets.top, 60) }]}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${(2/9)*100}%` }]} />
                  </View>
                  <P style={styles.progressText}>{t('complete.progress', { current: 2, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.birthTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.birthSubtitle')}</P>

            <Card style={styles.card}>
              <P style={{ color: '#E6EAF2', marginBottom: 6 }}>{t('complete.birthLabel')}</P>
              <View style={styles.segmentRow}>
                <RNTextInput
                  ref={refYear}
                  value={year}
                  placeholder={t('complete.birthYearPH','YYYY')}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(txt) => {
                    const v = txt.replace(/[^0-9]/g,'').slice(0,4);
                    setYear(v);
                    if (v.length === 4) { refMonth.current?.focus(); }
                  }}
                  style={[styles.segmentInput, !year && validation.ok === false ? styles.segmentError : null]}
                  returnKeyType="next"
                />
                <P style={styles.segmentSep}>/</P>
                <RNTextInput
                  ref={refMonth}
                  value={month}
                  placeholder={t('complete.birthMonthPH','MM')}
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(txt) => {
                    let v = txt.replace(/[^0-9]/g,'').slice(0,2);
                    if (v.length===2 && Number(v) === 0) v='01';
                    setMonth(v);
                    if (v.length === 2) { refDay.current?.focus(); }
                  }}
                  style={[styles.segmentInput, (month && (Number(month)<1 || Number(month)>12)) ? styles.segmentError : null]}
                  returnKeyType="next"
                />
                <P style={styles.segmentSep}>/</P>
                <RNTextInput
                  ref={refDay}
                  value={day}
                  placeholder={t('complete.birthDayPH','DD')}
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(txt) => {
                    let v = txt.replace(/[^0-9]/g,'').slice(0,2);
                    if (v.length===2 && Number(v) === 0) v='01';
                    setDay(v);
                  }}
                  style={[styles.segmentInput, (day && (Number(day)<1 || Number(day)>31)) ? styles.segmentError : null]}
                  returnKeyType="done"
                />
              </View>
              {birthdate && validation.ok && (
                <P style={{ color:'#9DA4AF', fontSize:12, marginTop:4 }}>
                  {t('complete.birthAgePreview','Edad')}: {Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25*24*3600*1000))}
                </P>
              )}
              {!validation.ok && (
                <P style={{ color: '#F97066', fontSize: 12, marginTop: 4 }}>{validation.reason}</P>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/name' as any)} />
                  <Button title={t('common.continue')} disabled={!validation.ok} onPress={() => { if (validation.ok) { setDraft((d) => ({ ...d, birthdate: birthdate.trim() })); router.push('(auth)/complete/orientation' as any); } }} />
              </View>
            </Card>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressText: { color: '#E6EAF2', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#D0D5DD', fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, fontSize: 16 },
  segmentSep: { color: '#E6EAF2', fontSize: 18, paddingHorizontal: 2 },
  segmentError: { borderWidth: 1, borderColor: '#F97066' },
});
