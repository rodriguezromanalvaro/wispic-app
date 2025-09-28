import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen, Card, H1, P, TextInput, Button } from '../../components/ui';
import { theme } from '../../lib/theme';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingUp, setLoadingUp] = useState(false);
  const [loadingIn, setLoadingIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const valid = email.trim().includes('@') && password.trim().length >= 6;

  const gotoHome = async () => {
    setMsg('Redirigiendo…');
    router.replace('/'); // index decide a dónde
  };

  const signUp = async () => {
    if (!valid) return Alert.alert('Completa email y contraseña (mín. 6)');
    try {
      setLoadingUp(true);
      setMsg('Creando cuenta…');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        setMsg(`SignUp error: ${error.message}`);
        return Alert.alert('Error al registrarte', error.message);
      }
      if (data.session) {
        setMsg('Cuenta creada y sesión iniciada. Entrando…');
        return gotoHome();
      }
      setMsg('Cuenta creada. Intentando iniciar sesión…');
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (loginErr) {
        setMsg(`Login tras registro falló: ${loginErr.message}`);
        return Alert.alert('No se pudo iniciar sesión', loginErr.message);
      }
      setMsg('Login correcto tras registro. Entrando…');
      return gotoHome();
    } finally {
      setLoadingUp(false);
    }
  };

  const signIn = async () => {
    if (!valid) return Alert.alert('Completa email y contraseña (mín. 6)');
    try {
      setLoadingIn(true);
      setMsg('Iniciando sesión…');
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        setMsg(`SignIn error: ${error.message}`);
        return Alert.alert('Error al entrar', error.message);
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setMsg('No se recibió sesión tras login (¿confirmación de email activa?).');
        return Alert.alert('No hay sesión', 'Revisa la configuración de Auth en Supabase.');
      }
      setMsg('Login correcto. Entrando…');
      return gotoHome();
    } finally {
      setLoadingIn(false);
    }
  };

  return (
    <Screen>
      <View style={{ height: theme.spacing(1) }} />
      <H1>Wispic</H1>
      <P>Entra o crea cuenta con email y contraseña</P>

      <Card style={{ gap: theme.spacing(1.5) }}>
        <P>Email</P>
        <TextInput
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <P>Contraseña (mín. 6)</P>
        <TextInput
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={{ height: theme.spacing(1) }} />

        <Button title={loadingIn ? 'Entrando…' : 'Entrar'} onPress={signIn} disabled={!valid || loadingIn} />
        <Button title={loadingUp ? 'Creando cuenta…' : 'Crear cuenta'} onPress={signUp} disabled={!valid || loadingUp} variant="ghost" />
        {msg ? <P style={{ marginTop: theme.spacing(1) }}>{msg}</P> : null}
      </Card>
    </Screen>
  );
}
