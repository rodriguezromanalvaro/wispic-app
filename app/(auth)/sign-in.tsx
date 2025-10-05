import { useState } from 'react';
import { Alert, View, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
// Removemos la dependencia de los helpers
import { Screen, Card, H1, P, TextInput, Button } from '../../components/ui';
import { theme } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { CenterScaffold } from '../../components/Scaffold';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function SignIn() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Navegación a registro moderno
  const goToSignUp = () => router.push('/(auth)/sign-up');
  const [loadingIn, setLoadingIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [resetting, setResetting] = useState(false);

  const valid = email.trim().includes('@') && password.trim().length >= 6;
  const emailError = emailTouched && !email.trim().includes('@') ? t('auth.invalidEmail') : '';
  const passwordError = passwordTouched && password.trim().length < 6 ? t('auth.invalidPassword') : '';

  const gotoHome = async () => {
    setMsg(t('auth.redirecting'));
    router.replace('/'); // index decide a dónde
  };

  // Registro ahora se realiza en la pantalla moderna

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
        return Alert.alert(
          t('auth.login'),
          t('auth.invalidPassword'),
          [
            { text: 'OK', style: 'cancel' },
            { text: t('auth.createAccount'), onPress: goToSignUp },
          ]
        );
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
          <Image source={require('../../assets/logotype.png')} style={styles.logo} resizeMode="contain" />
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
            <View style={{ height: 16 }} />
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <P style={styles.dividerText}>{t('auth.continueWith')}</P>
              <View style={styles.divider} />
            </View>

            <View style={{ width: '100%', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#fff' }]} activeOpacity={0.9} onPress={() => Alert.alert('Info', t('auth.google')) }>
                <Ionicons name="logo-google" size={20} color="#111" />
                <P style={styles.socialTextDark}>{t('auth.google')}</P>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#000' }]} activeOpacity={0.9} onPress={() => Alert.alert('Info', t('auth.apple')) }>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <P style={styles.socialTextLight}>{t('auth.apple')}</P>
              </TouchableOpacity>
            </View>

            <View style={{ height: 16 }} />
            <P style={styles.haveAccount}>
              {t('auth.noAccount')}<Link href="/(auth)/sign-up" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>{t('auth.createAccount')}</Link>
            </P>
          </Card>
        </View>
          </ScrollView>
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
    marginBottom: 16,
  },
  logo: {
    width: 160,
    height: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#D0D5DD',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  label: {
    color: '#E6EAF2',
    marginBottom: 6,
  },
  input: {
    marginBottom: theme.spacing(1.5),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#475467',
  },
  dividerText: {
    color: '#98A2B3',
  },
  socialBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    top: 14,
  },
  button: {
    backgroundColor: theme.colors.primary,
  },
  message: {
    marginTop: theme.spacing(1),
    color: theme.colors.text,
    textAlign: 'center',
  },
  errorText: {
    color: '#F97066',
    marginTop: -8,
    marginBottom: 8,
    fontSize: 12,
  },
  haveAccount: {
    color: '#667085',
    textAlign: 'center',
  },
});
