import React from 'react';
import { View, Text, Alert } from 'react-native';
import { Screen, Card, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/useAuth';
import { supabase } from '../../../lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function OwnerSeriesDetail(){
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = Number(id);
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    enabled: !!user && Number.isFinite(sid),
    queryKey: ['owner-series-one', sid],
    queryFn: async () => {
      const { data: s, error } = await supabase
        .from('event_series')
        .select('id,title,active,start_date,end_date,days_of_week,start_time,end_time,tzid,roll_ahead_weeks,venue_id')
        .eq('id', sid)
        .maybeSingle();
      if (error) throw error;
      if (!s) return null;
      const { data: nexts } = await supabase
        .from('events')
        .select('id,start_at')
        .eq('series_id', sid)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(10);
      return { series: s as any, nexts: (nexts||[]) as any[] };
    }
  });

  const rollForward = async () => {
    try {
      const { error } = await supabase.rpc('roll_series_forward', { p_series_id: sid, p_horizon_weeks: 8 });
      if (error) throw error;
      Alert.alert('Listo', 'Generadas próximas semanas');
      refetch();
    } catch(e:any){ Alert.alert('Error', e.message||'No se pudo generar'); }
  };

  if (isLoading) {
    return (
      <Screen style={{ backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.subtext }}>Cargando…</Text>
      </Screen>
    );
  }

  const s = data?.series;

  return (
    <Screen style={{ backgroundColor: theme.colors.bg }}>
      {!s ? (
        <Text style={{ color: theme.colors.subtext }}>Serie no encontrada.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <Card>
            <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:18 }}>{s.title}</Text>
            <Text style={{ color: theme.colors.subtext, marginTop:6 }}>
              {s.active ? 'Activa' : 'Pausada'} • TZ {s.tzid}
            </Text>
            <Text style={{ color: theme.colors.subtext, marginTop:4 }}>
              {s.start_date || '—'} → {s.end_date || 'sin fin'}
            </Text>
            <Text style={{ color: theme.colors.subtext, marginTop:4 }}>
              Días: {(s.days_of_week||[]).join(', ')} • {s.start_time} - {s.end_time || '—'}
            </Text>
          </Card>
          <Card>
            <Text style={{ color: theme.colors.text, fontWeight:'800' }}>Próximas fechas</Text>
            <View style={{ height: 8 }} />
            {(data?.nexts||[]).length===0 ? (
              <Text style={{ color: theme.colors.subtext }}>No hay próximas fechas.</Text>
            ) : (
              (data?.nexts||[]).map((n:any)=> (
                <Text key={n.id} style={{ color: theme.colors.text, marginBottom: 4 }}>{new Date(n.start_at).toLocaleString()}</Text>
              ))
            )}
          </Card>
          <View style={{ flexDirection:'row', gap: 12 }}>
            <Button title="Generar 8 semanas" onPress={rollForward} />
            <View style={{ flex:1 }} />
            <Button title="Volver" variant="outline" onPress={()=> router.back()} />
          </View>
        </View>
      )}
    </Screen>
  );
}
