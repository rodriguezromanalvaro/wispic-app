import { View, Text, Pressable, ScrollView } from 'react-native';

import { useRouter } from 'expo-router';

import { useQuery } from '@tanstack/react-query';

import EmptyState from 'components/EmptyState';
import { CenterScaffold } from 'components/Scaffold';
import { Screen, Card, P } from 'components/ui';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { OwnerHeader } from 'features/owner/ui/OwnerHeader';
import OwnerHero from 'features/owner/ui/OwnerHero';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

export default function OwnerSeriesList(){
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ['owner-series', user?.id],
    queryFn: async () => {
      // Get my venue id
      const { data: membership } = await supabase
        .from('venue_staff')
        .select('venue_id')
        .eq('user_id', user!.id)
        .eq('role','owner')
        .maybeSingle();
      const vId = membership?.venue_id as number | undefined;
      if (!vId) return [];
      // Fetch series
      const { data: seriesRows } = await supabase
        .from('event_series')
        .select('id,title,active,start_date,end_date,days_of_week,start_time,end_time,tzid,roll_ahead_weeks')
        .eq('venue_id', vId)
        .order('created_at', { ascending: false });
      const list = (seriesRows||[]) as any[];
      if (!list.length) return [];
      // Auto roll-forward 1 week on read (best effort, idempotente)
      try {
        await Promise.all(
          list.map((s:any) => supabase.rpc('roll_series_forward', { p_series_id: s.id, p_horizon_weeks: 1 }))
        );
      } catch {}
      // Next occurrence per series (from events)
      const ids = list.map(s => s.id);
      const { data: nexts } = await supabase
        .from('events')
        .select('series_id,start_at')
        .in('series_id', ids)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true });
      const nextMap = new Map<number, string>();
      (nexts||[]).forEach((e:any)=>{ if(!nextMap.has(e.series_id)) nextMap.set(e.series_id, e.start_at); });
      return list.map(s => ({...s, next_at: nextMap.get(s.id) || null }));
    }
  });

  return (
    <OwnerBackground>
      <Screen style={{ backgroundColor: 'transparent' }}>
        <CenterScaffold transparentBg variant="minimal">
          <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 12 }}>
            <OwnerHero title="Mis eventos" subtitle="Series semanales. Se rellenan automáticamente 7 días vista." />
            {isLoading ? (
              <P dim>Cargando…</P>
            ) : (
              <View>
                {(data||[]).length === 0 ? (
                  <EmptyState
                    title="Aún no tienes series."
                    subtitle="Cuando crees una serie, la verás listada aquí."
                    iconName="calendar-outline"
                  />
                ) : (
                  (data||[]).map((item:any) => (
                    <Pressable key={String(item.id)} onPress={() => router.push({ pathname: '/(owner)/series/[id]', params: { id: String(item.id) } })}>
                      <Card variant="glass" gradientBorder>
                        <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:16 }}>{item.title}</Text>
                        <Text style={{ color: theme.colors.subtext, marginTop:4 }}>
                          {item.active ? 'Activa' : 'Pausada'} • Próxima: {item.next_at ? new Date(item.next_at).toLocaleString() : '—'}
                        </Text>
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </CenterScaffold>
      </Screen>
    </OwnerBackground>
  );
}
