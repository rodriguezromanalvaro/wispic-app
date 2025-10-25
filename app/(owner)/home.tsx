import { View, Text, Image, ScrollView } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { Button, Card, Screen } from '../../components/ui';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { RequireOwnerReady } from '../../features/owner/RequireOwnerReady';
import { useAuth } from '../../lib/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch {}
  // Limpieza de flags dev ya no necesaria: owner mode se resuelve vía DB
  router.replace('/(auth)/sign-in' as any);
}

export default function OwnerHome() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // 1) Obtener venue del owner
  const { data: venueId } = useQuery<number | null>({
    enabled: !!user?.id,
    queryKey: ['owner-venue-id', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venue_staff')
        .select('venue_id')
        .eq('user_id', user!.id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.venue_id as number | undefined) ?? null;
    },
  });

  // 2) Lista de eventos publicados (próximos) de ese venue
  const { data: eventsList = [] } = useQuery<any[]>({
    enabled: !!venueId,
    queryKey: ['owner-events-list', venueId],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // incluir 24h previas por si acaba de pasar
      const { data, error } = await supabase
        .from('events')
        .select('id,title,start_at,is_free,price_cents,venue_id,city_id')
        .eq('venue_id', venueId as number)
        .eq('status', 'published')
        .gte('start_at', since)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 2b) Próximo evento (para default)
  const { data: nextEvent } = useQuery<any | null>({
    enabled: !!venueId,
    queryKey: ['owner-next-event', venueId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('id,title,start_at,is_free,price_cents,venue_id,city_id')
        .eq('venue_id', venueId as number)
        .eq('status', 'published')
        .gte('start_at', nowIso)
        .order('start_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any ?? null;
    },
  });

  const eventId = nextEvent?.id as number | undefined;
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    if (!selectedEventId) {
      const defId = (eventsList[0]?.id as number | undefined) || (nextEvent?.id as number | undefined) || null;
      if (defId) setSelectedEventId(defId);
    }
  }, [eventsList, nextEvent?.id, selectedEventId]);

  const selectedEvent = useMemo(() => {
    const id = selectedEventId || eventId;
    return eventsList.find((e) => e.id === id) || nextEvent || null;
  }, [eventsList, selectedEventId, eventId, nextEvent]);

  // 3) KPIs básicos de asistencia
  const { data: kpis } = useQuery<{ total: number; delta24h: number } | null>({
    enabled: !!selectedEvent?.id,
    queryKey: ['owner-event-kpis', selectedEvent?.id],
    queryFn: async () => {
      const eid = selectedEvent!.id as number;
      // Conteo total de apuntados (going)
      const { count: totalGoing, error: e1 } = await supabase
        .from('event_attendance')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', eid)
        .eq('status', 'going');
      if (e1) throw e1;
      // Delta 24h (si hay created_at)
      let delta24h = 0;
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: c24 } = await supabase
          .from('event_attendance')
          .select('user_id', { count: 'exact', head: true })
          .eq('event_id', eid)
          .eq('status', 'going')
          .gte('created_at', since);
        delta24h = c24 || 0;
      } catch {
        delta24h = 0; // si no hay created_at, omitimos
      }
      return { total: totalGoing || 0, delta24h };
    },
  });

  // 4) Avatares recientes
  const { data: recentAvatars } = useQuery<Array<{ id: string; avatar_url: string | null }>>({
    enabled: !!selectedEvent?.id,
    queryKey: ['owner-event-recent-avatars', selectedEvent?.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('event_attendance')
        .select('user_id,created_at')
        .eq('event_id', selectedEvent!.id as number)
        .eq('status', 'going')
        .order('created_at', { ascending: false })
        .limit(8);
      const ids = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,avatar_url')
        .in('id', ids);
      const pMap: Record<string, { id: string; avatar_url: string | null }> = {};
      (profs || []).forEach((p: any) => { pMap[p.id] = { id: p.id, avatar_url: p.avatar_url || null }; });
      // Fallback: if profiles are restricted by RLS, still return placeholders for recent user ids
      return ids.map(id => pMap[id] || { id, avatar_url: null });
    },
  });

  // 5) Serie de RSVPs últimos 7 días
  const { data: rsvps7 } = useQuery<Array<{ day: string; count: number }> | null>({
    enabled: !!selectedEvent?.id,
    queryKey: ['owner-event-rsvps7', selectedEvent?.id],
    queryFn: async () => {
      const tz = (Intl?.DateTimeFormat?.() as any)?.resolvedOptions?.().timeZone || 'UTC';
      try {
        const { data: out, error } = await supabase.rpc('get_event_rsvps_7d', { p_event: selectedEvent!.id as number, p_tz: tz });
        if (error) throw error;
        const mapped = (out || []).map((r: any) => ({ day: String(r.day), count: Number(r.count || 0) }));
        // Asegura 7 puntos ordenados
        if (mapped.length === 7) return mapped;
        // fallback si por lo que sea no llegan 7 filas
        const since = new Date(); since.setHours(0,0,0,0); since.setDate(since.getDate()-6);
        const days: string[] = [];
        for (let i=0;i<7;i++){ const d=new Date(since); d.setDate(since.getDate()+i); const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); days.push(`${yyyy}-${mm}-${dd}`); }
  const map = new Map<string, number>(mapped.map((m: { day: string; count: number }) => [m.day, m.count]));
        return days.map(d=> ({ day:d, count: map.get(d)||0 }));
      } catch (e) {
        // Fallback a cálculo en cliente si la RPC no existiera
        const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        since.setHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from('event_attendance')
          .select('created_at')
          .eq('event_id', selectedEvent!.id as number)
          .eq('status', 'going')
          .or(`created_at.is.null,created_at.gte.${since.toISOString()}`);
        const byDay = new Map<string, number>();
        const days: string[] = [];
        const localKey = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };
        for (let i = 0; i < 7; i++) {
          const d = new Date(since);
          d.setDate(since.getDate() + i);
          const key = localKey(d);
          days.push(key);
          byDay.set(key, 0);
        }
        (rows || []).forEach((r: any) => {
          const d = r.created_at ? new Date(r.created_at) : new Date();
          const key = localKey(d);
          if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1);
        });
        return days.map((d) => ({ day: d, count: byDay.get(d) || 0 }));
      }
    },
  });

  const revenue = useMemo(() => {
    if (!selectedEvent) return null;
    if (selectedEvent.is_free) return 'Gratis';
    const price = (selectedEvent.price_cents || 0) / 100;
    const going = kpis?.total || 0;
    const total = Math.round(price * going * 100) / 100;
    return `${total.toFixed(2)} €`;
  }, [selectedEvent, kpis?.total]);

  const timeToStart = useMemo(() => {
    if (!selectedEvent?.start_at) return null;
    const now = new Date();
    const start = new Date(selectedEvent.start_at);
    const diffMs = start.getTime() - now.getTime();
    if (diffMs <= 0) return 'Ya empezó';
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return days > 0 ? `Faltan ${days}d ${hours}h` : `Hoy en ${hours}h`;
  }, [selectedEvent?.start_at]);

  // Realtime refetch when attendance changes for the selected event
  useEffect(() => {
    if (!selectedEvent?.id) return;
    const channel = supabase
      .channel(`owner-att-${selectedEvent.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendance', filter: `event_id=eq.${selectedEvent.id}` }, () => {
        try {
          qc.invalidateQueries({ queryKey: ['owner-event-kpis', selectedEvent.id] });
          qc.invalidateQueries({ queryKey: ['owner-event-recent-avatars', selectedEvent.id] });
          qc.invalidateQueries({ queryKey: ['owner-event-rsvps7', selectedEvent.id] });
        } catch {}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [selectedEvent?.id]);

  // Realtime: refresh event lists when events for my venue are inserted/updated/deleted
  useEffect(() => {
    if (!venueId) return;
    const ch = supabase
      .channel(`owner-events-venue-${venueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `venue_id=eq.${venueId}` }, () => {
        try {
          qc.invalidateQueries({ queryKey: ['owner-events-list', venueId] });
          qc.invalidateQueries({ queryKey: ['owner-next-event', venueId] });
        } catch {}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [venueId]);
  return (
    <RequireOwnerReady>
      <Screen style={{ backgroundColor: theme.colors.bg }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>Panel del dueño</Text>
          {eventsList.length === 0 ? (
            <Card style={{ marginTop: 12 }}>
              <Text style={{ color: theme.colors.subtext }}>No tienes eventos publicados próximamente.</Text>
              <View style={{ height: 12 }} />
              <Button title="Crear evento" onPress={() => router.push('/(owner)/events' as any)} />
            </Card>
          ) : (
            <>
              {/* Selector de evento */}
              <Card style={{ marginTop: 12 }}>
                <Text style={{ color: theme.colors.subtext, marginBottom: 6 }}>Evento seleccionado</Text>
                <Button
                  title={selectedEvent ? `${selectedEvent.title} · ${new Date(selectedEvent.start_at).toLocaleString()}` : 'Elegir evento'}
                  onPress={() => setSelectorOpen((v) => !v)}
                  variant="outline"
                />
                {selectorOpen && (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {eventsList.map((ev) => (
                      <Button
                        key={ev.id}
                        title={`${ev.title} · ${new Date(ev.start_at).toLocaleString()}`}
                        onPress={() => { setSelectedEventId(ev.id); setSelectorOpen(false); }}
                        variant={ev.id === selectedEventId ? 'primary' : 'outline'}
                        gradient={ev.id === selectedEventId}
                      />
                    ))}
                  </View>
                )}
              </Card>

              {/* Estado fijo: Apuntados (going) */}
              <Text style={{ color: theme.colors.textDim, marginTop: 12 }}>Estás viendo: Apuntados</Text>

              {/* KPIs grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                <Kpi title={'Apuntados'} value={String(kpis?.total ?? 0)} subtitle={kpis ? `+${kpis.delta24h} 24h` : '—'} />
                <Kpi title="Recaudación" value={revenue ?? '—'} />
                <Kpi title="Inicio" value={timeToStart ?? '—'} />
                {/* Capacidad: si más adelante añadimos capacity en venues, lo mostramos aquí */}
              </View>

              {/* RSVPs últimos 7 días */}
              <Card style={{ marginTop: 12 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 8 }}>RSVPs últimos 7 días</Text>
                <Bar7 data={rsvps7 || []} />
              </Card>

              {/* Avatares recientes */}
              <Card style={{ marginTop: 12 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 8 }}>Se han apuntado recientemente</Text>
                {recentAvatars && recentAvatars.length > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: -8 }}>
                    {recentAvatars.slice(0, 8).map((p, idx) => (
                      <Image key={p.id}
                        source={p.avatar_url ? { uri: p.avatar_url } : require('../../assets/adaptive-icon-foreground.png')}
                        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: theme.colors.bg, marginLeft: idx === 0 ? 0 : -8 }}
                      />
                    ))}
                    {kpis && kpis.total > recentAvatars.length && (
                      <Text style={{ color: theme.colors.subtext, marginLeft: 8 }}>+{kpis.total - recentAvatars.length}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ color: theme.colors.subtext }}>Aún no hay asistentes recientes.</Text>
                )}
              </Card>
            </>
          )}

          <View style={{ marginTop: 16, width: '100%', maxWidth: 320 }}>
            <Button title="Cerrar sesión" onPress={logout} variant="outline" gradient={false} />
          </View>
        </ScrollView>
      </Screen>
    </RequireOwnerReady>
  );
}

const Kpi: React.FC<{ title: string; value: string; subtitle?: string }> = ({ title, value, subtitle }) => (
  <Card style={{ flexGrow: 1, flexBasis: '47%', paddingVertical: 14 }}>
    <Text style={{ color: theme.colors.subtext }}>{title}</Text>
    <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    {subtitle ? <Text style={{ color: theme.colors.subtext, marginTop: 2 }}>{subtitle}</Text> : null}
  </Card>
);

const Bar7: React.FC<{ data: Array<{ day: string; count: number }> }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.count / max) * 76));
        const lab = d.day.slice(5); // MM-DD
        return (
          <View key={d.day} style={{ alignItems: 'center' }}>
            <View style={{ width: 14, height: h, backgroundColor: theme.colors.primary, borderRadius: 4 }} />
            <Text style={{ color: theme.colors.subtext, fontSize: 10, marginTop: 4 }}>{lab}</Text>
          </View>
        );
      })}
      {data.length === 0 && (
        <Text style={{ color: theme.colors.subtext }}>Sin datos todavía</Text>
      )}
    </View>
  );
};
