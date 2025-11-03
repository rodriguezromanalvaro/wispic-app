import { useEffect, useMemo, useState } from 'react';

import { Alert, View, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';

import * as AuthSession from 'expo-auth-session';
import * as ExpoLinking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, TextInput, Button } from 'components/ui';
import { supabase } from 'lib/supabase';
// Removemos la dependencia de los helpers
import { useThemeMode } from 'lib/theme-context';
import { applyPalette } from 'lib/theme';
import { getRedirectTo } from 'lib/oauthRedirect';
import { waitForSession } from 'lib/authDebug';
import { extractTokens } from 'lib/authUrl';




WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  // Eliminados logs de mount/unmount/render
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useThemeMode();
  // Hard-guard: auth screen must always be MAGENTA
  useEffect(() => { try { applyPalette('magenta'); } catch {} }, []);
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [email, setEmail] = useState(() => (Array.isArray(params.email) ? params.email[0] : params.email) || '');
  const [password, setPassword] = useState('');
  // Navegación a registro moderno
  const goToSignUp = () => router.push('/(auth)/sign-up');
  const [loadingIn, setLoadingIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [authErrorOpen, setAuthErrorOpen] = useState(false);

  const valid = email.trim().includes('@') && password.trim().length >= 6;
  const emailError = emailTouched && !email.trim().includes('@') ? t('auth.invalidEmail') : '';
  const passwordError = passwordTouched && password.trim().length < 6 ? t('auth.invalidPassword') : '';

  const gotoHome = async () => {
    setMsg(t('auth.redirecting'));
    router.replace('/'); // index decide a dónde
  };

  // Registro ahora se realiza en la pantalla moderna

  const signInWithGoogle = async () => {
    try {
      setMsg('Abriendo Google…');
      try { await WebBrowser.warmUpAsync(); } catch {}
      // Construye el deep link correcto según el entorno (Expo Go, dev client o app)
      const redirectTo = getRedirectTo();

  // Evita el "flash" de la pantalla de login al volver del navegador mostrando el spinner del callback
  try { router.push('/auth/callback'); } catch {}
  // Asegura que no quede marcado un flujo previo de owner
  try { await AsyncStorage.removeItem('oauth_flow'); } catch {}

      // Suscripción de respaldo: si el navegador no retorna con type 'success',
      // capturamos el deep link vía evento y hacemos el exchange igualmente.
      let done = false;
      const sub = ExpoLinking.addEventListener('url', async ({ url }) => {
        if (done) return;
        try {
          await supabase.auth.exchangeCodeForSession(url);
          done = true;
          // Espera a que la sesión esté disponible para evitar que el Gate te devuelva a sign-in
          const ok = await waitForSession();
          if (!ok) {
            const { access_token, refresh_token } = extractTokens(url);
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
          router.replace('/');
        } catch (e: any) {
          Alert.alert('OAuth', e?.message || String(e));
        } finally {
          try { sub.remove(); } catch {}
        }
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (!done && res.type === 'success' && res.url) {
          try {
            await supabase.auth.exchangeCodeForSession(res.url);
            done = true;
            setMsg('');
            const ok2 = await waitForSession();
            if (!ok2) {
              const { access_token, refresh_token } = extractTokens(res.url);
              if (access_token && refresh_token) {
                await supabase.auth.setSession({ access_token, refresh_token });
              }
            }
            router.replace('/');
            return;
          } catch (e) {
            // caerá al listener si llega por evento
          }
        }
      }
      // El deep link cerrará el browser y volverá a la app; Supabase resolverá la sesión.
    } catch (e: any) {
      setMsg('');
      Alert.alert('OAuth', e.message || '');
    } finally {
      try { await WebBrowser.coolDownAsync(); } catch {}
    }
  };

  const signIn = async () => {
    if (!valid) return Alert.alert(t('auth.invalidEmail'), t('auth.invalidPassword'));
    try {
      setLoadingIn(true);
      setMsg('');

      // Intentar iniciar sesión
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setMsg('');
        // Mostrar modal amigable en lugar de alerta
        setAuthErrorOpen(true);
        return;
      }

      // El perfil se crea automáticamente en Supabase mediante trigger; no insertamos aquí

      setMsg('');
      return gotoHome();
    } finally {
      setLoadingIn(false);
    }
  };

  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <CenterScaffold variant='auth' paddedTop={60}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
          >
        {/* Branding */}
        <View style={styles.header}>
          <Image source={require('../../assets/adaptive-icon-foreground.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.center}>
          <H1 style={styles.title}>{t('auth.signInTitle')}</H1>
          <P style={styles.subtitle}>{t('auth.signInSubtitle')}</P>

          <GlassCard padding={16} elevationLevel={1} style={styles.card}
          >
            <P style={styles.label}>{t('auth.email')}</P>
            <TextInput
              key="email-input"
              placeholder="tu@email.com"
              value={email}
              onChangeText={(t) => { setEmail(t); if (!emailTouched) setEmailTouched(true); }}
              autoCapitalize="none"
              keyboardType="email-address"
              debugId="signIn-email"
              style={[styles.input, emailTouched && emailError ? styles.inputError : null]}
            />
            <P style={styles.errorText}>{emailTouched ? (emailError || ' ') : ' '}</P>

            <P style={styles.label}>{t('auth.passwordLabel')}</P>
            <View style={{ position: 'relative' }}>
              <TextInput
                key="password-input"
                placeholder="••••••••"
                value={password}
                onChangeText={(t) => { setPassword(t); if (!passwordTouched) setPasswordTouched(true); }}
                secureTextEntry={!showPassword}
                debugId="signIn-password"
                style={[styles.input, { paddingRight: 44 }, passwordTouched && passwordError ? styles.inputError : null]}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((s) => !s)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7A8699" />
              </TouchableOpacity>
            </View>
            <P style={styles.errorText}>{passwordTouched ? (passwordError || ' ') : ' '}</P>

            <TouchableOpacity
              onPress={async () => {
                if (!email.trim().includes('@')) {
                  setEmailTouched(true);
                  Alert.alert(t('auth.invalidEmail'));
                  return;
                }
                try {
                  setResetting(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
                  if (error) throw error;
                  Alert.alert('OK', '');
                } catch (e: any) {
                  Alert.alert('Error', e.message || '');
                } finally {
                  setResetting(false);
                }
              }}
              style={{ alignSelf: 'flex-end', marginBottom: 8 }}
              disabled={resetting}
            >
              <P style={{ color: theme.colors.primary }}>{resetting ? t('auth.redirecting') : t('auth.forgotPassword')}</P>
            </TouchableOpacity>

            <Button
              title={loadingIn ? t('auth.redirecting') : t('auth.enter')}
              onPress={signIn}
              disabled={!valid || loadingIn}
              style={styles.button}
            />
            {msg ? <P style={styles.message}>{msg}</P> : null}

            {/* Divider + Social buttons */}
            <View style={{ height: 8 }} />
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <P style={styles.dividerText}>{t('auth.continueWith')}</P>
              <View style={styles.divider} />
            </View>

            <View style={{ width: '100%', gap: 8, marginTop: 6 }}>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#fff' }]} activeOpacity={0.9} onPress={signInWithGoogle}>
                <Ionicons name="logo-google" size={20} color="#111" />
                <P style={styles.socialTextDark}>{t('auth.google')}</P>
              </TouchableOpacity>
            </View>

            <View style={{ height: 8 }} />
            <P style={styles.haveAccount}>
              {t('auth.noAccount')}<Link href="/(auth)/sign-up" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>{t('auth.createAccount')}</Link>
            </P>

            {/* Owner callout: acento AZUL específico para destacar flujo de locales */}
            <View style={{ height: 8 }} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Registra tu local"
              onPress={() => router.push('/(owner-auth)/welcome' as any)}
              activeOpacity={0.92}
            >
              <LinearGradient
                // Azul suave y no invasivo
                colors={[
                  'rgba(59,130,246,0.16)', // blue-500 @ 16%
                  'rgba(59,130,246,0.06)', // blue-500 @ 6%
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderWidth: 1,
                  borderColor: '#BFDBFE', // blue-200
                  borderRadius: 12,
                  padding: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: '#3B82F6', // blue-500
                  backgroundColor: 'rgba(59,130,246,0.04)'
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="musical-notes-outline" size={20} color={'#3B82F6'} />
                  <View style={{ flex: 1 }}>
                          <P style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>¿Tienes un local?</P>
                          <P style={{ color: theme.colors.textDim, fontSize: 12 }}>Registra tu local y publica eventos</P>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </GlassCard>
        </View>
          </ScrollView>
          {/* Modal: error de autenticación */}
          <Modal visible={authErrorOpen} transparent animationType="fade" onRequestClose={() => setAuthErrorOpen(false)}>
            <View style={styles.modalOverlay}>
              <GlassCard padding={16} elevationLevel={2} style={styles.modalCard}>
                <H1 style={{ textAlign: 'center', marginBottom: 6 }}>Ups…</H1>
                      <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 2 }}>No hemos podido iniciar sesión con esos datos.</P>
                      <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 12 }}>Revisa tu correo y contraseña o crea una cuenta nueva.</P>
                <View style={{ gap: 10 }}>
                  <Button title={t('auth.createAccount')} onPress={() => { setAuthErrorOpen(false); goToSignUp(); }} style={styles.button} />
                  <Button title={t('auth.forgotPassword')} onPress={async () => {
                    if (!email.trim().includes('@')) {
                      setAuthErrorOpen(false);
                      setEmailTouched(true);
                      Alert.alert(t('auth.invalidEmail'));
                      return;
                    }
                    try {
                      setAuthErrorOpen(false);
                      setResetting(true);
                      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
                      if (error) throw error;
                      Alert.alert('OK', 'Te hemos enviado un enlace para restablecer tu contraseña.');
                    } catch (e: any) {
                      Alert.alert('Error', e.message || '');
                    } finally {
                      setResetting(false);
                    }
                  }} variant="outline" />
                  <Button title={'Volver a intentarlo'} onPress={() => setAuthErrorOpen(false)} variant="outline" />
                </View>
              </GlassCard>
            </View>
          </Modal>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

      const makeStyles = (theme: any) => StyleSheet.create({
        gradient: {},
        scroll: {
          flexGrow: 1,
        },
        header: {
          alignItems: 'center',
          marginBottom: 12,
        },
        logo: {
          width: 112,
          height: 112,
          marginTop: 8,
        },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        },
        title: {
          color: theme.colors.text,
          fontSize: 26,
          fontWeight: '800',
          textAlign: 'center',
        },
        subtitle: {
          color: theme.colors.subtext,
          fontSize: 14,
          textAlign: 'center',
          marginHorizontal: 12,
          marginBottom: 4,
        },
        card: {
          width: '100%',
          maxWidth: 420,
          padding: theme.spacing(1.5),
          borderRadius: 14,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        label: {
          color: theme.colors.textDim,
          marginBottom: 4,
        },
        input: {
          marginBottom: theme.spacing(1),
        },
        dividerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        divider: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.divider,
        },
        dividerText: {
          color: theme.colors.textDim,
        },
        socialBtn: {
          height: 44,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        socialTextDark: {
          color: '#111827',
          fontWeight: '600',
        },
        socialTextLight: {
          color: '#fff',
          fontWeight: '600',
        },
        inputError: {
          borderColor: '#F97066',
          borderWidth: 1,
        },
        eye: {
          position: 'absolute',
          right: 12,
          top: 12,
        },
        button: {
          backgroundColor: theme.colors.primary,
        },
        message: {
          marginTop: theme.spacing(0.5),
          color: theme.colors.text,
          textAlign: 'center',
        },
        errorText: {
          color: '#F97066',
          marginTop: -6,
          marginBottom: 6,
          fontSize: 11,
        },
        haveAccount: {
          color: theme.colors.textDim,
          textAlign: 'center',
        },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
        modalCard: { width: '100%', maxWidth: 420, padding: theme.spacing(1.5), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
      });
