import { useEffect, useRef, useState } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View, Linking } from 'react-native';

import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, Button, Switch, Chip, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { nearestCities, CityRow } from 'lib/location/geo';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';


export default function StepPermissions() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft, patchProfile } = useCompleteProfile();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [reqPush, setReqPush] = useState(false);
  const [reqLoc, setReqLoc] = useState(false);
  const [reqCam, setReqCam] = useState(false);
  const didSyncRef = useRef(false);
  const [pushPerm, setPushPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [locPerm, setLocPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [camPerm, setCamPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });
  const [mediaPerm, setMediaPerm] = useState<{ granted: boolean; canAskAgain: boolean }>({ granted: false, canAskAgain: true });

  async function refreshPerms() {
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
    // return snapshots for immediate sync decisions
    try {
      const [np, lp, cp, mp] = await Promise.all([
        Notifications.getPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
        ImagePicker.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);
      return {
        push: { granted: np.status === 'granted', canAskAgain: (np as any).canAskAgain ?? true },
        loc: { granted: lp.status === 'granted', canAskAgain: (lp as any).canAskAgain ?? true },
        cam: { granted: cp.status === 'granted', canAskAgain: (cp as any).canAskAgain ?? true },
        media: { granted: mp.status === 'granted', canAskAgain: (mp as any).canAskAgain ?? true },
      };
    } catch {
      return { push: pushPerm, loc: locPerm, cam: camPerm, media: mediaPerm };
    }
  }

  // Capture nearest city once we have location permission
  async function captureNearestCityOnce() {
    try {
      if (!user?.id) return;
      const lp = await Location.getForegroundPermissionsAsync();
      if (lp.status !== 'granted') return;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  // Persist coords server-side (no label yet)
  try {
    const { error: locErr } = await supabase.rpc('set_profile_location', { p_user: user.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_label: null, p_place_id: null, p_country_code: null });
    if (locErr) {
      console.warn('[permissions] set_profile_location error:', locErr.message);
      const msg = String(locErr.message||'');
      // Fallback: direct upsert if RPC is missing (migrations not applied yet)
      if (msg.includes('Could not find the function') || msg.includes('schema cache') || msg.includes('42883')) {
        const { error: upErr } = await supabase
          .from('profile_locations')
          .upsert({ user_id: user.id, lat: pos.coords.latitude, lng: pos.coords.longitude, city_label: null, place_id: null, country_code: null }, { onConflict: 'user_id' });
        if (upErr) console.warn('[permissions] fallback upsert profile_locations error:', upErr.message);
      }
    }
  } catch (e:any) { console.warn('[permissions] set_profile_location exception:', e?.message||e); }
      // Prefer server-side resolution to ensure city_id is set reliably
      try {
        const { data: ok, error: rpcErr } = await supabase.rpc('set_profile_city_by_coords', {
          p_user: user.id,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
        if (rpcErr) console.warn('[permissions] set_profile_city_by_coords error:', rpcErr.message);
        if (!rpcErr && ok === true) {
          return; // Done; DB updated city/city_id successfully
        }
      } catch (e:any) { console.warn('[permissions] set_profile_city_by_coords exception:', e?.message||e); }
      const { data, error } = await supabase.from('cities').select('id,name,lat,lng').order('name');
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
      let updated = false;
      if (!error && Array.isArray(data) && data.length > 0) {
        const list = (data as CityRow[]);
        const nearest = nearestCities(list, { lat, lng }, 1)[0];
        if (nearest) {
          await supabase.from('profiles').update({ city: nearest.name, city_id: nearest.id }).eq('id', user.id);
          updated = true;
        }
      }
      if (!updated) {
        // Fallback: reverse geocode and set city name; DB trigger intentará resolver city_id
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          const first = Array.isArray(rev) ? rev[0] : undefined;
          const cityName = (first?.city || first?.subregion || first?.region || first?.district || '').trim();
          if (cityName) {
            const countryCode = (first as any)?.isoCountryCode || (first as any)?.countryCode || null;
            try {
              const { error: locErr2 } = await supabase.rpc('set_profile_location', { p_user: user.id, p_lat: lat, p_lng: lng, p_label: cityName, p_place_id: null, p_country_code: countryCode });
              if (locErr2) {
                const msg2 = String(locErr2.message||'');
                if (msg2.includes('Could not find the function') || msg2.includes('schema cache') || msg2.includes('42883')) {
                  await supabase.from('profile_locations').upsert({ user_id: user.id, lat, lng, city_label: cityName, place_id: null, country_code: countryCode }, { onConflict: 'user_id' });
                }
              }
            } catch {}
            // Try to find a matching city_id by name patterns; pick nearest if multiple
            let picked: CityRow | null = null;
            const patterns = [cityName, `${cityName}%`, `%${cityName}%`];
            for (const pat of patterns) {
              const { data: byName } = await supabase
                .from('cities')
                .select('id,name,lat,lng')
                .ilike('name', pat)
                .limit(20);
              if (byName && byName.length) {
                const list = byName as CityRow[];
                const nearest = nearestCities(list, { lat, lng }, 1)[0];
                picked = nearest || list[0];
                break;
              }
            }
            if (picked) {
              await supabase.from('profiles').update({ city: picked.name, city_id: picked.id }).eq('id', user.id);
            } else {
              await supabase.from('profiles').update({ city: cityName }).eq('id', user.id);
            }
          }
        } catch {}
      }
    } catch {
      // ignore best-effort
    }
  }

  useEffect(() => {
    (async () => {
      const snap = await refreshPerms();
      // Crear canales Android opcionales para clarificar categorías
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('messages', { name: 'Messages', importance: Notifications.AndroidImportance.HIGH });
          await Notifications.setNotificationChannelAsync('likes', { name: 'Likes', importance: Notifications.AndroidImportance.DEFAULT });
          await Notifications.setNotificationChannelAsync('friends', { name: 'Friends', importance: Notifications.AndroidImportance.DEFAULT });
        } catch {}
      }
      // Sync inicial: si el SO ya lo tiene concedido, reflejarlo en el switch (una sola vez)
      if (!didSyncRef.current && snap) {
        const updates: any = {};
        let changed = false;
        let shouldCaptureCity = false;
        // Push
        if (snap.push.granted) {
          if (!draft.push_opt_in) {
            updates.push_opt_in = true; changed = true;
            setDraft(d => ({ ...d, push_opt_in: true }));
            try {
              const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants?.expoConfig?.extra?.eas?.projectId })) as any;
              if (token?.data && !draft.expo_push_token) {
                updates.expo_push_token = token.data;
                setDraft(d => ({ ...d, expo_push_token: token.data } as any));
              }
            } catch {}
          }
        } else {
          // No concedido (denegado o bloqueado): forzar preferencia a OFF
          if (draft.push_opt_in || draft.notify_messages || draft.notify_likes || draft.notify_friend_requests) {
            updates.push_opt_in = false; updates.notify_messages = false; updates.notify_likes = false; updates.notify_friend_requests = false; changed = true;
            setDraft(d => ({ ...d, push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false }));
          }
        }
        // Location
        if (snap.loc.granted) {
          if (!draft.location_opt_in) { updates.location_opt_in = true; changed = true; setDraft(d => ({ ...d, location_opt_in: true })); }
          // Capturar coords después del patchProfile para evitar fallos de FK
          shouldCaptureCity = true;
        } else {
          if (draft.location_opt_in) { updates.location_opt_in = false; changed = true; setDraft(d => ({ ...d, location_opt_in: false })); }
        }
        // Camera + Media
        if (snap.cam.granted && snap.media.granted) {
          if (!draft.camera_opt_in) { updates.camera_opt_in = true; changed = true; setDraft(d => ({ ...d, camera_opt_in: true })); }
        } else {
          if (draft.camera_opt_in) { updates.camera_opt_in = false; changed = true; setDraft(d => ({ ...d, camera_opt_in: false })); }
        }
        if (changed) {
          await patchProfile(updates);
        }
        if (shouldCaptureCity) {
          try { await captureNearestCityOnce(); } catch (e:any) { console.warn('[permissions] captureNearestCityOnce error:', e?.message||e); }
        }
        didSyncRef.current = true;
      }
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
      setDraft(d => ({ ...d, push_opt_in: granted, notify_messages: granted, notify_likes: granted, notify_friend_requests: granted } as any));
      const after = await Notifications.getPermissionsAsync();
      setPushPerm({ granted, canAskAgain: (after as any).canAskAgain ?? true });
      if (granted) {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants?.expoConfig?.extra?.eas?.projectId })) as any;
        if (token?.data) setDraft(d => ({ ...d, expo_push_token: token.data } as any));
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
      setDraft(d => ({ ...d, location_opt_in: granted } as any));
      const after = await Location.getForegroundPermissionsAsync();
      setLocPerm({ granted, canAskAgain: (after as any).canAskAgain ?? true });
      if (granted) {
        // Best-effort: capture city on grant
        await captureNearestCityOnce();
      }
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
      setDraft(d => ({ ...d, camera_opt_in: granted } as any));
      const afterCam = await ImagePicker.getCameraPermissionsAsync();
      const afterMed = await ImagePicker.getMediaLibraryPermissionsAsync();
      setCamPerm({ granted: afterCam.status === 'granted', canAskAgain: (afterCam as any).canAskAgain ?? true });
      setMediaPerm({ granted: afterMed.status === 'granted', canAskAgain: (afterMed as any).canAskAgain ?? true });
      return granted;
    } finally { setReqCam(false); }
  }

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={8} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('permissions.title','No te pierdas nada!')}</H1>
            <P style={styles.subtitle}>{t('permissions.subtitle','Elige qué permisos y notificaciones quieres permitir')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={styles.row}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.notificationsTitle','Notificaciones')}</P>
                  <P style={styles.itemDesc}>{t('permissions.notificationsDesc','Mensajes, likes y matches, y solicitudes de amistad')}</P>
                  {!pushPerm.granted && (
                    <View style={styles.badgeRow}>
                      <Chip
                        label={!pushPerm.canAskAgain ? `🔒 ${t('permissions.statusBlocked','Bloqueado por el sistema')}` : `🚫 ${t('permissions.statusDenied','Denegado')}`}
                        tone={!pushPerm.canAskAgain ? 'danger' : 'neutral'}
                      />
                    </View>
                  )}
                </View>
                <View style={{ opacity: (!pushPerm.canAskAgain && !pushPerm.granted) ? 0.5 : 1 }} pointerEvents={reqPush ? 'none' : ((!pushPerm.canAskAgain && !pushPerm.granted) ? 'none' : 'auto')}>
                  <Switch
                    value={!!draft.push_opt_in}
                    onValueChange={async (v)=> {
                    if (v) {
                      // Optimista: enciende de inmediato
                      setDraft(d=>({ ...d, push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true }));
                      if (pushPerm.granted) {
                        await patchProfile({ push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true });
                      } else {
                        const ok = await requestPush();
                        if (!ok) {
                          // Revertir si no se concede
                          setDraft(d=>({ ...d, push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false }));
                          await patchProfile({ push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false });
                          return;
                        }
                        await patchProfile({ push_opt_in: true, notify_messages: true, notify_likes: true, notify_friend_requests: true });
                      }
                    } else {
                      // OFF inmediato
                      setDraft(d=>({ ...d, push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false }));
                      await patchProfile({ push_opt_in: false, notify_messages: false, notify_likes: false, notify_friend_requests: false });
                    }
                    }}
                  />
                </View>
              </View>

              <View style={[styles.row, styles.sectionGap]}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.locationTitle','Ubicación')}</P>
                  <P style={styles.itemDesc}>{t('permissions.locationDesc','Mejora resultados cercanos al permitir acceso a tu ubicación')}</P>
                  {!locPerm.granted && (
                    <View style={styles.badgeRow}>
                      {!locPerm.canAskAgain ? (
                        <Chip label={`🔒 ${t('permissions.statusBlocked','Bloqueado por el sistema')} — ${t('permissions.locationBlockedHint','Para activarlo, abre Ajustes del sistema y concede el permiso de Ubicación.')}`} tone="danger" />
                      ) : (
                        <Chip label={`🚫 ${t('permissions.statusDenied','Denegado')}`} />
                      )}
                    </View>
                  )}
                </View>
                <View style={{ opacity: (!locPerm.canAskAgain && !locPerm.granted) ? 0.5 : 1 }} pointerEvents={reqLoc ? 'none' : ((!locPerm.canAskAgain && !locPerm.granted) ? 'none' : 'auto')}>
                  <Switch
                    value={!!draft.location_opt_in}
                    onValueChange={async (v)=> {
                    if (v) {
                      // Optimista
                      setDraft(d=>({ ...d, location_opt_in: true }));
                      if (locPerm.granted) {
                        await patchProfile({ location_opt_in: true });
                        await captureNearestCityOnce();
                      } else {
                        const ok = await requestLocation();
                        if (!ok) {
                          setDraft(d=>({ ...d, location_opt_in: false }));
                          await patchProfile({ location_opt_in: false });
                          return;
                        }
                        await patchProfile({ location_opt_in: true });
                        await captureNearestCityOnce();
                      }
                    } else {
                      setDraft(d=>({ ...d, location_opt_in: false }));
                      await patchProfile({ location_opt_in: false });
                    }
                    }}
                  />
                </View>
              </View>

              <View style={[styles.row, styles.sectionGap]}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.cameraTitle','Cámara y fotos')}</P>
                  <P style={styles.itemDesc}>{t('permissions.cameraDesc','Para tomar y subir fotos a tu perfil')}</P>
                  {(!(camPerm.granted && mediaPerm.granted)) && (
                    <View style={styles.badgeRowWrap}>
                      {!camPerm.granted && (
                        <Chip label={`📷 ${t('permissions.cameraLabel','Cámara')}: ${!camPerm.canAskAgain ? t('permissions.statusBlocked','Bloqueado') : t('permissions.statusDenied','Denegado')}`} tone={!camPerm.canAskAgain ? 'danger' : 'neutral'} />
                      )}
                      {!mediaPerm.granted && (
                        <Chip label={`🖼️ ${t('permissions.photosLabel','Fotos')}: ${!mediaPerm.canAskAgain ? t('permissions.statusBlocked','Bloqueado') : t('permissions.statusDenied','Denegado')}`} tone={!mediaPerm.canAskAgain ? 'danger' : 'neutral'} />
                      )}
                    </View>
                  )}
                </View>
                <View style={{ opacity: (((!camPerm.canAskAgain && !camPerm.granted) && (!mediaPerm.canAskAgain && !mediaPerm.granted))) ? 0.5 : 1 }} pointerEvents={reqCam ? 'none' : (((!camPerm.canAskAgain && !camPerm.granted) && (!mediaPerm.canAskAgain && !mediaPerm.granted))) ? 'none' : 'auto'}>
                  <Switch
                    value={!!draft.camera_opt_in}
                    onValueChange={async (v)=> {
                    if (v) {
                      // Optimista
                      setDraft(d=>({ ...d, camera_opt_in: true }));
                      if (camPerm.granted && mediaPerm.granted) {
                        await patchProfile({ camera_opt_in: true });
                      } else {
                        const ok = await requestCamera();
                        if (!ok) {
                          setDraft(d=>({ ...d, camera_opt_in: false }));
                          await patchProfile({ camera_opt_in: false });
                          return;
                        }
                        await patchProfile({ camera_opt_in: true });
                      }
                    } else {
                      setDraft(d=>({ ...d, camera_opt_in: false }));
                      await patchProfile({ camera_opt_in: false });
                    }
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:12, flexWrap: 'wrap' }}>
                <Button title={`⚙️ ${t('common.openSettings','Abrir ajustes')}`} variant="outline" onPress={() => Linking.openSettings()} />
              </View>

            </GlassCard>
          </TgYStack>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => router.push('(auth)/complete/photos' as any) },
              { title: t('common.back'), onPress: () => router.push('(auth)/complete/relationship' as any), variant: 'outline' },
            ]}
          />
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16 },
  row: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical: 8 },
  itemTitle: { color: theme.colors.text, fontWeight: '700' },
  itemDesc: { color: theme.colors.textDim, fontSize: 12 },
  permStatus: { fontSize: 11, marginTop: 2 },
  permStatusSmall: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  badgeRowWrap: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' },
  sectionGap: { marginTop: 12 },
});
