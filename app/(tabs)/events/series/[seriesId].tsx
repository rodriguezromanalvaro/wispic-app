import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Screen, Card } from '../../../../components/ui';
import TopBar from '../../../../components/TopBar';
import { ActivityIndicator, FlatList, Text, View, Pressable } from 'react-native';
import { theme } from '../../../../lib/theme';
import { venueTypeIcons, type VenueType } from '../../../../types/venues';

export default function SeriesDetails() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['series-details', seriesId],
    queryFn: async () => {
      const id = Number(seriesId);
      const { data: series, error: e1 } = await supabase
        .from('event_series')
        .select(`
          id,
          title,
          venue:venues!inner (
            id,
            name,
            venue_type
          )
        `)
        .eq('id', id)
        .single();
      if (e1) throw e1;

  // Normalize venue shape (object or array) and derive venue fields
  const seriesVenue: any = Array.isArray((series as any)?.venue) ? (series as any).venue[0] : (series as any).venue;

  // For nightclub series we will show ALL upcoming dates, but highlight current week subset separately
  const isNightclub = seriesVenue?.venue_type === 'nightclub';

      const now = new Date();
      const dow = (now.getDay() + 6) % 7; // Monday=0
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - dow);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const minStart = new Date(Math.max(now.getTime(), weekStart.getTime()));

      let evq = supabase
        .from('events')
        .select('*')
        .eq('series_id', id)
        .gte('start_at', now.toISOString())
        .order('start_at', { ascending: true });

      const { data: events, error: e2 } = await evq;
      if (e2) throw e2;

  return { series: { ...series, venue: seriesVenue }, events: events || [] };
    },
  });

  if (isLoading) {
    return (
      <Screen>
        <TopBar title="Serie" />
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      </Screen>
    );
  }

  if (error || !data?.series) {
    return (
      <Screen>
        <TopBar title="Serie" />
        <Card>
          <Text style={{ color: theme.colors.text }}>No se pudo cargar la serie</Text>
        </Card>
      </Screen>
    );
  }

  const { series, events } = data;
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday=0
  const weekStart = new Date(now);
  weekStart.setHours(0,0,0,0);
  weekStart.setDate(now.getDate() - dow);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7);
  const weekEvents = events.filter(ev => {
    const t = new Date(ev.start_at).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });
  const isNightclub = (series as any).venue?.venue_type === 'nightclub';

  return (
    <Screen>
      <TopBar title={series.title} />
      <Card style={{ margin: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>
          {(() => { const vt: VenueType = ((series as any).venue?.venue_type as VenueType) || 'nightclub'; return `${venueTypeIcons[vt]} ${series.title}`; })()}
        </Text>
        <Text style={{ color: theme.colors.textDim, marginTop: 4 }}>
          {(series as any).venue?.name}
        </Text>
      </Card>

      {isNightclub && weekEvents.length > 0 && (
        <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 4 }}>Esta semana</Text>
          {weekEvents.map(ev => (
            <Pressable key={ev.id} onPress={() => router.push(`/events/${ev.id}`)}>
              <View style={{ paddingVertical: 4 }}>
                <Text style={{ color: theme.colors.text }}>{new Date(ev.start_at).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · {ev.title}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      <FlatList
        data={events}
        keyExtractor={(ev) => String(ev.id)}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
        renderItem={({ item: ev }) => (
          <Pressable onPress={() => router.push(`/events/${ev.id}`)}>
            <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
                  {ev.title}
                </Text>
              </View>
              <Text style={{ color: theme.colors.textDim }}>
                {new Date(ev.start_at).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {ev.city && (
                <Text style={{ color: theme.colors.textDim, marginTop: 4 }}>
                  {(series as any).venue?.name || ''} · {ev.city}
                </Text>
              )}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <Card style={{ margin: 16 }}>
            <Text style={{ color: theme.colors.text }}>No hay próximas fechas.</Text>
          </Card>
        }
      />
    </Screen>
  );
}
