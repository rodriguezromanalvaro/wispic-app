import { useEffect, useMemo, useState } from 'react';
import { Alert, View, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, BackHandler, Modal } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen, Card, H1, P, TextInput, Button } from '../../components/ui';
import { theme } from '../../lib/theme';
import { CenterScaffold } from '../../components/Scaffold';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTranslation } from 'react-i18next';

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingUp, setLoadingUp] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [existsOpen, setExistsOpen] = useState(false);

  const emailValid = useMemo(() => email.trim().includes('@'), [email]);
  const passwordRules = useMemo(() => ([
    { id: 'len', label: t('rules.len'), ok: password.length >= 8 },
    { id: 'upper', label: t('rules.upper'), ok: /[A-Z]/.test(password) },
    { id: 'lower', label: t('rules.lower'), ok: /[a-z]/.test(password) },
    { id: 'digit', label: t('rules.digit'), ok: /\d/.test(password) },
    { id: 'sym', label: t('rules.sym'), ok: /[^\w\s]/.test(password) },
  ]), [password, t]);
  const allRulesOk = useMemo(() => passwordRules.every(r => r.ok), [passwordRules]);
  const valid = emailValid && allRulesOk;
  const strength = useMemo(() => passwordRules.filter(r => r.ok).length / passwordRules.length, [passwordRules]);

  // Hardware back should respect previous screen
  useEffect(() => {
    const onBack = () => { try { router.back(); } catch {} return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  const gotoHome = async () => {
    setMsg(t('auth.redirecting'));
    router.replace('/');
  };

  const signUp = async () => {
    if (!emailValid) {
      return Alert.alert(t('auth.invalidEmail'));
    }
    if (!allRulesOk) {
      return Alert.alert(t('auth.invalidPassword'), t('auth.passwordRulesIntro'));
    }
    try {
      setLoadingUp(true);
      setMsg(t('auth.creatingAccount'));

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setMsg('');
        const msg = (error as any)?.message?.toLowerCase?.() || '';
        if (msg.includes('already') || msg.includes('exists') || (error as any)?.status === 400) {
          // Mostrar modal simpático en vez de alerta "cutre"
          setExistsOpen(true);
          return;
        }
        return Alert.alert('Error', error.message);
      }

      if (data.session) {
        setMsg(t('auth.createdSession'));
        await supabase.from('profiles').insert({
          id: data.session.user.id,
          display_name: 'Nuevo Usuario',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return gotoHome();
      }
    } finally {
      setLoadingUp(false);
    }
  };

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    try {
  setMsg(t('auth.redirecting'));
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'wispic', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      });
      if (error) throw error;
      // Supabase manejará el deep link y la sesión.
    } catch (e: any) {
      Alert.alert('OAuth', e.message || '');
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
          <H1 style={styles.title}>{t('auth.signUpTitle')}</H1>
          <P style={styles.subtitle}>{t('auth.signUpSubtitle')}</P>

          {/* Social buttons */}
          {!showEmailForm && (
            <View style={{ width: '100%', gap: 12 }}>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#fff' }]} activeOpacity={0.9} onPress={() => signInWithProvider('google')}>
                <Ionicons name="logo-google" size={20} color="#111" />
                <P style={styles.socialTextDark}>Continuar con Google</P>
              </TouchableOpacity>

              {/* Apple Sign-In deshabilitado por ahora */}

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <P style={styles.dividerText}>o</P>
                <View style={styles.divider} />
              </View>

              <Button title={t('auth.useEmail')} onPress={() => setShowEmailForm(true)} style={styles.ctaEmail} />
            </View>
          )}

          {/* Email form */}
          {showEmailForm && (
            <Card style={styles.card}>
              <P style={styles.label}>{t('auth.email')}</P>
              <TextInput
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />

              <P style={styles.label}>{t('auth.passwordLabel')}</P>
              <View style={{ position: 'relative' }}>
                <TextInput
                  placeholder="••••••••"
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (!passwordTouched) setPasswordTouched(true); }}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { paddingRight: 44 }]}
                />
                <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((s) => !s)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7A8699" />
                </TouchableOpacity>
              </View>

              {/* Password strength meter and rules */}
              {passwordTouched && (
                <View style={{ marginTop: 6, marginBottom: 8 }}>
                  <P style={{ color: '#667085', fontSize: 12, marginBottom: 6 }}>{t('auth.passwordRulesIntro')}</P>
                  <View style={styles.strengthBarBg}>
                    <View style={[styles.strengthBarFill, { width: `${Math.round(strength * 100)}%`, backgroundColor: strength < 0.4 ? '#F97066' : strength < 0.8 ? '#F7B267' : '#32D583' }]} />
                  </View>
                  <P style={styles.strengthText}>{t('auth.passwordStrength')}: {Math.round(strength * 100)}%</P>
                  <View style={{ marginTop: 6 }}>
                    {passwordRules.map(rule => (
                      <View key={rule.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Ionicons name={rule.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={rule.ok ? '#32D583' : '#98A2B3'} />
                        <P style={{ color: rule.ok ? '#111827' : '#667085' }}>{rule.label}</P>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Button
                title={loadingUp ? t('auth.creatingAccount') : t('auth.createAccount')}
                onPress={signUp}
                disabled={!valid || loadingUp}
                style={styles.button}
              />
              {msg ? <P style={styles.message}>{msg}</P> : null}

              <TouchableOpacity onPress={() => setShowEmailForm(false)} style={{ alignSelf: 'center', marginTop: 8 }}>
                <P style={{ color: theme.colors.primary }}>{t('auth.back')}</P>
              </TouchableOpacity>
            </Card>
          )}

          <P style={styles.terms}>
            {t('auth.terms1')}<P style={styles.termsLink}>{t('auth.terms2')}</P> y <P style={styles.termsLink}>{t('auth.privacy')}</P>.
          </P>

          <View style={{ height: 8 }} />
          <P style={styles.haveAccount}>
            {t('auth.haveAccount')}<Link href="/(auth)/sign-in" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>{t('auth.login')}</Link>
          </P>
        </View>
          </ScrollView>
          {/* Modal: cuenta existente */}
          <Modal visible={existsOpen} transparent animationType="fade" onRequestClose={() => setExistsOpen(false)}>
            <View style={styles.modalOverlay}>
              <Card style={styles.modalCard}>
                <H1 style={{ textAlign: 'center', marginBottom: 6 }}>¡Vaya!</H1>
                <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 2 }}>Parece que esa cuenta ya está registrada.</P>
                <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 12 }}>Prueba a iniciar sesión o usa otro correo.</P>
                <View style={{ gap: 10 }}>
                  <Button title={'Iniciar sesión'} onPress={() => { setExistsOpen(false); try { router.replace('/(auth)/sign-in' as any); } catch {} }} style={styles.button} />
                  <Button title={'Usar otro correo'} onPress={() => setExistsOpen(false)} variant="outline" />
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
    marginTop: 20,
  },
  logo: {
    width: 112,
    height: 112,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.subtext,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  socialBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.divider,
  },
  dividerText: {
    color: theme.colors.textDim,
  },
  ctaEmail: {
    backgroundColor: theme.colors.primary,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  input: {
    marginBottom: theme.spacing(1.5),
  },
  strengthBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  strengthText: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginTop: 4,
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
  terms: {
    color: theme.colors.subtext,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  termsLink: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  haveAccount: {
    color: theme.colors.textDim,
    textAlign: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});