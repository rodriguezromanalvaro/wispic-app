import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Evita usar expo-notifications en Expo Go (SDK >=53 lo bloquea). Usaremos import dinámico.
const isExpoGo = Constants?.appOwnership === 'expo';

export async function registerPushTokenForUser(userId: string) {
  // En Expo Go no registramos push (SDK 53+ lo impide)
  if (isExpoGo) return;
  // En web no hay push nativo
  if (Platform.OS === 'web') return;

  // Import dinámico para evitar side-effects en Expo Go
  const Notifications = await import('expo-notifications');

  // Handler de notificaciones en foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      // Nuevas propiedades
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // 1) Permisos
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return; // El usuario puede usar la app sin notis

  // 2) Obtener token de Expo (en dev build/bare puede requerir projectId)
  const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId
    ?? (Constants as any)?.easConfig?.projectId
    ?? undefined;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } as any : undefined
  );
  const expoToken = tokenData.data;

  // 3) Canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 4) Guardar token en perfil
  await supabase.from('profiles').update({ push_token: expoToken }).eq('id', userId);
}

export async function clearPushToken(userId: string) {
  await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
}
