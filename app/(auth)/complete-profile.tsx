import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/useAuth';
import { Screen, Card, TextInput, Button, H1, P } from '../../components/ui';
import { theme } from '../../lib/theme';

export default function CompleteProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!data) {
        // Si no hay perfil aún, muestra el aviso de “cuenta creada”
        Alert.alert('Cuenta creada', '¡Tu cuenta se creó con éxito! Ahora rellena tu perfil para continuar.');
      } else {
        setName(data.display_name || '');
        setBio(data.bio || '');
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const payload = { id: user.id, display_name: name.trim(), bio: bio.trim() };
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) return Alert.alert('Error', error.message);
    Alert.alert('Hecho', 'Perfil guardado');
    router.replace('/(tabs)/events');
  };

  return (
    <Screen>
      <Card style={{ gap: theme.spacing(1.5) }}>
        <H1>Completa tu perfil</H1>
        <P>Tu nombre visible</P>
        <TextInput value={name} onChangeText={setName} />
        <P>Bio</P>
        <TextInput value={bio} onChangeText={setBio} multiline />
        <Button title="Guardar y continuar" onPress={saveProfile} style={{ marginTop: theme.spacing(1) }} />
      </Card>
    </Screen>
  );
}
