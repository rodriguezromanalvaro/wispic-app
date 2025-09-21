import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { useRouter } from 'expo-router';
import { loadUserDefaultFilters, saveUserDefaultFilters, type FilterState } from '../../../lib/userPrefs';

// 👇 PREMIUM
import { usePremiumStore } from '../../../lib/premium';

type ProfileRow = {
  id: string;
  display_name: string | null;
  bio: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  interests: string[] | null;
  is_premium?: boolean | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<ProfileRow | null>({
    enabled: !!user,
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, bio, age, gender, interests, is_premium')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileRow) ?? null;
    },
  });

  // ---- Campos del perfil
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState<string>(''); // string para el input
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [interests, setInterests] = useState<string>(''); // coma-separado

  useEffect(() => {
    if (profile) {
      setName(profile.display_name || '');
      setBio(profile.bio || '');
      setAge(profile.age ? String(profile.age) : '');
      setGender(profile.gender ?? null);
      setInterests((profile.interests || []).join(', '));
    }
  }, [profile?.id]);

  const save = async () => {
    if (!user) return;
    const parsedAge = age.trim() ? Number(age) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120)) {
      Alert.alert('Edad inválida', 'Introduce una edad entre 18 y 120.');
      return;
    }
    const parsedInterests = interests
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const toSave = {
      id: user.id,
      display_name: name.trim() || null,
      bio: bio.trim() || null,
      age: parsedAge,
      gender, // puede ser null
      interests: parsedInterests.length ? parsedInterests : null,
    };
    const { error } = await supabase.from('profiles').upsert(toSave).select('id').single();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ['profile', user.id] });
    Alert.alert('Listo', 'Perfil guardado correctamente');
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente.');
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo cerrar sesión');
    }
  };

  // ---- Preferencias globales (feed)
  const [gMinAge, setGMinAge] = useState<string>('');
  const [gMaxAge, setGMaxAge] = useState<string>('');
  const [gGender, setGGender] = useState<'any' | 'male' | 'female' | 'other'>('any');
  const [gInterest, setGInterest] = useState<string>('');

  const loadGlobals = useCallback(async () => {
    const saved = await loadUserDefaultFilters();
    if (saved) {
      setGMinAge(saved.minAge);
      setGMaxAge(saved.maxAge);
      setGGender(saved.gender);
      setGInterest(saved.interest);
    }
  }, []);

  useEffect(() => {
    loadGlobals();
  }, [loadGlobals]);

  useFocusEffect(
    useCallback(() => {
      loadGlobals();
    }, [loadGlobals])
  );

  const saveDefaults = async () => {
    const state: FilterState = {
      minAge: gMinAge,
      maxAge: gMaxAge,
      gender: gGender,
      interest: gInterest,
    };
    await saveUserDefaultFilters(state);
    Alert.alert('Listo', 'Preferencias globales guardadas');
    await loadGlobals();
  };

  const clearDefaults = async () => {
    await saveUserDefaultFilters({ minAge: '', maxAge: '', gender: 'any', interest: '' });
    await loadGlobals();
    Alert.alert('Hecho', 'Preferencias globales reiniciadas');
  };

  // ---- PREMIUM (store)
  const { isPremium, setPremium, refresh } = usePremiumStore();
  useEffect(() => {
    if (user?.id) refresh(user.id);
  }, [user?.id]);

  const togglePremiumDemo = async () => {
    if (!user?.id) return;
    try {
      await setPremium(user.id, !isPremium);
      await qc.invalidateQueries({ queryKey: ['profile', user.id] });
      Alert.alert('Listo', isPremium ? 'Premium desactivado' : 'Premium activado');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo cambiar premium');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 }) as number}
    >
      <Screen>
        <TopBar title="Mi perfil" hideBack />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: theme.spacing(2), gap: theme.spacing(1) }}
        >
          {/* --- Información básica --- */}
          <Card style={{ gap: theme.spacing(1) }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              Información básica
            </Text>

            {isLoading ? (
              <Text style={{ color: theme.colors.subtext }}>Cargando…</Text>
            ) : (
              <>
                {/* Nombre */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.subtext }}>Nombre</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Tu nombre visible"
                    placeholderTextColor={theme.colors.subtext}
                    style={{
                      color: theme.colors.text,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  />
                </View>

                {/* Bio */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.subtext }}>Bio</Text>
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Cuenta algo sobre ti"
                    placeholderTextColor={theme.colors.subtext}
                    multiline
                    numberOfLines={4}
                    style={{
                      color: theme.colors.text,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Edad */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.subtext }}>Edad</Text>
                  <TextInput
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    blurOnSubmit={false}
                    placeholder="Ej. 28"
                    placeholderTextColor={theme.colors.subtext}
                    style={{
                      color: theme.colors.text,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  />
                </View>

                {/* Género */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.subtext }}>Género</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {(['male','female','other'] as const).map((g) => {
                      const active = gender === g;
                      const label = g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : 'Otro';
                      return (
                        <Pressable
                          key={g}
                          onPress={() => setGender(g)}
                          style={{
                            paddingVertical: 8, paddingHorizontal: 12,
                            borderRadius: theme.radius, borderWidth: 1,
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                            backgroundColor: active ? theme.colors.primary : 'transparent',
                          }}
                        >
                          <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text, fontWeight: '700' }}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setGender(null)}
                      style={{
                        paddingVertical: 8, paddingHorizontal: 12,
                        borderRadius: theme.radius, borderWidth: 1,
                        borderColor: gender === null ? theme.colors.primary : theme.colors.border,
                        backgroundColor: gender === null ? theme.colors.primary : 'transparent',
                      }}
                    >
                      <Text style={{ color: gender === null ? theme.colors.primaryText : theme.colors.text, fontWeight: '700' }}>
                        Prefiero no decirlo
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Intereses */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.subtext }}>Intereses (separados por comas)</Text>
                  <TextInput
                    value={interests}
                    onChangeText={setInterests}
                    placeholder="techno, indie, salsa…"
                    placeholderTextColor={theme.colors.subtext}
                    blurOnSubmit={false}
                    style={{
                      color: theme.colors.text,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  />
                </View>

                <View style={{ height: theme.spacing(0.5) }} />
                <Button title="Guardar" onPress={save} />
              </>
            )}
          </Card>

          {/* --- Premium (demo) --- */}
          <Card style={{ gap: theme.spacing(1) }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              Premium
            </Text>
            <Text style={{ color: theme.colors.subtext }}>
              Estado actual: <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{isPremium ? 'Activo' : 'Inactivo'}</Text>
            </Text>
            <Button
              title={isPremium ? 'Desactivar Premium (demo)' : 'Activar Premium (demo)'}
              onPress={togglePremiumDemo}
            />
          </Card>

          {/* --- Preferencias globales del feed --- */}
          <Card style={{ gap: theme.spacing(1) }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              Preferencias globales del feed
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Edad mín.</Text>
                <TextInput
                  value={gMinAge}
                  onChangeText={setGMinAge}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  blurOnSubmit={false}
                  placeholder="18"
                  placeholderTextColor={theme.colors.subtext}
                  style={{
                    color: theme.colors.text, backgroundColor: theme.colors.card,
                    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
                    paddingHorizontal: 12, paddingVertical: 10,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Edad máx.</Text>
                <TextInput
                  value={gMaxAge}
                  onChangeText={setGMaxAge}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  blurOnSubmit={false}
                  placeholder="40"
                  placeholderTextColor={theme.colors.subtext}
                  style={{
                    color: theme.colors.text, backgroundColor: theme.colors.card,
                    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
                    paddingHorizontal: 12, paddingVertical: 10,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['any','male','female','other'] as const).map((g) => {
                const active = gGender === g;
                const label = g === 'any' ? 'Todos' : g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : 'Otro';
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGGender(g)}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 12,
                      borderRadius: theme.radius, borderWidth: 1,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                    }}
                  >
                    <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text, fontWeight: '700' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Interés contiene…</Text>
              <TextInput
                value={gInterest}
                onChangeText={setGInterest}
                placeholder="salsa, techno, indie…"
                placeholderTextColor={theme.colors.subtext}
                blurOnSubmit={false}
                style={{
                  color: theme.colors.text, backgroundColor: theme.colors.card,
                  borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button title="Guardar globales" onPress={saveDefaults} />
              <Button title="Restablecer" onPress={clearDefaults} variant="ghost" />
            </View>
          </Card>

          {/* --- Cerrar sesión --- */}
          <Card>
            <Button title="Cerrar sesión" onPress={signOut} variant="danger" />
          </Card>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
