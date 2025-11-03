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

  // Handler de notificaciones: suprime mensajes ya leídos antes de la entrega
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      try {
        const data = (notification?.request?.content?.data || {}) as any;
        const type = data?.type as string | undefined;
        // Sólo aplicamos lógica de supresión para notificaciones de mensajes
        if (type === 'message') {
          // Requerimos al menos match_id; created_at es opcional (si no viene, leeremos el mensaje por id)
          const matchIdRaw = data?.match_id;
          const messageIdRaw = data?.message_id;
          const createdAtRaw = data?.created_at as string | undefined;

          const matchId = typeof matchIdRaw === 'string' ? Number(matchIdRaw) : Number(matchIdRaw);
          const messageId = typeof messageIdRaw === 'string' ? Number(messageIdRaw) : Number(messageIdRaw);

          if (Number.isFinite(matchId)) {
            // 1) Obtener usuario actual (para consultar su fila en match_reads)
            const { data: authData } = await supabase.auth.getUser();
            const uid = authData?.user?.id as string | undefined;
            if (!uid) {
              // Sin sesión -> no podemos verificar lectura; mostrar
              return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
              } as any;
            }

            // 2) Leer last_read_at del usuario para el hilo
            const { data: readRow, error: readErr } = await supabase
              .from('match_reads')
              .select('last_read_at')
              .eq('match_id', matchId)
              .eq('user_id', uid)
              .maybeSingle();
            if (readErr) {
              // Ante error en red/permiso, preferimos mostrar para no perder alertas válidas
              return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
              } as any;
            }
            const lastReadAt = readRow?.last_read_at ? new Date(readRow.last_read_at) : null;

            // 3) Determinar created_at del mensaje
            let messageCreatedAt: Date | null = createdAtRaw ? new Date(createdAtRaw) : null;
            if (!messageCreatedAt && Number.isFinite(messageId)) {
              const { data: msg } = await supabase
                .from('messages')
                .select('created_at')
                .eq('id', messageId as number)
                .maybeSingle();
              if (msg?.created_at) messageCreatedAt = new Date(msg.created_at as string);
            }

            // 4) Si tenemos ambas fechas y el mensaje es anterior o igual a last_read_at, suprimir
            const isStale = !!(lastReadAt && messageCreatedAt && lastReadAt.getTime() >= messageCreatedAt.getTime());

            return {
              shouldShowAlert: !isStale,
              shouldPlaySound: !isStale,
              shouldSetBadge: !isStale,
              shouldShowBanner: !isStale,
              shouldShowList: !isStale,
            } as any;
          }
        }

        // Por defecto (otros tipos o sin datos suficientes): mostrar
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        } as any;
      } catch (e) {
        // En caso de error inesperado, no bloquear la notificación
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        } as any;
      }
    },
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
  let expoToken: string | null = null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } as any : undefined
    );
    expoToken = tokenData.data;
  } catch {
    return;
  }

  // 3) Canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 4) Guardar token por dispositivo en tabla dedicada (multi-dispositivo)
  // Tabla: public.push_tokens(user_id uuid, token text, platform text, updated_at timestamptz)
  try {
    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token: expoToken!, platform: Platform.OS as any })
      .throwOnError();
  } catch {
    return;
  }

  // 5) Alinear experiencia: si el usuario concedió permiso y guardamos token, auto opt-in en perfil
  try {
    await supabase
      .from('profiles')
      .update({ push_opt_in: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {}
}

export async function clearPushToken(userId: string) {
  // En logout, eliminar todos los tokens asociados al usuario (seguro si no guardamos el token localmente)
  await supabase.from('push_tokens').delete().eq('user_id', userId);
}
