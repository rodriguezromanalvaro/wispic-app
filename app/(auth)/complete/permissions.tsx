import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button, Switch } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

export default function StepPermissions() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const { t } = useTranslation();

  const [requesting, setRequesting] = useState(false);

  async function requestPush() {
    try {
      setRequesting(true);
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      setDraft(d => ({ ...d, push_opt_in: granted, notify_messages: granted, notify_likes: granted, notify_friend_requests: granted } as any));
      if (granted) {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants?.expoConfig?.extra?.eas?.projectId })) as any;
        if (token?.data) setDraft(d => ({ ...d, expo_push_token: token.data } as any));
      }
    } finally { setRequesting(false); }
  }

  async function requestLocation() {
    try {
      setRequesting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setDraft(d => ({ ...d, location_opt_in: granted } as any));
    } finally { setRequesting(false); }
  }

  async function requestCamera() {
    try {
      setRequesting(true);
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // No persistimos explicitamente; las fotos se manejan en el paso 9
    } finally { setRequesting(false); }
  }

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap, { top: insets.top + 8 }]}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(8/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 8, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('permissions.title','No te pierdas nada!')}</H1>
            <P style={styles.subtitle}>{t('permissions.subtitle','Elige qué permisos y notificaciones quieres permitir')}</P>
            <Card style={styles.card}>
              <View style={styles.row}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.msgTitle','Mensajes')}</P>
                  <P style={styles.itemDesc}>{t('permissions.msgDesc','Recibe notificaciones cuando alguien te envíe un mensaje')}</P>
                </View>
                <Switch value={!!draft.notify_messages} onValueChange={(v)=> setDraft(d=>({ ...d, notify_messages: v, push_opt_in: v || d.push_opt_in }))} />
              </View>
              <View style={styles.row}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.likesTitle','Likes y Matches')}</P>
                  <P style={styles.itemDesc}>{t('permissions.likesDesc','Recibe notificaciones cuando recibas un like o hagas match')}</P>
                </View>
                <Switch value={!!draft.notify_likes} onValueChange={(v)=> setDraft(d=>({ ...d, notify_likes: v, push_opt_in: v || d.push_opt_in }))} />
              </View>
              <View style={styles.row}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.friendsTitle','Solicitudes de amistad')}</P>
                  <P style={styles.itemDesc}>{t('permissions.friendsDesc','Recibe notificaciones de solicitudes de amistad')}</P>
                </View>
                <Switch value={!!draft.notify_friend_requests} onValueChange={(v)=> setDraft(d=>({ ...d, notify_friend_requests: v, push_opt_in: v || d.push_opt_in }))} />
              </View>

              <View style={{ height: 8 }} />
              <View style={styles.row}> 
                <View style={{ flex:1 }}>
                  <P style={styles.itemTitle}>{t('permissions.locationTitle','Ubicación')}</P>
                  <P style={styles.itemDesc}>{t('permissions.locationDesc','Mejora resultados cercanos al permitir acceso a tu ubicación')}</P>
                </View>
                <Switch value={!!draft.location_opt_in} onValueChange={(v)=> setDraft(d=>({ ...d, location_opt_in: v }))} />
              </View>

              <View style={{ flexDirection:'row', gap:8, marginTop:12, flexWrap: 'wrap' }}>
                <Button title={t('permissions.requestPush','Permitir notificaciones')} variant="ghost" onPress={requestPush} disabled={requesting} />
                <Button title={t('permissions.requestLocation','Permitir ubicación')} variant="ghost" onPress={requestLocation} disabled={requesting} />
                <Button title={t('permissions.requestCamera','Permitir cámara/fotos')} variant="ghost" onPress={requestCamera} disabled={requesting} />
              </View>

              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/orientation' as any)} />
                <Button title={t('common.continue')} onPress={() => router.push('(auth)/complete/photos' as any)} />
              </View>
            </Card>
          </View>
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
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical: 8 },
  itemTitle: { color: theme.colors.text, fontWeight: '700' },
  itemDesc: { color: theme.colors.textDim, fontSize: 12 },
});
