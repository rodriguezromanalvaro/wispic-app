import { ActivityIndicator, FlatList, View, Text, Pressable, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { useEffect, useMemo, useState } from 'react';
import { useRefetchOnFocus } from '../../../lib/useRefetchOnFocus';

type FilterRange = 'today' | '7' | '30' | 'all';

export default function Events() {
  const router = useRouter();
  const { user } = useAuth();

  const [range, setRange] = useState<FilterRange>('7');
  const [city, setCity] = useState<string>('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    // Incluimos user?.id para que cambie el cache key si cambia de usuario
    queryKey: ['events-all', user?.id],
    queryFn: async () => {
      const { data: events, error: e1 } = await supabase
        .from('events')
        .select('*')
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true });
      if (e1) throw e1;

      if (!user) return (events || []).map((ev: any) => ({ ev, going: false }));

      const { data: mine, error: e2 } = await supabase
        .from('event_attendance')
        .select('event_id,status')
        .eq('user_id', user.id);
      if (e2) throw e2;

      const goingSet = new Set(
        (mine || [])
          .filter((r: any) => r.status === 'going')
          .map((r: any) => r.event_id)
      );

      return (events || []).map((ev: any) => ({ ev, going: goingSet.has(ev.id) }));
    },
  });

  // Refrescar al volver a la pestaña
  useRefetchOnFocus(refetch);

  // Realtime: si cambia MI asistencia, refresco esta lista
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('events-tab-auto-refetch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_attendance', filter: `user_id=eq.${user.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, refetch]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    let limit: number | null = null;
    if (range === 'today') {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      limit = todayEnd.getTime();
    } else if (range === '7') {
      limit = now + 7 * 24 * 60 * 60 * 1000;
    } else if (range === '30') {
      limit = now + 30 * 24 * 60 * 60 * 1000;
    }

    const q = city.trim().toLowerCase();
    return data.filter((x: any) => {
      const t = new Date(x.ev.start_at).getTime();
      if (limit !== null && t > limit) return false;
      if (q && !(x.ev.city || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, range, city]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />;

  return (
    <Screen style={{ paddingBottom: theme.spacing(1) }}>
      <TopBar title="Eventos" hideBack />

      <Card style={{ gap: 8 }}>
        {/* Filtros rápidos por fecha */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { key: 'today', label: 'Hoy' },
            { key: '7', label: '7 días' },
            { key: '30', label: '30 días' },
            { key: 'all', label: 'Todos' },
          ] as { key: FilterRange; label: string }[]).map((opt) => {
            const active = range === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setRange(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: theme.radius,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: active ? theme.colors.primaryText : theme.colors.text,
                    fontWeight: '700',
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filtro por ciudad */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.subtext }}>Ciudad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Madrid, Barcelona…"
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
      </Card>

      {error ? (
        <Card>
          <Text style={{ color: theme.colors.text }}>Error cargando eventos</Text>
        </Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.ev.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
          renderItem={({ item }) => {
            const dt = new Date(item.ev.start_at);
            return (
              <Card
                style={{ gap: theme.spacing(0.5) }}
                onPress={() => router.push(`/(tabs)/events/${item.ev.id}`)}
              >
                <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>
                  {item.ev.title}
                </Text>
                <Text style={{ color: theme.colors.subtext }}>
                  {item.ev.city} — {dt.toLocaleString()}
                </Text>
                {item.going && (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: theme.spacing(0.5),
                      backgroundColor: theme.colors.positive,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: theme.radius,
                    }}
                  >
                    <Text style={{ color: theme.colors.primaryText, fontWeight: '700' }}>
                      ✓ Ya estás apuntado
                    </Text>
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <Card>
              <Text style={{ color: theme.colors.text }}>No hay eventos con esos filtros.</Text>
            </Card>
          }
        />
      )}
    </Screen>
  );
}
