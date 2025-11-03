import { View, Text, ScrollView } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useQuery } from '@tanstack/react-query';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, Card, P, StickyFooterActions } from 'components/ui';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { OwnerHeader } from 'features/owner/ui/OwnerHeader';
import OwnerHero from 'features/owner/ui/OwnerHero';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';


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

  // Generación manual eliminada: ahora se rellena automáticamente ~7 días vista

  if (isLoading) {
    return (
      <OwnerBackground>
        <Screen style={{ backgroundColor: 'transparent' }}>
          <CenterScaffold transparentBg variant="minimal">
            <P dim>Cargando…</P>
          </CenterScaffold>
        </Screen>
      </OwnerBackground>
    );
  }

  const s = data?.series;

  return (
    <OwnerBackground>
      <Screen style={{ backgroundColor: 'transparent' }}>
        {!s ? (
          <CenterScaffold transparentBg variant="minimal">
            <P dim>Serie no encontrada.</P>
          </CenterScaffold>
        ) : (
          <>
          <CenterScaffold transparentBg variant="minimal">
            <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 12 }}>
              <OwnerHero title={s.title} />
              <Card variant="glass" gradientBorder>
                <Text style={{ color: theme.colors.subtext }}>
                  {s.active ? 'Activa' : 'Pausada'} • TZ {s.tzid}
                </Text>
                {/* Fechas de inicio/fin ocultas en el flujo simplificado */}
                <Text style={{ color: theme.colors.subtext, marginTop:4 }}>
                  Días: {(s.days_of_week||[]).join(', ')} • {s.start_time} - {s.end_time || '—'}
                </Text>
              </Card>
              <Card variant="glass" gradientBorder>
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
              {/* Inline back button removed; moved to sticky footer for consistent CTA placement */}
            </ScrollView>
          </CenterScaffold>
          <StickyFooterActions
            actions={[{ title: 'Volver', onPress: () => router.back(), variant: 'outline' }]}
          />
          </>
        )}
      </Screen>
    </OwnerBackground>
  );
}
