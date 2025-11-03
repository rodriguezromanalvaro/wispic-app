import { useEffect, useMemo, useState, useCallback, Fragment } from 'react';

import { SectionList, View, Text } from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';

import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import EmptyState from 'components/EmptyState';
import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack, XStack } from 'components/tg';
import { Screen, Button } from 'components/ui';
import { loadJSON, saveJSON } from 'lib/storage';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

type EventRow = { id: number; title: string; city: string | null; start_at: string };
type FeedItem = EventRow & { pending: number };

const AnimatedSectionList: any = Animated.createAnimatedComponent(SectionList as any);

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);
  type RangeFilter = 'today' | '7' | '30' | 'all';
  const [, setRange] = useState<RangeFilter>('30');
  const [, setSelectedCity] = useState<string | 'all'>('all');
  const [, setOnlyPending] = useState(false);

  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [initialSeenLoaded, setInitialSeenLoaded] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['my-feed-events-with-pending', user?.id],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: att } = await supabase
        .from('event_attendance')
        .select('event_id')
        .eq('user_id', user!.id)
        .eq('status', 'going');
      const eventIds = (att || []).map((a: any) => a.event_id);
      if (!eventIds.length) return [];

      const { data: events } = await supabase
        .from('events')
        .select('id,title,city,start_at')
        .in('id', eventIds)
        .order('start_at', { ascending: true });
      const eventMap = new Map<number, EventRow>((events || []).map((e: any) => [e.id, e]));

      const { data: allAtt } = await supabase
        .from('event_attendance')
        .select('event_id,user_id,status')
        .in('event_id', eventIds)
        .eq('status', 'going');

      const otherIds = Array.from(
        new Set((allAtt || []).map((r: any) => r.user_id).filter((uid: string) => uid !== user!.id))
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
        if (!op) return true;
        const gOther = normalizeLabel(op.gender);
        const otherInterested = normalizeArr(op.interested_in as any);
        if (!gMe || !gOther) return true;
        const iWant = wants(myInterestedIn, gOther);
        const otherWants = wants(otherInterested, gMe);
        return iWant && otherWants;
      };

      const pendingByEvent = new Map<number, number>();
      for (const r of allAtt || []) {
        if (r.user_id === user!.id) continue;
        if (decidedSet.has(r.user_id)) continue;
        if (!passesMutual(r.user_id)) continue;
        pendingByEvent.set(r.event_id, (pendingByEvent.get(r.event_id) || 0) + 1);
      }

      return eventIds.map((id) => {
        const base = eventMap.get(id)!;
        return { ...base, pending: pendingByEvent.get(id) || 0 };
      });
    },
  });

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

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const rows = (data || []) as FeedItem[];
    const upcoming = rows.filter((r) => new Date(r.start_at).getTime() >= now);
    const past = rows.filter((r) => new Date(r.start_at).getTime() < now);
    return { upcoming, past };
  }, [data]);

  useEffect(() => {
    if (!initialSeenLoaded) {
      (async () => {
        const saved = await loadJSON<number[]>('feed:seenEventIds');
        if (saved && Array.isArray(saved)) setSeenIds(new Set(saved));
        setInitialSeenLoaded(true);
      })();
    }
  }, [initialSeenLoaded]);

  useEffect(() => {
    if (!upcoming.length) return;
    const allIds = upcoming.map(e => e.id);
    setSeenIds(prev => {
      const merged = new Set(prev);
      allIds.forEach(id => merged.add(id));
      saveJSON('feed:seenEventIds', Array.from(merged));
      return merged;
    });
  }, [upcoming.map(e=>e.id).join(',')]);

  useEffect(() => {
    if (!upcoming.length && !past.length) return;
    const myEventIds = new Set([...upcoming, ...past].map(e => e.id));
    const channel = supabase
      .channel('feed-broader-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendance' }, (payload: any) => {
        const changedId = payload.new?.event_id ?? payload.old?.event_id;
        if (changedId && myEventIds.has(changedId)) {
          refetch();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [upcoming.map(e=>e.id).join(','), past.map(e=>e.id).join(',')]);

  useFocusEffect(useCallback(() => {
    refetch();
  }, [refetch]));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('feed-likes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `liker=eq.${user.id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `liked=eq.${user.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
    const order = Array.from(byKey.entries()).sort((a,b) => {
      const priority = (lab: string) => lab === 'HOY' ? 0 : lab === 'MAÑANA' ? 1 : 2;
      const pa = priority(a[0]); const pb = priority(b[0]);
      if (pa !== pb) return pa - pb;
      return a[0].localeCompare(b[0]);
    });
    return order.map(([title,data]) => ({ title, data }));
  }, [upcoming]);

  const pendingStyle = (pending: number) => {
    if (pending === 0) return { bg: theme.colors.card, border: theme.colors.border, text: theme.colors.subtext };
    if (pending < 4) return { bg: theme.colors.card, border: theme.colors.primary, text: theme.colors.primary };
    return { bg: theme.colors.primary, border: theme.colors.primary, text: theme.colors.primaryText || '#fff' };
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const time = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    if (sameDay) return time;
    return `${d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' })} ${time}`;
  };

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (isLoading) {
    const skeletons = Array.from({ length: 4 });
    return (
      <Screen style={{ padding:0 }} edges={[]}> 
        <CenterScaffold variant='auth'>
          <YStack style={{ flex:1, paddingTop:16 }}>
            {skeletons.map((_,i) => (
              <Fragment key={i}>
              <GlassCard elevationLevel={1} padding={16} style={{ marginHorizontal:16, marginBottom:14 }}>
                <View style={{ height:14, width:'60%', backgroundColor: theme.colors.border, borderRadius:8, marginBottom:12 }} />
                <View style={{ height:10, width:'40%', backgroundColor: theme.colors.border, borderRadius:6 }} />
                <View style={{ position:'absolute', right:16, top:16, width:46, height:40, borderRadius:10, backgroundColor: theme.colors.border }} />
              </GlassCard>
              </Fragment>
            ))}
          </YStack>
        </CenterScaffold>
      </Screen>
    );
  }

  return (
    <Screen style={{ padding:0 }} edges={[]}> 
      <CenterScaffold variant='auth'>
        <AnimatedSectionList
          onScroll={onScroll}
          scrollEventThrottle={16}
          sections={sections}
          keyExtractor={(item:FeedItem) => String(item.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop:16, paddingBottom:48 }}
          SectionSeparatorComponent={() => <View style={{ height: theme.spacing(2) }} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
          ListHeaderComponent={( 
            <YStack gap="$2" style={{ marginBottom: 8, paddingHorizontal: 16 }}>
              {!!past.length && (
                <GlassCard padding={12} elevationLevel={1} style={{ marginBottom: 8 }}>
                  <Button
                    title={showPast ? 'Ocultar eventos pasados' : 'Ver eventos pasados (solo info)'}
                    onPress={() => setShowPast((v) => !v)}
                    variant="ghost"
                  />
                </GlassCard>
              )}
              {error && (
                <GlassCard padding={12} elevationLevel={1}>
                  <Text style={{ color: theme.colors.text }}>Error cargando tus eventos.</Text>
                </GlassCard>
              )}
              {showPast && !!past.length && (
                <YStack gap="$2">
                  <GlassCard padding={12} elevationLevel={1}>
                    <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                      Eventos pasados (no disponibles)
                    </Text>
                  </GlassCard>
                  {past.map(item => (
                    <GlassCard key={`past-${item.id}`} padding={14} elevationLevel={1} style={{
                      gap: 4, flexDirection:'row', justifyContent:'space-between', alignItems:'center', opacity:0.6, marginBottom: 8
                    }}>
                      <YStack style={{ flex:1 }}>
                        <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700' }}>{item.title}</Text>
                        <Text style={{ color: theme.colors.subtext }}>
                          {item.city || '—'} · {new Date(item.start_at).toLocaleString()}
                        </Text>
                        <View style={{ alignSelf:'flex-start', marginTop: 4, backgroundColor: theme.colors.border, paddingVertical:4, paddingHorizontal:8, borderRadius: theme.radius }}>
                          <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Evento pasado — no disponible</Text>
                        </View>
                      </YStack>
                      <View style={{ minWidth:40, paddingHorizontal:10, paddingVertical:6, borderRadius: theme.radius, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, alignItems:'center' }}>
                        <Text style={{ color: theme.colors.text, fontWeight:'800' }}>{item.pending}</Text>
                        <Text style={{ color: theme.colors.subtext, fontSize:11 }}>pend.</Text>
                      </View>
                    </GlassCard>
                  ))}
                </YStack>
              )}
            </YStack>
          )}
          renderSectionHeader={({ section }: { section: { title: string; data: FeedItem[] } }) => (
            <XStack ai="center" style={{ flexDirection:'row', alignItems:'center', paddingTop: section.title==='HOY'?0:8, paddingBottom:4 }}>
              <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'800' }}>{section.title}</Text>
            </XStack>
          )}
          renderItem={({ item }: any) => (
            <GlassCard interactive onPress={() => router.push(`/(tabs)/feed/${item.id}`)} padding={14} elevationLevel={1} style={{ marginHorizontal:16 }}>
              <View style={{ gap: theme.spacing(0.5), flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <YStack style={{ flex:1 }}>
                  <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700' }}>{item.title}</Text>
                  <Text style={{ color: theme.colors.subtext }}>
                    {item.city || '—'} · {formatDateTime(item.start_at)}
                  </Text>
                  {!seenIds.has(item.id) && initialSeenLoaded && (
                    <View style={{ marginTop:4, alignSelf:'flex-start', backgroundColor: theme.colors.primary, paddingHorizontal:8, paddingVertical:2, borderRadius: theme.radius }}>
                      <Text style={{ color: theme.colors.primaryText || '#fff', fontSize:11, fontWeight:'700' }}>Nuevo</Text>
                    </View>
                  )}
                </YStack>
                {(() => { const ps = pendingStyle(item.pending); return (
                  <View style={{ minWidth:50, paddingHorizontal:10, paddingVertical:6, borderRadius: theme.radius, backgroundColor: ps.bg, borderWidth:1, borderColor: ps.border, alignItems:'center' }}>
                    <Text style={{ color: ps.text, fontWeight:'800' }}>{item.pending}</Text>
                    <Text style={{ color: ps.text, fontSize:11 }}>pend.</Text>
                  </View>
                ); })()}
              </View>
            </GlassCard>
          )}
          ListEmptyComponent={(() => {
            if (!upcoming.length) {
              return (
                <EmptyState
                  title="Sin eventos aún"
                  subtitle="Apúntate a eventos para ver aquí tus oportunidades de conexión."
                  ctaLabel="Explorar eventos"
                  onPressCta={() => router.push('/(tabs)/events')}
                  iconName="sparkles-outline"
                />
              );
            }
            return (
              <EmptyState
                title="Sin coincidencias"
                subtitle="Ajusta los filtros (rango, ciudad o pendientes) para ver resultados."
                ctaLabel="Reset filtros"
                onPressCta={() => { setRange('30'); setSelectedCity('all'); setOnlyPending(false); }}
                iconName="filter-outline"
              />
            );
          })()}
        />
      </CenterScaffold>
    </Screen>
  );
}
