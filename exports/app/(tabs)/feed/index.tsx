import { ActivityIndicator, FlatList, View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { useEffect, useMemo, useState } from 'react';

type EventRow = { id: number; title: string; city: string | null; start_at: string };
type FeedItem = EventRow & { pending: number };

export default function FeedIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    enabled: !!user,
    queryKey: ['my-feed-events-with-pending', user?.id],
    queryFn: async (): Promise<FeedItem[]> => {
      // 1) Eventos a los que voy
      const { data: att } = await supabase
        .from('event_attendance')
        .select('event_id')
        .eq('user_id', user!.id)
        .eq('status', 'going');
      const eventIds = (att || []).map((a: any) => a.event_id);
      if (!eventIds.length) return [];

      // 2) Info de eventos
      const { data: events } = await supabase
        .from('events')
        .select('id,title,city,start_at')
        .in('id', eventIds)
        .order('start_at', { ascending: true });
      const eventMap = new Map<number, EventRow>((events || []).map((e: any) => [e.id, e]));

      // 3) Todos los asistentes (excepto yo) de esos eventos
      const { data: allAtt } = await supabase
        .from('event_attendance')
        .select('event_id,user_id,status')
        .in('event_id', eventIds)
        .eq('status', 'going');

      // 4) Mis decisiones (like/superlike/pass) contra cualquiera de esos asistentes
      const otherIds = Array.from(
        new Set(
          (allAtt || [])
            .map((r: any) => r.user_id)
            .filter((uid: string) => uid !== user!.id)
        )
      );
      let decidedSet = new Set<string>();
      if (otherIds.length) {
        const { data: myLikesPasses } = await supabase
          .from('likes')
          .select('liked')
          .eq('liker', user!.id)
          .in('liked', otherIds);
        decidedSet = new Set((myLikesPasses || []).map((l: any) => l.liked));
      }

      // 5) Calcular pendientes por evento = asistentes - mis decididos - yo
      const pendingByEvent = new Map<number, number>();
      for (const r of allAtt || []) {
        if (r.user_id === user!.id) continue;
        if (decidedSet.has(r.user_id)) continue;
        pendingByEvent.set(r.event_id, (pendingByEvent.get(r.event_id) || 0) + 1);
      }

      // 6) Construir lista final
      return eventIds.map((id) => {
        const base = eventMap.get(id)!;
        return { ...base, pending: pendingByEvent.get(id) || 0 };
      });
    },
  });

  // 🔁 Realtime: si cambia mi asistencia, refrescar automáticamente
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('feed-auto-refetch-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_attendance', filter: `user_id=eq.${user.id}` },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Separar futuros vs pasados (sin tocar tus datos ni el contador "pend.")
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const rows = (data || []) as FeedItem[];
    const upcoming = rows.filter((r) => new Date(r.start_at).getTime() >= now);
    const past = rows.filter((r) => new Date(r.start_at).getTime() < now);
    return { upcoming, past };
  }, [data]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />;

  return (
    <Screen style={{ paddingBottom: theme.spacing(1) }}>
      <TopBar title="Feed" hideBack />

      {/* Toggle para mostrar/ocultar PASADOS (solo informativo) */}
      {!!past.length && (
        <Card style={{ marginBottom: theme.spacing(1) }}>
          <Button
            title={showPast ? 'Ocultar eventos pasados' : 'Ver eventos pasados (solo info)'}
            onPress={() => setShowPast((v) => !v)}
            variant="ghost"
          />
        </Card>
      )}

      {error ? (
        <Card>
          <Text style={{ color: theme.colors.text }}>Error cargando tus eventos.</Text>
        </Card>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(e) => String(e.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(tabs)/feed/${item.id}`)}>
              <Card
                style={{
                  gap: theme.spacing(0.5),
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: theme.colors.subtext }}>
                    {item.city || '—'} · {new Date(item.start_at).toLocaleString()}
                  </Text>
                </View>
                <View
                  style={{
                    minWidth: 40,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{item.pending}</Text>
                  <Text style={{ color: theme.colors.subtext, fontSize: 11 }}>pend.</Text>
                </View>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <Card>
              <Text style={{ color: theme.colors.text }}>
                Aún no vas a ningún evento. Ve a “Eventos” y apúntate para tener feed.
              </Text>
            </Card>
          }
        />
      )}

      {/* Bloque informativo de PASADOS (sin navegación) */}
      {showPast && !!past.length && (
        <>
          <View style={{ height: theme.spacing(1) }} />
          <Card>
            <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
              Eventos pasados (no disponibles)
            </Text>
          </Card>

          <FlatList
            data={past}
            keyExtractor={(e) => `past-${e.id}`}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
            renderItem={({ item }) => (
              <Card
                style={{
                  gap: theme.spacing(0.5),
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: 0.6, // atenuado
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: theme.colors.subtext }}>
                    {item.city || '—'} · {new Date(item.start_at).toLocaleString()}
                  </Text>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: theme.spacing(0.5),
                      backgroundColor: theme.colors.border,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: theme.radius,
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                      Evento pasado — no disponible
                    </Text>
                  </View>
                </View>

                {/* Mantengo tu badge de pendientes por coherencia visual */}
                <View
                  style={{
                    minWidth: 40,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{item.pending}</Text>
                  <Text style={{ color: theme.colors.subtext, fontSize: 11 }}>pend.</Text>
                </View>
              </Card>
            )}
          />
        </>
      )}
    </Screen>
  );
}
