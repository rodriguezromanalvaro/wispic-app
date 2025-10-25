import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Modal, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, H1, P, SelectionTile, Button, Card, Switch } from '../../components/ui';
import { getGenderLabel, getGenderOptions, getOrientationOptions, toOrientationLabels, getSeekingOptions } from '../../lib/profileMappings';
import { theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { useProfileMutations } from '../../features/profile/hooks/useProfileMutations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerPushTokenForUser, clearPushToken } from '../../lib/push';
import CityPickerSheet from '../../components/location/CityPickerSheet';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
      <P bold style={{ color: theme.colors.text, fontSize: 16 }}>{title}</P>
      {!!subtitle && <P dim style={{ marginTop: 4 }}>{subtitle}</P>}
    </View>
  );
}

function Row({ icon, label, value, onPress, disabled }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void; disabled?: boolean }) {
  const interactive = !!onPress && !disabled;
  const displayValue = value ?? (disabled ? '—' : 'Añadir');
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.row, interactive && pressed && { opacity: 0.8 }]} accessibilityRole={interactive ? 'button' : 'summary'}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, disabled && styles.rowIconDisabled]}>{icon}</View>
        <P style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{label}</P>
      </View>
      <View style={styles.rowRight}>
        <P dim style={styles.rowValue}>{displayValue}</P>
        {interactive && <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />}
      </View>
    </Pressable>
  );
}

