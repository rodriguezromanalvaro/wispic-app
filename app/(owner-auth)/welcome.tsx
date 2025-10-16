import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Dimensions, BackHandler } from 'react-native';
import { Screen, H1, P, Button, Card } from '../../components/ui';
import { CenterScaffold } from '../../components/Scaffold';
import { router } from 'expo-router';
import { theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerBackground, OWNER_BLUE_GRADIENT, OWNER_BLUE_SOFT, OWNER_GLOW_TOP, OWNER_GLOW_BOTTOM, OWNER_BLUE_VEIL } from '../../components/OwnerBackground';

const BLUE = '#3B82F6';
const BLUE_GRADIENT = OWNER_BLUE_GRADIENT; // azul claro -> azul intenso
const BLUE_SOFT = OWNER_BLUE_SOFT;
const GLOW_TOP = OWNER_GLOW_TOP;
const GLOW_BOTTOM = OWNER_GLOW_BOTTOM;
const BLUE_VEIL = OWNER_BLUE_VEIL;
const slides = [
  { title: 'Atrae nuevos clientes', body: 'Publica tus eventos o planes y deja que los usuarios te descubran.' },
  { title: 'Fácil y rápido', body: 'Configura tu local en menos de 5 minutos y empieza a disfrutar de los beneficios de Wispic.' },
  { title: 'Crece con datos reales', body: 'Entiende el impacto de tus eventos y toma mejores decisiones.' },
];

export default function OwnerWelcome() {
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

  // Ensure hardware back goes directly to the sign-in screen without flicker
  useEffect(() => {
    const onBack = () => {
      try {
        // Replace directly to sign-in to avoid intermediate screen flash
        router.replace('/(auth)/sign-in' as any);
      } catch {}
      return true; // prevent default
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  const s = slides[index];

  WebBrowser.maybeCompleteAuthSession();

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    try {
      const redirectTo = 'wispic://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      });
      if (error) throw error;
    } catch (e: any) {
      console.log('OAuth error', e?.message);
    }
  };

  return (
    <OwnerBackground>
      <Screen style={{ padding: 0, gap: 0 }} edges={['top','bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                    colors={BLUE_SOFT}
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

                      <Button title={'Usar correo'} onPress={() => router.push('/(owner-auth)/sign-up?email=1' as any)} style={{ alignSelf: 'stretch' }} gradient gradientColors={BLUE_GRADIENT} />
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

const styles = StyleSheet.create({
  centerStack: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, gap: 14 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 0 },
  slogansWrap: { alignItems: 'center' },
  slideTitle: { color: BLUE, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 4 },
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
