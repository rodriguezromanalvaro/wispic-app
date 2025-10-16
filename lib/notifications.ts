import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(projectId: string): Promise<string | null> {
  // Request permissions (Android 13+ needs POST_NOTIFICATIONS)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // On Android, create default notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  // Get Expo push token (requires extra.eas.projectId)
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResponse.data ?? null;
}

export async function scheduleLocalTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Notificación local de prueba',
      body: 'Si ves esto, las notificaciones locales funcionan.',
    },
    trigger: null,
  });
}