export default function ConfigureProfileList() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data } = useProfile();
  const mutations = useProfileMutations(data?.id);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [pendingPush, setPendingPush] = useState(false);

  const [sheet, setSheet] = useState<null | { type: 'gender' } | { type: 'orientation' } | { type: 'seeking' }>(null);
  // Local t wrapper to satisfy our helper signature
  const tf = (k: string, def?: string) => t(k as any, def as any);

  // Gender value localized
  const genderValue = getGenderLabel(data?.gender as any, tf);
  // Orientation & Seeking values localized
  const interested = (data?.interested_in || []) as string[];
  const orientationValue = toOrientationLabels(interested, tf).join(', ');
  const seekingCode = Array.isArray(data?.seeking) && data!.seeking!.length ? String(data!.seeking![0]) : '';
  const seekingLabel = seekingCode === 'dating' ? t('seeking.dating','Citas')
    : seekingCode === 'friends' ? t('seeking.friends','Amistad')
    : seekingCode === 'everything' ? t('seeking.everything','Un poco de todo')
    : seekingCode === 'notSure' ? t('seeking.notSure','Aún no lo tengo claro')
    : '';
  const seekingValue = seekingCode ? seekingLabel : '';
  // Options
  const genderOptions = getGenderOptions(tf);
  const orientationOptions = getOrientationOptions(tf);
  const seekingOptions = getSeekingOptions(tf);

  // Forzar que el back (chevron y hardware) vuelva a la pestaña Perfil
  useEffect(() => {
    const onBack = () => { router.replace('/profile' as any); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [router]);

  return (
    <Screen style={{ padding: 0 }} edges={[]}> 
      {/* Header simple con botón atrás */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 8, flexDirection:'row', alignItems:'center', gap: 8 }}>
        <Pressable onPress={() => router.replace('/profile' as any)} style={{ padding: 8 }} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <H1 style={{ fontSize: 20, fontWeight: '800' }}>{t('profile.configure','Configurar perfil')}</H1>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {/* Sección Sobre ti */}
        <SectionHeader title={t('profile.sections.aboutYou','Sobre ti')} />
        <View style={styles.cardList}>
          <Row
            icon={<Ionicons name="location-outline" size={20} color={theme.colors.text} />}
            label={t('profile.location','Ubicación')}
            value={(data?.city ?? 'Sin ubicación') || 'Sin ubicación'}
            onPress={() => router.push('/profile/location' as any)}
          />
          <Row icon={<Ionicons name="images-outline" size={20} color={theme.colors.text} />} label={t('profile.photos','Fotos')} value={t('profile.manage','Gestionar')} onPress={() => router.push('/profile/photos' as any)} />
          <Row icon={<Ionicons name="calendar-outline" size={20} color={theme.colors.text} />} label={t('profile.age','Edad')} value={typeof data?.age==='number' ? String(data.age) : undefined} disabled />
          <Row icon={<Ionicons name="male-female-outline" size={20} color={theme.colors.text} />} label={t('profile.gender','Género')} value={genderValue || undefined} onPress={() => setSheet({ type: 'gender' })} />
        </View>
        {/* Sección Preferencias */}
        <SectionHeader title={t('profile.preferences','Preferencias')} />
        <View style={styles.cardList}>
          <Row icon={<Ionicons name="search-outline" size={20} color={theme.colors.text} />} label={t('complete.seekingTitle','¿Qué buscas aquí?')} value={seekingValue || undefined} onPress={() => setSheet({ type: 'seeking' })} />
          <Row icon={<Ionicons name="person-outline" size={20} color={theme.colors.text} />} label={t('complete.orientationTitle','¿A quién estás buscando?')} value={orientationValue || undefined} onPress={() => setSheet({ type: 'orientation' })} />
        </View>

        {/* Sección Notificaciones */}
        <SectionHeader title={t('profile.notifications','Notificaciones')}
          subtitle={t('profile.notificationsSubtitle','Activa o desactiva las notificaciones push y elige qué recibir') as any}
        />
        <Card style={{ paddingVertical: 8, marginHorizontal: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
            <View>
              <P bold style={{ color: theme.colors.text }}>Notificaciones push</P>
              <P dim>{data?.push_opt_in ? 'Activadas' : 'Desactivadas'}</P>
            </View>
            {data?.push_opt_in ? (
              <Button
                title={pendingPush ? 'Desactivando…' : 'Desactivar'}
                onPress={async () => {
                  if (!data?.id) return;
                  try {
                    setPendingPush(true);
                    await clearPushToken(data.id);
                    await mutations.updateNotifications.mutateAsync({ push_opt_in: false });
                  } finally {
                    setPendingPush(false);
                  }
                }}
                variant="outline"
                disabled={pendingPush}
              />
            ) : (
              <Button
                title={pendingPush ? 'Activando…' : 'Activar'}
                onPress={async () => {
                  if (!data?.id) return;
                  try {
                    setPendingPush(true);
                    await registerPushTokenForUser(data.id);
                    await mutations.updateNotifications.mutateAsync({ push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true });
                  } finally {
                    setPendingPush(false);
                  }
                }}
                disabled={pendingPush}
              />
            )}
          </View>

          {/* Toggles por categoría */}
          <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, marginTop: 8 }} />
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, gap: 12, opacity: data?.push_opt_in ? 1 : 0.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Mensajes</P>
              <Switch
                value={!!data?.notify_messages}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_messages: v })}
                disabled={!data?.push_opt_in}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Likes</P>
              <Switch
                value={!!data?.notify_likes}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_likes: v })}
                disabled={!data?.push_opt_in}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Solicitudes de amistad</P>
              <Switch
                value={!!data?.notify_friend_requests}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_friend_requests: v })}
                disabled={!data?.push_opt_in}
              />
            </View>
          </View>
        </Card>

      </ScrollView>

      {/* City picker sheet was replaced by a full-screen selector at /profile/location */}

      {/* Bottom sheets sencillas para género/orientación/busco */}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            {sheet?.type === 'gender' && (
              <>
                <H1 style={styles.sheetTitle}>{t('profile.gender','Género')}</H1>
                <View style={{ maxHeight: 360, gap: 8 }}>
                  {genderOptions.map(({ code, label }) => {
                    const isActive = label === genderValue;
                    return (
                      <SelectionTile
                        key={code}
                        active={isActive}
                        label={label}
                        indicator={isActive ? 'radio' : 'none'}
                        onPress={async () => {
                          await mutations.updateBasics.mutateAsync({ gender: code });
                          setSheet(null);
                        }}
                      />
                    );
                  })}
                </View>
              </>
            )}
            {sheet?.type === 'orientation' && (
              <>
                <H1 style={styles.sheetTitle}>{t('profile.orientation','Sexualidad')}</H1>
                <View style={{ maxHeight: 360, gap: 8 }}>
                  {orientationOptions.map(({ code, label }) => {
                    const current = (interested && interested[0]) || '';
                    const active = current === code;
                    return (
                      <SelectionTile
                        key={code}
                        active={active}
                        label={label}
                        indicator={active ? 'radio' : 'none'}
                        onPress={async () => {
                          await mutations.updateBasics.mutateAsync({ interested_in: code ? [code] : [] as any });
                          setSheet(null);
                        }}
                      />
                    );
                  })}
                </View>
              </>
            )}
            {sheet?.type === 'seeking' && (
              <>
                <H1 style={styles.sheetTitle}>{t('profile.seeking','Busco')}</H1>
                <View style={{ maxHeight: 360, gap: 8 }}>
                  {['dating','friends','everything','notSure'].map((code) => {
                    const current = Array.isArray(data?.seeking) && data!.seeking!.length ? data!.seeking![0] : '';
                    const label =
                      code === 'dating' ? t('seeking.dating','Citas') :
                      code === 'friends' ? t('seeking.friends','Amistad') :
                      code === 'everything' ? t('seeking.everything','Un poco de todo') :
                      t('seeking.notSure','Aún no lo tengo claro');
                    const active = current === code;
                    return (
                      <SelectionTile
                        key={code}
                        active={active}
                        label={label}
                        indicator={active ? 'radio' : 'none'}
                        onPress={async () => {
                          await mutations.updateBasics.mutateAsync({ seeking: code ? [code] : [] as any });
                          setSheet(null);
                        }}
                      />
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardList: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
  rowIconDisabled: { backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.03)' : '#F8FAFC' },
  rowLabel: { color: theme.colors.text, fontSize: 16 },
  rowLabelDisabled: { color: theme.colors.textDim },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '48%' },
  rowValue: { color: theme.colors.textDim, fontSize: 14 },

  sheetOverlay: { flex:1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'flex-end' },
  sheetContainer: { width:'100%', backgroundColor: theme.colors.card, borderTopLeftRadius: 16, borderTopRightRadius:16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  sheetHandle: { alignSelf:'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
});
