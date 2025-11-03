import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from 'lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitForSession } from 'lib/authDebug';
import { extractTokens } from 'lib/authUrl';

// Silent handler for the OAuth deep link: exchange code for session and redirect.
export default function AuthCallback() {
  const router = useRouter();
  // Parámetros actuales de la ruta (code, state, etc.)
  const params = useLocalSearchParams();
  // Última URL recibida por el sistema (en frío o si la app estaba en background)
  const currentUrl = Linking.useURL();
  // Internal state removed from UI; kept only for future diagnostics if needed
  const [status, setStatus] = useState<'idle' | 'exchanging' | 'ok' | 'no-token' | 'error'>('idle');
  const [detail, setDetail] = useState<string>('');

  // Reconstruye una URL válida para exchange si no hay currentUrl
  const reconstructedUrl = useMemo(() => {
    const entries = Object.entries(params ?? {}) as Array<[string, string | string[]]>;
    if (!entries.length) return null;
    const qp: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (Array.isArray(v)) qp[k] = v[0] ?? '';
      else if (v != null) qp[k] = String(v);
    }
    try {
      // Crea una deep link URL con el esquema de la app (wispic://auth/callback?code=...&state=...)
      return Linking.createURL('/auth/callback', { queryParams: qp });
    } catch {
      return null;
    }
  }, [params]);

  useEffect(() => {
    let mounted = true;
    let timeout: any;
    (async () => {
      setStatus('exchanging');
      const urlToUse = currentUrl || reconstructedUrl;

      // Sin URL aún: quizá ya hay sesión porque la gestionó otra pantalla (listener)
      if (!urlToUse) {
        try {
          const { data: s } = await supabase.auth.getSession();
          if (s?.session) {
            try {
              const flow = await AsyncStorage.getItem('oauth_flow');
              if (flow === 'owner') {
                await supabase.auth.updateUser({ data: { owner: true } } as any);
              }
              await AsyncStorage.removeItem('oauth_flow');
            } catch {}
            setStatus('ok');
            if (mounted) router.replace('/');
            return;
          }
        } catch {}
        // Aún no hay URL ni sesión -> espera el deep link con un timeout de seguridad
        timeout = setTimeout(() => {
          if (!mounted) return;
          setStatus('no-token');
          router.replace('/');
        }, 60_000);
        return;
      }

      // Hay URL: intenta exchange
      const lower = urlToUse.toLowerCase();
      const hasCode = lower.includes('code=');
      const hasAccess = lower.includes('access_token=');
      if (!hasCode && !hasAccess) {
        setStatus('no-token');
        setDetail('URL sin code/access_token');
        return;
      }
      try {
        await supabase.auth.exchangeCodeForSession(urlToUse);
        const ok = await waitForSession();
        if (!ok) {
          const { access_token, refresh_token } = extractTokens(urlToUse);
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
        // Si el flujo se inició desde owner, marca metadata para forzar el gate a owner-onboarding
        try {
          const flow = await AsyncStorage.getItem('oauth_flow');
          if (flow === 'owner') {
            await supabase.auth.updateUser({ data: { owner: true } } as any);
          }
          await AsyncStorage.removeItem('oauth_flow');
        } catch {}
        setStatus('ok');
        if (mounted) router.replace('/');
      } catch (e: any) {
        setStatus('error');
        setDetail(e?.message || 'exchange failed');
        if (mounted) router.replace('/');
      }
    })();

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [router, currentUrl, reconstructedUrl]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
