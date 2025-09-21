import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// iOS y Android: cómo se muestran las notificaciones cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,

    // Nuevas propiedades requeridas por versiones recientes
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushTokenForUser(userId: string) {
  // 1) Permisos
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    // El usuario puede usar la app sin notis
    return;
  }

  // 2) Obtener token de Expo
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const expoToken = tokenData.data;

  // 3) Canal Android (opcional pero recomendable)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 4) Guardar token en el perfil
  await supabase.from('profiles').update({ push_token: expoToken }).eq('id', userId);
}

export async function clearPushToken(userId: string) {
  await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
}
