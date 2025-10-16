import { useState } from 'react';
import { Alert, View, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
// Removemos la dependencia de los helpers
import { Screen, Card, H1, P, TextInput, Button } from '../../components/ui';
import { theme } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { CenterScaffold } from '../../components/Scaffold';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTranslation } from 'react-i18next';

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const router = useRouter();
  const { t } = useTranslation();
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
      setMsg(t('auth.redirecting'));
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'wispic', path: 'auth/callback' });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: false },
      });
      if (error) throw error;
      // Supabase manejará el deep link y la sesión.
    } catch (e: any) {
      setMsg('');
      Alert.alert('OAuth', e.message || '');
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

      // Verificar que el perfil exista
      const userId = data.user?.id;
      if (!userId) {
        setMsg('');
        return Alert.alert('Error', 'No se pudo obtener el ID del usuario.');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!profileData) {
        setMsg('');
        await supabase.from('profiles').insert({
          id: userId,
          display_name: 'Nuevo Usuario',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      if (profileError) {
        setMsg('');
        return Alert.alert('Error al verificar el perfil', profileError.message);
      }

      setMsg('');
      return gotoHome();
    } finally {
      setLoadingIn(false);
    }
  };

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='auth' paddedTop={60}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Branding */}
        <View style={styles.header}>
          <Image source={require('../../assets/adaptive-icon-foreground.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.center}>
          <H1 style={styles.title}>{t('auth.signInTitle')}</H1>
          <P style={styles.subtitle}>{t('auth.signInSubtitle')}</P>

          <Card style={styles.card}>
            <P style={styles.label}>{t('auth.email')}</P>
            <TextInput
              placeholder="tu@email.com"
              value={email}
              onChangeText={(t) => { setEmail(t); if (!emailTouched) setEmailTouched(true); }}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, emailTouched && emailError ? styles.inputError : null]}
            />
            {emailError ? <P style={styles.errorText}>{emailError}</P> : null}

            <P style={styles.label}>{t('auth.passwordLabel')}</P>
            <View style={{ position: 'relative' }}>
              <TextInput
                placeholder="••••••••"
                value={password}
                onChangeText={(t) => { setPassword(t); if (!passwordTouched) setPasswordTouched(true); }}
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 44 }, passwordTouched && passwordError ? styles.inputError : null]}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((s) => !s)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7A8699" />
              </TouchableOpacity>
            </View>
            {passwordError ? <P style={styles.errorText}>{passwordError}</P> : null}

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

            {/* Owner callout: posición original (debajo de crear cuenta), color acento propio */}
            <View style={{ height: 8 }} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Registra tu local"
              onPress={() => router.push('/(owner-auth)/welcome' as any)}
              activeOpacity={0.92}
            >
              <LinearGradient
                // Azul destacado, fuera de la paleta coral para diferenciar
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
          </Card>
        </View>
          </ScrollView>
          {/* Modal: error de autenticación */}
          <Modal visible={authErrorOpen} transparent animationType="fade" onRequestClose={() => setAuthErrorOpen(false)}>
            <View style={styles.modalOverlay}>
              <Card style={styles.modalCard}>
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
              </Card>
            </View>
          </Modal>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
