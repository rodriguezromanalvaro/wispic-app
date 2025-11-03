import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

/**
 * Dev/prod-safe redirect URI for Supabase OAuth.
 * - Expo Go: use AuthSession.makeRedirectUri() (exp:// or https://auth.expo.dev scheme)
 * - Native dev client / standalone: use app scheme (wispic://auth/callback)
 * - Web: use origin-based path (/auth/callback)
 */
export function getRedirectTo(): string {
  if (Platform.OS === 'web') {
    try {
      // @ts-ignore window available on web
      const origin = window.location.origin as string;
      return `${origin}/auth/callback`;
    } catch {
      return '/auth/callback';
    }
  }

  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    // En Expo Go usa el proxy de AuthSession para tener una URL estable (https://auth.expo.dev)
    // Añádela en Supabase (Auth → Providers → Additional Redirect URLs):
    //   https://auth.expo.dev/@arodrom/wispic-app
    return 'https://auth.expo.dev/@arodrom/wispic-app';
  }

  // Dev client o app nativa: usa el esquema exacto registrado (evita triple barra)
  return 'wispic://auth/callback';
}
