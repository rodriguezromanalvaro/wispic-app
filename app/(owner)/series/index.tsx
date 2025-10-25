import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Screen, Card } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useAuth } from '../../../lib/useAuth';
import { supabase } from '../../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

export default function OwnerSeriesList(){
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
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
    <Screen style={{ backgroundColor: theme.colors.bg }}>
      <View style={{ paddingBottom: 16 }}>
        <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:22, marginBottom: 8 }}>Mis series</Text>
        {isLoading ? (
          <Text style={{ color: theme.colors.subtext }}>Cargando…</Text>
        ) : (
          <FlatList
            data={data||[]}
            keyExtractor={(item:any)=> String(item.id)}
            ItemSeparatorComponent={()=> <View style={{ height: 8 }} />}
            renderItem={({ item }: any) => (
              <Pressable onPress={() => router.push({ pathname: '/(owner)/series/[id]', params: { id: String(item.id) } })}>
                <Card>
                  <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:16 }}>{item.title}</Text>
                  <Text style={{ color: theme.colors.subtext, marginTop:4 }}>
                    {item.active ? 'Activa' : 'Pausada'} • Próxima: {item.next_at ? new Date(item.next_at).toLocaleString() : '—'}
                  </Text>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={<Card><Text style={{ color: theme.colors.subtext }}>Aún no tienes series.</Text></Card>}
          />
        )}
      </View>
    </Screen>
  );
}
