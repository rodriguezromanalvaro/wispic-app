import { useEffect, useMemo, useState } from 'react';
import { Alert, View, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, BackHandler, Modal } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen, Card, H1, P, TextInput, Button } from '../../components/ui';
import { OwnerBackground } from '../../components/OwnerBackground';
import { theme } from '../../lib/theme';
import { CenterScaffold } from '../../components/Scaffold';
import { Ionicons } from '@expo/vector-icons';

const BLUE_GRADIENT: [string, string] = ['#60A5FA', '#2563EB'];

export default function OwnerSignUp() {
  const router = useRouter();
  // Handle hardware back to go back to welcome
  useEffect(() => {
    const onBack = () => {
      try { router.replace('/(owner-auth)/welcome' as any); } catch {}
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingUp, setLoadingUp] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [existsOpen, setExistsOpen] = useState(false);

  const emailValid = useMemo(() => email.trim().includes('@'), [email]);
  const passwordRules = useMemo(() => ([
    { id: 'len', label: 'Al menos 8 caracteres', ok: password.length >= 8 },
    { id: 'upper', label: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { id: 'lower', label: 'Una minúscula', ok: /[a-z]/.test(password) },
    { id: 'digit', label: 'Un número', ok: /\d/.test(password) },
    { id: 'sym', label: 'Un símbolo', ok: /[^\w\s]/.test(password) },
  ]), [password]);
  const allRulesOk = useMemo(() => passwordRules.every(r => r.ok), [passwordRules]);
  const valid = emailValid && allRulesOk;
  const strength = useMemo(() => passwordRules.filter(r => r.ok).length / passwordRules.length, [passwordRules]);

  const gotoOwnerOnboarding = async () => {
    setMsg('Redirigiendo...');
    router.replace('/(owner-onboarding)/basic' as any);
  };

  const signUp = async () => {
    if (!emailValid) {
      return Alert.alert('Correo inválido');
    }
    if (!allRulesOk) {
      return Alert.alert('Contraseña inválida', 'Revisa los requisitos de seguridad.');
    }
    try {
      setLoadingUp(true);
      setMsg('Creando cuenta...');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setMsg('');
        const msg = (error as any)?.message?.toLowerCase?.() || '';
        if (msg.includes('already') || msg.includes('exists') || (error as any)?.status === 400) {
          setExistsOpen(true);
          return;
        }
        return Alert.alert('Error', error.message);
      }

      if (data.session) {
        setMsg('Sesión creada');
        await supabase.from('profiles').insert({
          id: data.session.user.id,
          display_name: 'Nuevo Dueño',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        // Marcar metadata de dueño para enrutar correctamente al onboarding de dueño
        try {
          await supabase.auth.updateUser({
            data: { role: 'owner', owner: true, owner_onboarded: false },
          });
        } catch {}
        return gotoOwnerOnboarding();
      }
    } finally {
      setLoadingUp(false);
    }
  };

  // OAuth options are offered on the welcome screen; this screen focuses on email

  return (
    <OwnerBackground>
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='minimal' paddedTop={60}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Image source={require('../../assets/adaptive-icon-foreground.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <View style={styles.center}>
              <H1 style={styles.title}>Crear cuenta de Local</H1>
              <P style={styles.subtitle}>Usa tu correo o tu cuenta de Google.</P>

              <Card style={styles.card}>
                  <P style={styles.label}>Correo</P>
                  <TextInput
                    placeholder="tu@email.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />

                  <P style={styles.label}>Contraseña</P>
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

                  {passwordTouched && (
                    <View style={{ marginTop: 6, marginBottom: 8 }}>
                      <P style={{ color: '#667085', fontSize: 12, marginBottom: 6 }}>Tu contraseña debe cumplir:</P>
                      <View style={styles.strengthBarBg}>
                        <View style={[styles.strengthBarFill, { width: `${Math.round(strength * 100)}%`, backgroundColor: strength < 0.4 ? '#F97066' : strength < 0.8 ? '#F7B267' : '#32D583' }]} />
                      </View>
                      <P style={styles.strengthText}>Fortaleza: {Math.round(strength * 100)}%</P>
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
                    title={loadingUp ? 'Creando cuenta…' : 'Crear cuenta'}
                    onPress={signUp}
                    disabled={!valid || loadingUp}
                    style={[(!valid || loadingUp) ? { borderWidth: 1, borderColor: theme.colors.border } : null]}
                    gradient
                    gradientColors={BLUE_GRADIENT}
                  />
                  {msg ? <P style={styles.message}>{msg}</P> : null}

                  <TouchableOpacity onPress={() => { try { router.replace('/(owner-auth)/welcome' as any); } catch {} }} style={{ alignSelf: 'center', marginTop: 8 }}>
                    <P style={{ color: '#2563EB' }}>Volver</P>
                  </TouchableOpacity>
                </Card>

              <P style={styles.terms}>
                Al continuar aceptas nuestros <P style={styles.termsLink}>Términos</P> y la <P style={styles.termsLink}>Política de privacidad</P>.
              </P>

              <View style={{ height: 8 }} />
              <P style={styles.haveAccount}>
                ¿Ya tienes cuenta? <Link href="/(auth)/sign-in" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>Inicia sesión</Link>
              </P>
            </View>
          </ScrollView>
          {/* Modal: cuenta existente (owner) */}
          <Modal visible={existsOpen} transparent animationType="fade" onRequestClose={() => setExistsOpen(false)}>
            <View style={styles.modalOverlay}>
              <Card style={styles.modalCard}>
                <H1 style={{ textAlign: 'center', marginBottom: 6 }}>¡Vaya!</H1>
                <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 2 }}>Parece que esa cuenta ya está registrada.</P>
                <P style={{ color: theme.colors.textDim, textAlign: 'center', marginBottom: 12 }}>Prueba a iniciar sesión o usa otro correo.</P>
                <View style={{ gap: 10 }}>
                  <Button title={'Iniciar sesión'} onPress={() => { setExistsOpen(false); try { router.replace('/(auth)/sign-in' as any); } catch {} }} gradient gradientColors={BLUE_GRADIENT} />
                  <Button title={'Usar otro correo'} onPress={() => setExistsOpen(false)} variant="outline" />
                </View>
              </Card>
            </View>
          </Modal>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
    </OwnerBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 12, marginTop: 20 },
  logo: { width: 112, height: 112 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  // Removed social sign-in UI from this screen to avoid duplication with welcome
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  label: { color: theme.colors.textDim, marginBottom: 6 },
  input: { marginBottom: theme.spacing(1.5) },
  strengthBarBg: { width: '100%', height: 8, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 999 },
  strengthText: { color: theme.colors.textDim, fontSize: 12, marginTop: 4 },
  eye: { position: 'absolute', right: 12, top: 14 },
  message: { marginTop: theme.spacing(1), color: theme.colors.text, textAlign: 'center' },
  terms: { color: theme.colors.subtext, fontSize: 12, textAlign: 'center', marginTop: 8 },
  termsLink: { color: '#2563EB', textDecorationLine: 'underline' },
  haveAccount: { color: theme.colors.textDim, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
