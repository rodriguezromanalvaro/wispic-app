import { ActivityIndicator, FlatList, SectionList, View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card, Button } from '../../../components/ui';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { GradientScaffold } from '../../../features/profile/components/GradientScaffold';
import { theme } from '../../../lib/theme';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { loadJSON, saveJSON } from '../../../lib/storage';

type EventRow = { id: number; title: string; city: string | null; start_at: string };
type FeedItem = EventRow & { pending: number };

// Reanimated versions for overlay header shadow tracking
const AnimatedFlatList: any = Animated.createAnimatedComponent(FlatList as any);
const AnimatedSectionList: any = Animated.createAnimatedComponent(SectionList as any);

export default function FeedIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);
  // Semana 2 - filtros
  type RangeFilter = 'today' | '7' | '30' | 'all';
  const [range, setRange] = useState<RangeFilter>('30');
  const [selectedCity, setSelectedCity] = useState<string | 'all'>('all');
  const [onlyPending, setOnlyPending] = useState(false);

  // Eventos vistos (para badge "Nuevo")
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [initialSeenLoaded, setInitialSeenLoaded] = useState(false);

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

      // 4b) Perfiles necesarios para aplicar filtro mutuo (mismo criterio que en la pantalla de swipe)
      //     Traemos género e interested_in de todos los "otros" y el mío propio para evaluar compatibilidad.
      let profileMap = new Map<string, { gender: string | null; interested_in: string[] | null }>();
      if (otherIds.length) {
        const { data: profRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, gender, interested_in')
          .in('id', [...otherIds, user!.id]);
        if (profErr) console.warn('[feed] profiles error', profErr.message);
        (profRows || []).forEach((p: any) => {
          profileMap.set(p.id, { gender: p.gender ?? null, interested_in: p.interested_in ?? [] });
        });
      }

      // Normalización (copiado de la lógica de swipe para consistencia)
      const normalizeLabel = (raw?: string | null): string | null => {
        if (!raw) return null; const s = String(raw).toLowerCase().trim();
        if (['male','man','men','m','hombre','hombres','masculino','masculinos'].includes(s)) return 'male';
        if (['female','woman','women','f','mujer','mujeres','femenino','femeninos','femenina','femeninas'].includes(s)) return 'female';
        if (['other','others','otro','otra','otros','otras','no binario','no-binario','nobinario','nonbinary','non-binary','non binary','nb','x','otro género','otro genero','otrx'].includes(s)) return 'other';
        if (['everyone','all','cualquiera','todos','todas','any'].includes(s)) return '*';
        return s;
      };
      const normalizeArr = (arr?: string[] | null): string[] => {
        if (!Array.isArray(arr)) return []; return Array.from(new Set(arr.map(a => normalizeLabel(a)).filter(Boolean) as string[]));
      };
      const wants = (list: string[], other: string | null): boolean => {
        if (!other) return true; if (!list.length) return true; if (list.includes('*')) return true; return list.includes(other);
      };
      const meProfile = profileMap.get(user!.id);
      const gMe = normalizeLabel(meProfile?.gender || null);
      const myInterestedIn = normalizeArr(meProfile?.interested_in as any);

      const passesMutual = (otherId: string): boolean => {
        const op = profileMap.get(otherId);
        if (!op) return true; // permisivo si no tenemos datos todavía
        const gOther = normalizeLabel(op.gender);
        const otherInterested = normalizeArr(op.interested_in as any);
        if (!gMe || !gOther) return true; // faltan datos -> no bloquear
        const iWant = wants(myInterestedIn, gOther);
        const otherWants = wants(otherInterested, gMe);
        return iWant && otherWants;
      };

      // 5) Calcular pendientes por evento = asistentes - mis decididos - yo
      const pendingByEvent = new Map<number, number>();
      for (const r of allAtt || []) {
        if (r.user_id === user!.id) continue;
        if (decidedSet.has(r.user_id)) continue;
        if (!passesMutual(r.user_id)) continue; // aplicar filtro mutuo
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

  // Cargar IDs vistos previos (solo una vez tras obtener upcoming)
  useEffect(() => {
    if (!initialSeenLoaded) {
      (async () => {
        const saved = await loadJSON<number[]>('feed:seenEventIds');
        if (saved && Array.isArray(saved)) setSeenIds(new Set(saved));
        setInitialSeenLoaded(true);
      })();
    }
  }, [initialSeenLoaded]);

  // Persistir vista actual (tras render / cambios) sin bloquear UI
  useEffect(() => {
    if (!upcoming.length) return;
    const allIds = upcoming.map(e => e.id);
    // merge para no perder; se podría limpiar eventos pasados
    setSeenIds(prev => {
      const merged = new Set(prev);
      allIds.forEach(id => merged.add(id));
      saveJSON('feed:seenEventIds', Array.from(merged));
      return merged;
    });
  }, [upcoming.map(e=>e.id).join(',')]);

  // (Filtros eliminados) usamos directamente 'upcoming'

  // Realtime ampliado: cualquier cambio en event_attendance que afecte a uno de mis eventos
  useEffect(() => {
    if (!upcoming.length && !past.length) return; // no subscribir si nada
    const myEventIds = new Set([...upcoming, ...past].map(e => e.id));
    const channel = supabase
      .channel('feed-broader-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendance' }, (payload: any) => {
        const changedId = payload.new?.event_id ?? payload.old?.event_id;
        if (changedId && myEventIds.has(changedId)) {
          // Refetch ligero; si quisiéramos debouncer podríamos añadirlo.
          refetch();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [upcoming.map(e=>e.id).join(','), past.map(e=>e.id).join(',')]);

  // Refetch al enfocar (volver desde pantalla de swipe)
  useFocusEffect(useCallback(() => {
    refetch();
  }, [refetch]));

  // Manual refresh to prevent auto-refetch spinner
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  // Realtime likes: refrescar pendientes cuando yo decido (liker = user.id) o alguien decide sobre mí (liked = user.id)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('feed-likes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `liker=eq.${user.id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `liked=eq.${user.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Agrupar por día (secciones)
  const sections = useMemo(() => {
    if (!upcoming.length) return [] as { title: string; data: FeedItem[] }[];
    const byKey = new Map<string, FeedItem[]>();
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const todayTs = today.getTime(); const tomorrowTs = tomorrow.getTime();
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'short' });
    for (const ev of upcoming) {
      const d = new Date(ev.start_at); const keyDate = new Date(d); keyDate.setHours(0,0,0,0);
      let label: string;
      if (keyDate.getTime() === todayTs) label = 'HOY';
      else if (keyDate.getTime() === tomorrowTs) label = 'MAÑANA';
      else label = fmt(keyDate).replace(/^(\w)/, c=>c.toUpperCase());
      if (!byKey.has(label)) byKey.set(label, []);
      byKey.get(label)!.push(ev);
    }
    // Orden por fecha real (mantener HOY, MAÑANA primero)
    const order = Array.from(byKey.entries()).sort((a,b) => {
      const priority = (lab: string) => lab === 'HOY' ? 0 : lab === 'MAÑANA' ? 1 : 2;
      const pa = priority(a[0]); const pb = priority(b[0]);
      if (pa !== pb) return pa - pb;
      // fallback: parse day number inside label (simple heuristic)
      return a[0].localeCompare(b[0]);
    });
    return order.map(([title,data]) => ({ title, data }));
  }, [upcoming]);

  // Badge de pendientes con colores
  const pendingStyle = (pending: number) => {
    if (pending === 0) return { bg: theme.colors.card, border: theme.colors.border, text: theme.colors.subtext };
    if (pending < 4) return { bg: theme.colors.card, border: theme.colors.primary, text: theme.colors.primary };
    return { bg: theme.colors.primary, border: theme.colors.primary, text: theme.colors.primaryText || '#fff' };
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    // Mostrar solo hora si es hoy; fecha corta + hora si no
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const time = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    if (sameDay) return time;
    return `${d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' })} ${time}`;
  };

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (isLoading) {
    // Skeleton loader simple
    const skeletons = Array.from({ length: 4 });
    return (
  <Screen style={{ padding:0 }} edges={[]}>
        <GradientScaffold>
          <View style={{ flex:1, paddingTop:16, paddingHorizontal:16 }}>
            {skeletons.map((_,i) => (
              <View key={i} style={{ marginBottom:14, backgroundColor: theme.colors.card, borderRadius: theme.radius, padding:16, overflow:'hidden' }}>
                <View style={{ height:14, width:'60%', backgroundColor: theme.colors.border, borderRadius:8, marginBottom:12 }} />
                <View style={{ height:10, width:'40%', backgroundColor: theme.colors.border, borderRadius:6 }} />
                <View style={{ position:'absolute', right:16, top:16, width:46, height:40, borderRadius:10, backgroundColor: theme.colors.border }} />
              </View>
            ))}
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  return (
  <Screen style={{ padding:0 }} edges={[]}>
      <GradientScaffold>
        <AnimatedSectionList
          onScroll={onScroll}
          scrollEventThrottle={16}
          sections={sections}
          keyExtractor={(item:FeedItem) => String(item.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingTop:16, paddingBottom:48, paddingHorizontal:16 }}
          SectionSeparatorComponent={() => <View style={{ height: theme.spacing(2) }} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
          ListHeaderComponent={( 
            <View style={{ marginBottom: theme.spacing(1) }}>
              {!!past.length && (
                <Card style={{ marginBottom: theme.spacing(1) }}>
                  <Button
                    title={showPast ? 'Ocultar eventos pasados' : 'Ver eventos pasados (solo info)'}
                    onPress={() => setShowPast((v) => !v)}
                    variant="ghost"
                  />
                </Card>
              )}
              {error && (
                <Card>
                  <Text style={{ color: theme.colors.text }}>Error cargando tus eventos.</Text>
                </Card>
              )}
              {showPast && !!past.length && (
                <View>
                  <Card>
                    <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                      Eventos pasados (no disponibles)
                    </Text>
                  </Card>
                  <View style={{ marginTop: theme.spacing(1) }} />
                  {past.map(item => (
                    <Card key={`past-${item.id}`} style={{
                      gap: theme.spacing(0.5), flexDirection:'row', justifyContent:'space-between', alignItems:'center', opacity:0.6, marginBottom: theme.spacing(1)
                    }}>
                      <View style={{ flex:1 }}>
                        <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700' }}>{item.title}</Text>
                        <Text style={{ color: theme.colors.subtext }}>
                          {item.city || '—'} · {new Date(item.start_at).toLocaleString()}
                        </Text>
                        <View style={{ alignSelf:'flex-start', marginTop: theme.spacing(0.5), backgroundColor: theme.colors.border, paddingVertical:4, paddingHorizontal:8, borderRadius: theme.radius }}>
                          <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Evento pasado — no disponible</Text>
                        </View>
                      </View>
                      <View style={{ minWidth:40, paddingHorizontal:10, paddingVertical:6, borderRadius: theme.radius, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, alignItems:'center' }}>
                        <Text style={{ color: theme.colors.text, fontWeight:'800' }}>{item.pending}</Text>
                        <Text style={{ color: theme.colors.subtext, fontSize:11 }}>pend.</Text>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}
          renderSectionHeader={({ section }: { section: { title: string; data: FeedItem[] } }) => (
            <View style={{ flexDirection:'row', alignItems:'center', paddingTop: section.title==='HOY'?0:8, paddingBottom:4 }}>
              <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'800' }}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }: any) => (
            <Pressable onPress={() => router.push(`/(tabs)/feed/${item.id}`)} style={({ pressed }) => ({ transform:[{ scale: pressed?0.97:1 }] })}>
              <Card style={{ gap: theme.spacing(0.5), flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <View style={{ flex:1 }}>
                  <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700' }}>{item.title}</Text>
                  <Text style={{ color: theme.colors.subtext }}>
                    {item.city || '—'} · {formatDateTime(item.start_at)}
                  </Text>
                  {/* Badge Nuevo */}
                  {!seenIds.has(item.id) && initialSeenLoaded && (
                    <View style={{ marginTop:4, alignSelf:'flex-start', backgroundColor: theme.colors.primary, paddingHorizontal:8, paddingVertical:2, borderRadius: theme.radius }}>
                      <Text style={{ color: theme.colors.primaryText || '#fff', fontSize:11, fontWeight:'700' }}>Nuevo</Text>
                    </View>
                  )}
                </View>
                {(() => { const ps = pendingStyle(item.pending); return (
                  <View style={{ minWidth:50, paddingHorizontal:10, paddingVertical:6, borderRadius: theme.radius, backgroundColor: ps.bg, borderWidth:1, borderColor: ps.border, alignItems:'center' }}>
                    <Text style={{ color: ps.text, fontWeight:'800' }}>{item.pending}</Text>
                    <Text style={{ color: ps.text, fontSize:11 }}>pend.</Text>
                  </View>
                ); })()}
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={(() => {
            if (!upcoming.length) {
              return (
                <Card style={{ gap:8 }}>
                  <Text style={{ color: theme.colors.text, fontWeight:'700', fontSize:16 }}>Sin eventos aún</Text>
                  <Text style={{ color: theme.colors.subtext }}>Apúntate a eventos para ver aquí tus oportunidades de conexión.</Text>
                  <Pressable onPress={() => router.push('/(tabs)/events')} style={({pressed}) => ({ backgroundColor: pressed? theme.colors.primary : theme.colors.card, borderWidth:1, borderColor: theme.colors.primary, paddingVertical:10, paddingHorizontal:14, borderRadius: theme.radius })}>
                    <Text style={{ color: theme.colors.primary, fontWeight:'700', textAlign:'center' }}>Explorar eventos</Text>
                  </Pressable>
                </Card>
              );
            }
            // Hay eventos originales pero los filtros ocultan todos
            return (
              <Card style={{ gap:8 }}>
                <Text style={{ color: theme.colors.text, fontWeight:'700', fontSize:16 }}>Sin coincidencias</Text>
                <Text style={{ color: theme.colors.subtext }}>Ajusta los filtros (rango, ciudad o pendientes) para ver resultados.</Text>
                <Pressable onPress={() => { setRange('30'); setSelectedCity('all'); setOnlyPending(false); }} style={({pressed}) => ({ backgroundColor: pressed? theme.colors.primary : theme.colors.card, borderWidth:1, borderColor: theme.colors.primary, paddingVertical:10, paddingHorizontal:14, borderRadius: theme.radius })}>
                  <Text style={{ color: theme.colors.primary, fontWeight:'700', textAlign:'center' }}>Reset filtros</Text>
                </Pressable>
              </Card>
            );
          })()}
        />
      </GradientScaffold>
    </Screen>
  );
}
