import { useEffect, useMemo, useRef, useState } from 'react';

import { View, Text, Animated, Easing, StyleSheet, KeyboardAvoidingView, TouchableOpacity, BackHandler } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRedirectTo } from 'lib/oauthRedirect';
import { waitForSession } from 'lib/authDebug';
import { extractTokens } from 'lib/authUrl';

import { Ionicons } from '@expo/vector-icons';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, Button, Card } from 'components/ui';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { supabase } from 'lib/supabase';
import { applyPalette } from 'lib/theme';
import { useThemeMode } from 'lib/theme-context';

// Owner palette derives from theme via applyPalette('owner'); use theme tokens
// Glows/veil constants are available from OwnerBackground if needed later
const slides = [
  { title: 'Atrae nuevos clientes', body: 'Publica tus eventos o planes y deja que los usuarios te descubran.' },
  { title: 'Fácil y rápido', body: 'Configura tu local en menos de 5 minutos y empieza a disfrutar de los beneficios de Wispic.' },
  { title: 'Crece con datos reales', body: 'Entiende el impacto de tus eventos y toma mejores decisiones.' },
];

export default function OwnerWelcome() {
  const { theme } = useThemeMode();
  const [index, setIndex] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      // Fade + slide out to left
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(x, { toValue: -20, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setIndex((i: number) => (i + 1) % slides.length);
        x.setValue(20); // start slightly from right
        opacity.setValue(0);
        // Fade + slide in from right with accelerating ease
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(x, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start();
      });
    }, 5200); // más pausado
    return () => clearInterval(id);
  }, [opacity, x]);

  // Ensure hardware back goes directly to the sign-in screen; we DON'T change palette here
  useEffect(() => {
    const onBack = () => {
      try { router.replace('/(auth)/sign-in' as any); } catch {}
      return true; // prevent default
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  const s = slides[index];

  WebBrowser.maybeCompleteAuthSession();

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    try {
      try { await WebBrowser.warmUpAsync(); } catch {}
      const redirectTo = getRedirectTo();
      // Evita el flash: navega al callback con spinner antes de abrir navegador
      // Marca flujo como "owner" ANTES de navegar, para evitar condiciones de carrera
      try { await AsyncStorage.setItem('oauth_flow', 'owner'); } catch {}
      try { router.push('/auth/callback'); } catch {}
      let done = false;
      const sub = ExpoLinking.addEventListener('url', async ({ url }) => {
        if (done) return;
        try {
          await supabase.auth.exchangeCodeForSession(url);
          done = true;
          const ok = await waitForSession();
          if (!ok) {
            const { access_token, refresh_token } = extractTokens(url);
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
          // Asegura el marcado de intención de owner inmediatamente, sin depender del callback
          try {
            await supabase.auth.updateUser({ data: { owner: true } as any });
          } catch {}
          try { await AsyncStorage.removeItem('oauth_flow'); } catch {}
          router.replace('/');
        } catch {}
        finally { try { sub.remove(); } catch {} }
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (!done && res.type === 'success' && res.url) {
          try {
              await supabase.auth.exchangeCodeForSession(res.url);
            done = true;
              const ok2 = await waitForSession();
              if (!ok2) {
                const { access_token, refresh_token } = extractTokens(res.url);
                if (access_token && refresh_token) {
                  await supabase.auth.setSession({ access_token, refresh_token });
                }
              }
            // Asegura el marcado de intención de owner inmediatamente, sin depender del callback
            try {
              await supabase.auth.updateUser({ data: { owner: true } as any });
            } catch {}
            try { await AsyncStorage.removeItem('oauth_flow'); } catch {}
            router.replace('/');
            return;
          } catch {}
        }
      }
    } catch (e: any) {
      // noop
    } finally {
      try { await WebBrowser.coolDownAsync(); } catch {}
    }
  };

  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <OwnerBackground>
      <Screen style={{ padding: 0, gap: 0 }} edges={['top','bottom']}>
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={'padding'}>
  <CenterScaffold variant="minimal" paddedTop={0}>
          <View style={{ flex: 1 }}>
            {/* Glows moved to top-level to avoid width clipping */}

            <View style={styles.centerStack}>
            <H1 style={styles.title}>Bienvenido a Wispic for Locals</H1>

            <Animated.View style={[styles.slogansWrap, { opacity, transform: [{ translateX: x }] }]}>
              <Text style={styles.slideTitle}>{s.title}</Text>
              <Text style={styles.slideBody}>{s.body}</Text>
            </Animated.View>

            <P style={styles.ctaSubtitle}>¿A qué esperas? Únete a la comunidad Wispic</P>

            {/* Bubble with subtle blue glow background */}
            {(() => {
              return (
                <View style={styles.bubbleWrap}>
                  <LinearGradient
                    colors={theme.gradients.brandSoft as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bubbleGlow}
                    pointerEvents="none"
                  />
                  <Card style={styles.bubble}>
                    <H1 style={styles.bubbleTitle}>Crear cuenta</H1>
                    <View style={{ gap: 12 }}>
                      <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#fff' }]} activeOpacity={0.9} onPress={() => signInWithProvider('google')}>
                        <Ionicons name="logo-google" size={20} color="#111" />
                        <P style={styles.socialTextDark}>Continuar con Google</P>
                      </TouchableOpacity>

                      <View style={styles.dividerRow}>
                        <View style={styles.divider} />
                        <P style={styles.dividerText}>o</P>
                        <View style={styles.divider} />
                      </View>

                      <Button title={'Usar correo'} onPress={() => router.push('/(owner-auth)/sign-up?email=1' as any)} style={{ alignSelf: 'stretch' }} gradient />
                    </View>
                  </Card>
                </View>
              );
            })()}
            </View>
          </View>
        </CenterScaffold>
      </KeyboardAvoidingView>
  </Screen>
    </OwnerBackground>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  centerStack: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, gap: 14 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 0 },
  slogansWrap: { alignItems: 'center' },
  slideTitle: { color: theme.colors.primary, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  slideBody: { color: theme.colors.subtext, fontSize: 14, textAlign: 'center', marginTop: 4, marginHorizontal: 16, maxWidth: 520 },
  ctaSubtitle: { color: theme.colors.textDim, textAlign: 'center', marginTop: 4 },
  bubbleWrap: { width: '100%', maxWidth: 520, alignSelf: 'center', position: 'relative' },
  bubbleGlow: { position: 'absolute', left: -8, right: -8, top: -12, bottom: -12, borderRadius: 20, opacity: 0.9 },
  bubble: { width: '100%', maxWidth: 480 },
  bubbleTitle: { fontSize: 18, textAlign: 'center', marginBottom: 8 },
  socialBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.divider },
  socialTextDark: { color: '#111827', fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider },
  dividerText: { color: theme.colors.textDim },
});
