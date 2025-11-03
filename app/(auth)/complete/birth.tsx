import { useState, useMemo, useRef, useEffect } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View, ScrollView, TextInput as RNTextInput } from 'react-native';

import { useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

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

  // Field-level error states: only when each segment is fully filled
  const yearErr = useMemo(() => {
    if (year.length !== 4) return false;
    const yy = Number(year);
    const currentYear = new Date().getFullYear();
    return !Number.isFinite(yy) || yy < 1900 || yy > currentYear;
  }, [year]);
  const monthErr = useMemo(() => {
    if (month.length !== 2) return false;
    const mm = Number(month);
    return !Number.isFinite(mm) || mm < 1 || mm > 12;
  }, [month]);
  const dayErr = useMemo(() => {
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return false;
    const yy = Number(year);
    const mm = Number(month);
    const dd = Number(day);
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return true;
    if (mm < 1 || mm > 12) return false; // month error will highlight instead
    const leap = (yy % 400 === 0) || (yy % 4 === 0 && yy % 100 !== 0);
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
    return dd < 1 || dd > dim;
  }, [year, month, day]);

  useEffect(() => {
    // Auto-focus year field to open the keyboard immediately
    const id = setTimeout(() => refYear.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  // No cambiamos justifyContent con teclado para mantener homogeneidad entre pantallas

  const displayName = (draft?.name || '').trim();
  const titleText = displayName
    ? t('complete.birthTitleAskName', '{{name}}, ¿Cuál es tu fecha de nacimiento?', { name: displayName })
    : t('complete.birthTitle');

  // Extra padding so last elements don't hide behind sticky footer
  const bottomPad = Math.max(insets.bottom, 16) + 140;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={3} total={10} />
          <ScrollView
            style={{ flex: 1, alignSelf: 'stretch' }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: 16, paddingBottom: bottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'interactive'}
            showsVerticalScrollIndicator={false}
          >            
            <H1 style={styles.title}>{titleText}</H1>
            <P style={styles.subtitle}>{t('complete.birthSubtitle')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={styles.segmentRow}>
                <RNTextInput
                  ref={refYear}
                  value={year}
                  placeholder={t('complete.birthYearPH','YYYY')}
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(txt) => {
                    const v = txt.replace(/[^0-9]/g,'').slice(0,4);
                    setYear(v);
                    if (v.length === 4) { refMonth.current?.focus(); }
                  }}
                  style={[styles.segmentInput, yearErr ? styles.segmentError : null]}
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
                  style={[styles.segmentInput, monthErr ? styles.segmentError : null]}
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
                  style={[styles.segmentInput, dayErr ? styles.segmentError : null]}
                  returnKeyType="done"
                />
              </View>
              {year.length === 4 && month.length === 2 && day.length === 2 && validation.ok && (
                (() => {
                  const years = Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25*24*3600*1000));
                  return (
                    <View style={styles.agePill}>
                      <P style={styles.ageText}>{t('complete.birthAgeYouAre', 'Tienes {{years}} años', { years })}</P>
                    </View>
                  );
                })()
              )}
              {year.length === 4 && month.length === 2 && day.length === 2 && !validation.ok && (
                <P style={{ color: '#F97066', fontSize: 12, marginTop: 4 }}>{validation.reason}</P>
              )}
            </GlassCard>
          </ScrollView>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => { if (validation.ok) { setDraft((d) => ({ ...d, birthdate: birthdate.trim() })); router.push('(auth)/complete/gender' as any); } }, disabled: !validation.ok },
              { title: t('common.back'), onPress: () => router.push('(auth)/complete/name' as any), variant: 'outline' },
            ]}
          />
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scrollContent: { alignItems: 'center', gap: 16, paddingHorizontal: 0 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentInput: { flex: 1, backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, fontSize: 16 },
  segmentSep: { color: theme.colors.textDim, fontSize: 18, paddingHorizontal: 2 },
  segmentError: { borderWidth: 1, borderColor: '#F97066' },
  agePill: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  ageText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
});
