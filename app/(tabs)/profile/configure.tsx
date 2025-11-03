import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import { View, ScrollView, Pressable, StyleSheet, Modal, BackHandler, Text, Platform, Linking } from 'react-native';

import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, H1, P, SelectionTile, Button, Card, Switch, Chip } from 'components/ui';
import { useProfile } from 'features/profile/hooks/useProfile';
import { useProfileMutations } from 'features/profile/hooks/useProfileMutations';
import { getGenderLabel, getGenderOptions, getOrientationOptions, toOrientationLabels } from 'features/profile/model/mappings';
import { registerPushTokenForUser, clearPushToken } from 'lib/push';
import { scheduleLocalTestNotification, registerForPushNotificationsAsync } from 'lib/notifications';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';
import { SUPPORT_EMAIL, PRIVACY_URL, TERMS_URL, APP_NAME } from 'lib/brand';
import { openExternal } from 'lib/links';
import { useToast } from 'lib/toast';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
      <P bold style={{ color: theme.colors.text, fontSize: 16 }}>{title}</P>
      {!!subtitle && <P dim style={{ marginTop: 4 }}>{subtitle}</P>}
    </View>
  );
}

function Row({ icon, label, value, onPress, disabled }: { icon: ReactNode; label: string; value?: string; onPress?: () => void; disabled?: boolean }) {
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
  const { session, user, profile, ready } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data } = useProfile();
  const mutations = useProfileMutations(data?.id);
  const toast = useToast();
  // Permissions state
  const [pushPerm, setPushPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [reqPush, setReqPush] = useState(false);
  const [locPerm, setLocPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [camPerm, setCamPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [mediaPerm, setMediaPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [reqLoc, setReqLoc] = useState(false);
  const [reqCam, setReqCam] = useState(false);
  // const [showCityPicker, setShowCityPicker] = useState(false);
  const [pendingPush, setPendingPush] = useState(false);
  const [showingToken, setShowingToken] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState(false);

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
  // const seekingOptions = getSeekingOptions(tf);

  // Forzar que el back (chevron y hardware) vuelva a la pestaña Perfil
  useEffect(() => {
    const onBack = () => { router.replace('/profile' as any); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    // initial permissions snapshot
    (async () => {
      try {
        const np = await Notifications.getPermissionsAsync();
        setPushPerm({ granted: np.status === 'granted', canAskAgain: (np as any).canAskAgain ?? true });
      } catch {}
      try {
        const lp = await Location.getForegroundPermissionsAsync();
        setLocPerm({ granted: lp.status === 'granted', canAskAgain: (lp as any).canAskAgain ?? true });
      } catch {}
      try {
        const cp = await ImagePicker.getCameraPermissionsAsync();
        setCamPerm({ granted: cp.status === 'granted', canAskAgain: (cp as any).canAskAgain ?? true });
      } catch {}
      try {
        const mp = await ImagePicker.getMediaLibraryPermissionsAsync();
        setMediaPerm({ granted: mp.status === 'granted', canAskAgain: (mp as any).canAskAgain ?? true });
      } catch {}
    })();
  }, []);

  async function requestPush(): Promise<boolean> {
    try {
      setReqPush(true);
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      const granted = status === 'granted';
      const after = await Notifications.getPermissionsAsync();
      setPushPerm({ granted, canAskAgain: (after as any).canAskAgain ?? true });
      if (granted && data?.id) {
        try {
          await registerPushTokenForUser(data.id);
          await mutations.updateNotifications.mutateAsync({ push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true });
        } catch {}
      }
      return granted;
    } finally { setReqPush(false); }
  }

  async function requestLocation(): Promise<boolean> {
    try {
      setReqLoc(true);
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      const granted = status === 'granted';
      const after = await Location.getForegroundPermissionsAsync();
      setLocPerm({ granted, canAskAgain: (after as any).canAskAgain ?? true });
      // Persist preference hint
      try { await mutations.updateBasics.mutateAsync({} as any); } catch {}
      return granted;
    } finally { setReqLoc(false); }
  }

  async function requestCamera(): Promise<boolean> {
    try {
      setReqCam(true);
      const camCurrent = await ImagePicker.getCameraPermissionsAsync();
      let camStatus = camCurrent.status;
      if (camStatus !== 'granted') {
        const camReq = await ImagePicker.requestCameraPermissionsAsync();
        camStatus = camReq.status;
      }
      const galCurrent = await ImagePicker.getMediaLibraryPermissionsAsync();
      let galStatus = galCurrent.status;
      if (galStatus !== 'granted') {
        const galReq = await ImagePicker.requestMediaLibraryPermissionsAsync();
        galStatus = galReq.status;
      }
      const granted = camStatus === 'granted' && galStatus === 'granted';
      const afterCam = await ImagePicker.getCameraPermissionsAsync();
      const afterMed = await ImagePicker.getMediaLibraryPermissionsAsync();
      setCamPerm({ granted: afterCam.status === 'granted', canAskAgain: (afterCam as any).canAskAgain ?? true });
      setMediaPerm({ granted: afterMed.status === 'granted', canAskAgain: (afterMed as any).canAskAgain ?? true });
      try { await mutations.updateBasics.mutateAsync({} as any); } catch {}
      return granted;
    } finally { setReqCam(false); }
  }

  const openUrl = async (url: string) => {
    try {
      await openExternal(url);
    } catch (e) {
      toast.show(t('common.error','Ha ocurrido un error'), 'error');
    }
  };

  const contactSupport = async () => {
    const subject = encodeURIComponent(`[${APP_NAME}] ${t('support.subject','Soporte')}`);
    const body = encodeURIComponent(
      `${t('support.preBody','Cuéntanos qué ha pasado o en qué podemos ayudarte.')}` +
      `\n\n${t('support.meta','Información adicional (opcional):')}` +
      `\n- userId: ${data?.id ?? 'n/a'}`
    );
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    await openUrl(mailto);
  };

  return (
    <Screen style={{ padding: 0, backgroundColor: theme.colors.bg }} edges={[]}> 

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

        {/* Distancia de descubrimiento */}
        <SectionHeader title={'Distancia'} subtitle={'Ajusta el radio de personas cercanas'} />
        <Card style={{ paddingVertical: 8, marginHorizontal: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
          {/* Notificaciones push */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <P bold style={{ color: theme.colors.text }}>{t('permissions.notificationsTitle','Notificaciones')}</P>
              <P dim>{t('permissions.notificationsDesc','Mensajes, likes y solicitudes de amistad')}</P>
              {!pushPerm.granted && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Chip label={!pushPerm.canAskAgain ? `🔒 ${t('permissions.statusBlocked','Bloqueado')}` : `🚫 ${t('permissions.statusDenied','Denegado')}`}
                    tone={!pushPerm.canAskAgain ? 'danger' : 'neutral'}
                  />
                </View>
              )}
            </View>
            <View style={{ opacity: (!pushPerm.canAskAgain && !pushPerm.granted) ? 0.5 : 1 }} pointerEvents={reqPush ? 'none' : ((!pushPerm.canAskAgain && !pushPerm.granted) ? 'none' : 'auto')}>
              <Switch
                value={!!data?.push_opt_in}
                onValueChange={async (v) => {
                  if (!data?.id) return;
                  if (v) {
                    // If OS perm not granted, ask first
                    const ok = pushPerm.granted ? true : await requestPush();
                    if (!ok) { toast.show(t('permissions.pushDenied','No se pudo activar notificaciones'), 'error'); return; }
                    setPendingPush(true);
                    try {
                      await registerPushTokenForUser(data.id);
                      await mutations.updateNotifications.mutateAsync({ push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true });
                    } finally { setPendingPush(false); }
                  } else {
                    setPendingPush(true);
                    try {
                      await clearPushToken(data.id);
                      await mutations.updateNotifications.mutateAsync({ push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false });
                    } finally { setPendingPush(false); }
                  }
                }}
              />
            </View>
          </View>

          {/* Toggles por categoría (dependen de OS grant y opt-in) */}
          <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, marginTop: 8 }} />
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, gap: 12, opacity: (pushPerm.granted && data?.push_opt_in) ? 1 : 0.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Mensajes</P>
              <Switch
                value={!!data?.notify_messages}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_messages: v })}
                disabled={!(pushPerm.granted && data?.push_opt_in)}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Likes</P>
              <Switch
                value={!!data?.notify_likes}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_likes: v })}
                disabled={!(pushPerm.granted && data?.push_opt_in)}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P style={{ color: theme.colors.text }}>Solicitudes de amistad</P>
              <Switch
                value={!!data?.notify_friend_requests}
                onValueChange={(v) => mutations.updateNotifications.mutate({ notify_friend_requests: v })}
                disabled={!(pushPerm.granted && data?.push_opt_in)}
              />
            </View>
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 10 }}>
            <P bold style={{ color: theme.colors.text }}>Distancia máxima</P>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <P dim>{(data?.max_distance_km ?? 50)} km</P>
              <View style={{ flexDirection:'row', gap: 8 }}>
                <Pressable onPress={() => {
                  const cur = Math.max(5, Math.min(300, (data?.max_distance_km ?? 50)))
                  const next = Math.max(5, cur - 5)
                  mutations.updateDiscovery.mutate({ max_distance_km: next })
                }} style={({pressed})=>({ paddingHorizontal:12, paddingVertical:8, borderRadius:10, backgroundColor: pressed? theme.colors.card : theme.colors.card, borderWidth:1, borderColor: theme.colors.border })}>
                  <P bold style={{ color: theme.colors.text }}>−</P>
                </Pressable>
                <Pressable onPress={() => {
                  const cur = Math.max(5, Math.min(300, (data?.max_distance_km ?? 50)))
                  const next = Math.min(300, cur + 5)
                  mutations.updateDiscovery.mutate({ max_distance_km: next })
                }} style={({pressed})=>({ paddingHorizontal:12, paddingVertical:8, borderRadius:10, backgroundColor: pressed? theme.colors.card : theme.colors.card, borderWidth:1, borderColor: theme.colors.border })}>
                  <P bold style={{ color: theme.colors.text }}>+</P>
                </Pressable>
              </View>
            </View>
            <P dim style={{ marginTop: 4 }}>Rango: 5–300 km</P>
          </View>
        </Card>

        {/* Permisos del dispositivo */}
        <SectionHeader title={t('permissions.title','Permisos')}
          subtitle={t('permissions.subtitle','Activa acceso a ubicación y cámara para mejorar tu experiencia') as any}
        />
        <Card style={{ paddingVertical: 8, marginHorizontal: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
          {/* Ubicación */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <P bold style={{ color: theme.colors.text }}>{t('permissions.locationTitle','Ubicación')}</P>
              <P dim>{t('permissions.locationDesc','Mejora resultados cercanos al permitir acceso a tu ubicación')}</P>
              {!locPerm.granted && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Chip label={!locPerm.canAskAgain ? `🔒 ${t('permissions.statusBlocked','Bloqueado')}` : `🚫 ${t('permissions.statusDenied','Denegado')}`}
                    tone={!locPerm.canAskAgain ? 'danger' : 'neutral'}
                  />
                </View>
              )}
            </View>
            <View style={{ opacity: (!locPerm.canAskAgain && !locPerm.granted) ? 0.5 : 1 }} pointerEvents={reqLoc ? 'none' : ((!locPerm.canAskAgain && !locPerm.granted) ? 'none' : 'auto')}>
              <Switch
                value={!!locPerm.granted}
                onValueChange={async (v) => {
                  if (v) {
                    const ok = await requestLocation();
                    if (!ok) toast.show(t('permissions.locationDenied','No se pudo conceder ubicación'), 'error');
                  } else {
                    // No se puede revocar desde la app; sugerir ajustes
                    Linking.openSettings();
                  }
                }}
              />
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderColor: theme.colors.border }} />
          {/* Cámara y fotos */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <P bold style={{ color: theme.colors.text }}>{t('permissions.cameraTitle','Cámara y fotos')}</P>
              <P dim>{t('permissions.cameraDesc','Para tomar y subir fotos a tu perfil')}</P>
              {(!(camPerm.granted && mediaPerm.granted)) && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {!camPerm.granted && (
                    <Chip label={`📷 ${t('permissions.cameraLabel','Cámara')}: ${!camPerm.canAskAgain ? t('permissions.statusBlocked','Bloqueado') : t('permissions.statusDenied','Denegado')}`}
                      tone={!camPerm.canAskAgain ? 'danger' : 'neutral'} />
                  )}
                  {!mediaPerm.granted && (
                    <Chip label={`🖼️ ${t('permissions.photosLabel','Fotos')}: ${!mediaPerm.canAskAgain ? t('permissions.statusBlocked','Bloqueado') : t('permissions.statusDenied','Denegado')}`}
                      tone={!mediaPerm.canAskAgain ? 'danger' : 'neutral'} />
                  )}
                </View>
              )}
            </View>
            <View style={{ opacity: (((!camPerm.canAskAgain && !camPerm.granted) && (!mediaPerm.canAskAgain && !mediaPerm.granted))) ? 0.5 : 1 }} pointerEvents={reqCam ? 'none' : (((!camPerm.canAskAgain && !camPerm.granted) && (!mediaPerm.canAskAgain && !mediaPerm.granted))) ? 'none' : 'auto'}>
              <Switch
                value={!!(camPerm.granted && mediaPerm.granted)}
                onValueChange={async (v) => {
                  if (v) {
                    const ok = await requestCamera();
                    if (!ok) toast.show(t('permissions.cameraDenied','No se pudo conceder cámara o fotos'), 'error');
                  } else {
                    Linking.openSettings();
                  }
                }}
              />
            </View>
          </View>

          <View style={{ paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 }}>
            <Button title={`⚙️ ${t('common.openSettings','Abrir ajustes')}`} variant="outline" onPress={() => Linking.openSettings()} />
          </View>
        </Card>

        {/* (Notificaciones fusionadas aquí) */}

        {/* Ayuda y Legal */}
        <SectionHeader title={t('support.helpTitle','Ayuda y legal')} />
        <View style={styles.cardList}>
          <Row
            icon={<Ionicons name="help-circle-outline" size={20} color={theme.colors.text} />}
            label={t('support.contact','Ayuda y soporte')}
            onPress={contactSupport}
          />
          <Row
            icon={<Ionicons name="document-text-outline" size={20} color={theme.colors.text} />}
            label={t('legal.privacy','Política de privacidad')}
            onPress={() => openUrl(PRIVACY_URL)}
          />
          <Row
            icon={<Ionicons name="document-lock-outline" size={20} color={theme.colors.text} />}
            label={t('legal.terms','Términos y condiciones')}
            onPress={() => openUrl(TERMS_URL)}
          />
        </View>

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
