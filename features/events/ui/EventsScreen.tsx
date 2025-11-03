// FULL ADVANCED RESTORE (series, sponsorship, attendance, Top de hoy) 2025-10-05
import { useEffect, useMemo, useState, useCallback, Fragment, useRef } from 'react';

import { View, Text, Pressable, TextInput, ScrollView, Alert, SectionList } from 'react-native';

import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import { SegmentedControl } from 'components/design';
import EmptyState from 'components/EmptyState';
import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack, XStack } from 'components/tg';
import { Screen, Card } from 'components/ui';
import { LocalCard } from 'features/events/ui';
import { AttendeesSheet, EventDetailSheet, type EventDetailData } from 'features/events/ui';
import { haversineKm } from 'lib/location/geo';
import { useAttendeesSheetStore } from 'lib/stores/attendeesSheet';
import { useEventsFiltersStore } from 'lib/stores/eventsFilters';
import { useFeedScopeStore } from 'lib/stores/feedScope';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';
import { useRefetchOnFocus } from 'lib/useRefetchOnFocus';

const AnimatedSectionList: any = Animated.createAnimatedComponent(SectionList as any);

type SeriesItem = {
  kind:'series';
  id:string;
  series:any;
  nextEv:any;
  going:boolean;
  sponsored:boolean;
  sponsoredPriority:number;
  weekDaysLabel?:string;
  occurrences:any[];
  occurrencesHasMore:boolean;
  attendeesCount:number;
  attendeeAvatars:any[];
};

type RawItem = SeriesItem;

export default function EventsScreen(){
  const router = useRouter();
  const { user, profile: authProfile } = useAuth() as any;
  const openAttendeesSheet = useAttendeesSheetStore(s=>s.openFor);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<EventDetailData | null>(null);

  const range = useEventsFiltersStore(s=>s.range);
  const setRange = useEventsFiltersStore(s=>s.setRange);
  const search = useEventsFiltersStore(s=>s.search);
  const setSearch = useEventsFiltersStore(s=>s.setSearch);
  const selectedCityId = useEventsFiltersStore(s=>s.selectedCityId);
  const setSelectedCityId = useEventsFiltersStore(s=>s.setSelectedCityId);
  const centerLat = useEventsFiltersStore(s=>s.centerLat);
  const centerLng = useEventsFiltersStore(s=>s.centerLng);
  const radiusKm = useEventsFiltersStore(s=>s.radiusKm);
  const locationLabel = useEventsFiltersStore(s=>s.locationLabel);
  const setLocationCenter = useEventsFiltersStore(s=>s.setLocationCenter);
  const feedScope = useFeedScopeStore(s=>s.feedScope);
  const setFeedScope = useFeedScopeStore(s=>s.setFeedScope);
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  // Cities
  const { data: cities } = useQuery({
    queryKey:['cities'],
    queryFn: async ()=>{
      const { data, error } = await supabase.from('cities').select('id,name').order('name');
      if(error) throw error; return data || [];
    }
  });

  // Derive city label for header with safe fallbacks
  const cityLabel = useMemo(() => {
    // Prefer the dynamic location label from store (profile_locations), then profile.city, then selectedCityId name
    const fromStore = (locationLabel || '').trim();
    if (fromStore) return fromStore;
    const direct = (authProfile as any)?.city as string | undefined;
    if (direct && direct.trim()) return direct.trim();
    if (selectedCityId !== 'all' && cities && cities.length) {
      const m = cities.find(c => c.id === selectedCityId);
      if (m?.name) return m.name;
    }
    return null as string | null;
  }, [locationLabel, authProfile?.city, selectedCityId, Array.isArray(cities) ? cities.length : 0]);

  // Cities with geo for fallback filtering when near RPC is unavailable
  const { data: citiesWithGeo } = useQuery({
    queryKey:['cities:with-geo'],
    queryFn: async ()=>{
      const trySelect = async (cols:string)=>{
        const { data, error } = await supabase.from('cities').select(cols).order('name');
        if(error) throw error; return data as any[];
      };
      try{
        return await trySelect('id,name,lat,lng');
      }catch(e:any){
        const msg = String(e?.message||'');
        if(msg.includes('column') && (msg.includes('lat')||msg.includes('lng'))){
          const fb = await trySelect('id,name');
          return fb.map((c:any)=> ({ ...c, lat:null, lng:null }));
        }
        throw e;
      }
    }
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey:['events-full', user?.id, selectedCityId, range, centerLat, centerLng, radiusKm, search],
    queryFn: async ()=>{
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
      const minStart = range==='today'? startOfToday : now;
      let distanceMap: Record<number, number> = {};
      let list: any[] = [];
      if (typeof centerLat === 'number' && typeof centerLng === 'number') {
        // Geo-pro: fetch nearby event ids (ordered by distance) and then load full rows
        try{
          const { data: nearRows, error: nearErr } = await supabase.rpc('get_events_near', {
            p_lat: centerLat,
            p_lng: centerLng,
            p_radius_km: radiusKm,
            p_min_start: minStart.toISOString(),
            p_search: (search||'').trim() || null,
          });
          if (nearErr) { console.warn('[events] get_events_near error:', nearErr.message); throw nearErr; }
          const ids = (nearRows||[]).map((r:any)=>{ distanceMap[r.event_id] = r.distance_km; return r.event_id; });
          if (ids.length) {
            const { data: events, error: e1 } = await supabase
              .from('events')
              .select(`*, venue:venues!inner(id,name,venue_type)`) // require venue
              .in('id', ids);
            if (e1) { console.warn('[events] fetch events by ids error:', e1.message); throw e1; }
            // Keep the order by distance
            const byId: Record<number, any> = {}; (events||[]).forEach((e:any)=> byId[e.id]=e);
            list = ids.map((id:number)=> byId[id]).filter(Boolean);
          }
        }catch(e:any){
          console.warn('[events] near RPC not available; falling back to legacy list with city radius filter', e?.message||e);
          // Attempt approximate city-based filter using cities lat/lng
          let allowedCityIds: number[] | null = null;
          const cg = citiesWithGeo as any[] | undefined;
          if (cg && typeof centerLat==='number' && typeof centerLng==='number' && typeof radiusKm==='number'){
            const center = { lat: centerLat, lng: centerLng } as const;
            allowedCityIds = cg
              .filter(c=> typeof c.lat==='number' && typeof c.lng==='number')
              .filter(c=> haversineKm(center, { lat: c.lat, lng: c.lng }) <= radiusKm)
              .map(c=> c.id);
          }
          let query = supabase
            .from('events')
            .select(`*, venue:venues!inner(id,name,venue_type)`) // require venue
            .gte('start_at', minStart.toISOString())
            .order('start_at');
          if (allowedCityIds && allowedCityIds.length){
            query = query.in('city_id', allowedCityIds as any);
          }
          const { data: events, error: e1 } = await query; if(e1) throw e1;
          list = (events||[]) as any[];
        }
      } else {
        // Fallback legacy city_id
        let query = supabase
          .from('events')
          .select(`*, venue:venues!inner(id,name,venue_type)`) // require venue
          .gte('start_at', minStart.toISOString())
          .order('start_at');
        // Only filter by city when we have a concrete numeric city id
        if (typeof selectedCityId === 'number') {
          query = query.eq('city_id', selectedCityId as any);
        }
        const { data: events, error: e1 } = await query; if(e1) throw e1;
        list = (events||[]) as any[];
      }

      const eventIds = Array.from(new Set(list.map(e=>e.id))).filter(Boolean) as number[];
      const seriesIds = Array.from(new Set(list.map(e=> e.series_id).filter(Boolean))) as number[];

      // Sponsorship tables
      let evSpons:any[] = []; let seSpons:any[] = []; let seriesRows:any[] = [];
      if(eventIds.length){
        const { data: es } = await supabase.from('event_sponsorships').select('event_id,starts_at,ends_at,priority').in('event_id', eventIds);
        evSpons = es||[];
      }
      if(seriesIds.length){
        const { data: ss } = await supabase.from('series_sponsorships').select('series_id,starts_at,ends_at,priority').in('series_id', seriesIds); seSpons = ss||[];
        const { data: sRows } = await supabase.from('event_series').select('id,title,venue:venues(id,name,venue_type)').in('id', seriesIds); seriesRows = sRows||[];
      }

      const isActive = (r:any)=> (!r.starts_at || new Date(r.starts_at)<=now) && (!r.ends_at || new Date(r.ends_at)>now);
      const evPri = new Map<number, number>();
      evSpons.forEach(s=>{ if(isActive(s)){ evPri.set(s.event_id, Math.max(evPri.get(s.event_id)||0, s.priority||1)); } });
      const sePri = new Map<number, number>();
      seSpons.forEach(s=>{ if(isActive(s)){ sePri.set(s.series_id, Math.max(sePri.get(s.series_id)||0, s.priority||1)); } });

      const seriesMap = new Map<number, any>(); seriesRows.forEach(s=> seriesMap.set(s.id, s));

      // Current user attendance set
      let goingSet = new Set<number>();
      if(user){
        const { data: mine } = await supabase.from('event_attendance').select('event_id,status').eq('user_id', user.id);
        goingSet = new Set((mine||[]).filter(r=> r.status==='going').map(r=> r.event_id));
      }

      // Attendance counts + avatars sample (limit 5 users per event)
      let attendanceCounts: Record<number, number> = {};
      const avatarSamples: Record<number, Array<{ id:string; avatar_url:string|null }>> = {};
      if(eventIds.length){
        const { data: rows } = await supabase.from('event_attendance').select('event_id,user_id,status').in('event_id', eventIds).eq('status','going');
        if(rows){
          const perEventUsers: Record<number, Set<string>> = {};
          rows.forEach(r=>{
            attendanceCounts[r.event_id] = (attendanceCounts[r.event_id]||0)+1;
            const set = perEventUsers[r.event_id] || (perEventUsers[r.event_id]= new Set());
            if(set.size < 5) set.add(r.user_id);
          });
          const uniqueUserIds = Array.from(new Set(Object.values(perEventUsers).flatMap(s=> Array.from(s))));
          if(uniqueUserIds.length){
            const { data: profs } = await supabase.from('profiles').select('id,avatar_url').in('id', uniqueUserIds);
            const pMap: Record<string,{id:string;avatar_url:string|null}> = {}; (profs||[]).forEach(p=> pMap[p.id]={ id:p.id, avatar_url:p.avatar_url });
            Object.entries(perEventUsers).forEach(([eid,set])=>{ avatarSamples[Number(eid)] = Array.from(set).map(id=> pMap[id]).filter(Boolean); });
          }
        }
      }

      // Group by series
      const bySeries = new Map<number, any[]>();
      list.forEach(ev=>{ if(ev.series_id){ const arr = bySeries.get(ev.series_id)||[]; arr.push(ev); bySeries.set(ev.series_id, arr);} });

      const nowTs = now.getTime();
      const next7End = new Date(nowTs + 7*24*60*60*1000);
      const dayLabels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
      const items: RawItem[] = [];

      // Series items
      for(const [sid, evs] of bySeries.entries()){
        const future = evs.filter(e=> new Date(e.start_at) >= now).sort((a,b)=> new Date(a.start_at).getTime()-new Date(b.start_at).getTime());
        const nextEv = future[0]; if(!nextEv) continue;
        const pEvent = evPri.get(nextEv.id)||0; const pSeries = sePri.get(sid)||0;
        const combinedPriority = Math.max(Number(nextEv.sponsored_priority||0), pEvent, pSeries);
        const combinedSponsored = Boolean(nextEv.is_sponsored) || combinedPriority>0;
        const series = seriesMap.get(sid) || { id:sid, title: nextEv.title, venue: nextEv.venue };
        const occurrencesLimited = future.slice(0,8);
        const occurrencesHasMore = future.length > occurrencesLimited.length;
        const occurrences = occurrencesLimited.map(o=> ({ id:o.id, start_at:o.start_at, city:o.city, venue:o.venue, sponsoredPriority: Math.max(evPri.get(o.id)||0, pSeries, Number(o.sponsored_priority||0)), going: goingSet.has(o.id) }));
        // weekly open days summary
        const weekDaysSet = new Set<number>();
        evs.forEach(e=> { const dt = new Date(e.start_at); if(dt>=now && dt<next7End){ weekDaysSet.add((dt.getDay()+6)%7); } });
        const weekDaysLabel = Array.from(weekDaysSet).sort((a,b)=>a-b).map(i=> dayLabels[i]).join(' · ');
        const dist = typeof distanceMap[nextEv.id] === 'number' ? distanceMap[nextEv.id] : undefined;
        items.push({ kind:'series', id:`s-${sid}`, series, nextEv: { ...nextEv, distance_km: dist }, going: goingSet.has(nextEv.id), sponsored: combinedSponsored, sponsoredPriority: combinedPriority, weekDaysLabel, occurrences, occurrencesHasMore, attendeesCount: attendanceCounts[nextEv.id]||0, attendeeAvatars: avatarSamples[nextEv.id]||[] });
      }

  // Standalone events removed in series-only mode

      return items.sort((a,b)=>{
        // sponsor priority desc then start time
        const ap = a.sponsoredPriority||0;
        const bp = b.sponsoredPriority||0;
        if(ap!==bp) return bp-ap;
        const at = new Date(a.nextEv.start_at).getTime();
        const bt = new Date(b.nextEv.start_at).getTime();
        return at-bt;
      });
    }
  });

  useRefetchOnFocus(refetch);
  // Prefer coordinates from profile_locations to drive near-mode automatically
  const { data: profileLoc } = useQuery({
    enabled: !!user?.id,
    queryKey: ['my-profile-location', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profile_locations')
        .select('lat,lng,city_label')
        .eq('user_id', user!.id)
        .maybeSingle();
      return (data as any) || null;
    },
  });

  // Avoid potential render loops by running auto-center only once per session
  const autoCenteredRef = useRef(false);
  useEffect(() => {
    if (autoCenteredRef.current) return;
    if (!profileLoc) return;
    const plat = profileLoc.lat; const plng = profileLoc.lng;
    if (typeof plat === 'number' && typeof plng === 'number') {
      if (centerLat == null || centerLng == null) {
        setLocationCenter(plat, plng, profileLoc.city_label || (authProfile as any)?.city || null);
        setSelectedCityId('all');
        autoCenteredRef.current = true;
      }
    }
  }, [profileLoc?.lat, profileLoc?.lng, centerLat, centerLng]);

  // Realtime: refresh events list when new events are created or updated
  useEffect(() => {
    const ch = supabase
      .channel('events-list-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        // lightweight refetch; could debounce if too chatty
        refetch();
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [refetch]);

  // Manual refresh state to avoid auto-refetch spinner
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  // Toggle going
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const toggleGoing = async (eventId:number, going:boolean) => {
    if(!user){ Alert.alert('Inicia sesión','Necesitas una cuenta.'); return; }
    // Optimistic cache update for this query key
    setToggling(s=> new Set(s).add(eventId));
  const qKey = ['events-full', user.id, selectedCityId, range, centerLat, centerLng, radiusKm, search] as const;
    const prev = qc.getQueryData<any[]>(qKey);
    const optimistic = (items:any[]|undefined) => {
      if(!Array.isArray(items)) return items;
      return items.map(it => {
        if(it.kind==='event' && it.ev.id === eventId) return { ...it, going: !going };
        if(it.kind==='series') {
          // update occurrences and nextEv.going if relevant
          const occs = it.occurrences?.map((o:any)=> o.id===eventId? { ...o, going: !going }: o) || it.occurrences;
          const nextEv = it.nextEv && it.nextEv.id === eventId ? { ...it.nextEv, going: !going } : it.nextEv;
          return { ...it, occurrences: occs, nextEv, going: nextEv? nextEv.going : it.going };
        }
        return it;
      });
    };
    qc.setQueryData(qKey, optimistic(prev));
    try{
      if(going){
        // Leave 'going' via RPC; fallback delete
        const { error: rpcErr } = await supabase.rpc('leave_event', { p_event: eventId });
        if(rpcErr){
          console.warn('[toggleGoing] RPC leave_event error, fallback delete', rpcErr.message);
          const { error: delErr } = await supabase
            .from('event_attendance')
            .delete()
            .match({ event_id:eventId, user_id:user.id });
          if(delErr) throw delErr;
        }
      } else {
        // Join 'going' via RPC; fallback upsert
        const { error: rpcErr } = await supabase.rpc('join_event', { p_event: eventId });
        if(rpcErr){
          console.warn('[toggleGoing] RPC join_event error, fallback upsert', rpcErr.message);
          const { error } = await supabase.from('event_attendance').upsert({ event_id:eventId, user_id:user.id, status:'going' }, { onConflict:'event_id,user_id' });
          if(error) throw error;
        }
      }
      // Quick verification
      const { data: verify } = await supabase.from('event_attendance').select('status').match({ event_id:eventId, user_id:user.id }).maybeSingle();
      console.info('[toggleGoing verify]', eventId, 'after op status=>', verify?.status ?? '(no row)');
      if(going && verify?.status==='going'){
        console.warn('[toggleGoing] row still present after delete. Check RLS: allow DELETE for owner (user_id). Rollback UI');
        // Rollback because you actually didn’t leave
        qc.setQueryData(qKey, prev);
        Alert.alert('No se pudo salir','Tu sesión no tiene permiso para eliminar la asistencia (RLS).');
      } else {
        setTimeout(()=> refetch(), 400);
      }
    }catch(e:any){
      // rollback
      qc.setQueryData(qKey, prev);
      Alert.alert('Error', e.message||'No se pudo actualizar');
    } finally {
      setToggling(s=> { const n=new Set(s); n.delete(eventId); return n; });
    }
  };

  // Filter & sections
  const filtered = useMemo(()=>{
    if(!data) return [] as RawItem[];
    const lower = search.trim().toLowerCase();
    let limit:number|undefined; const now=Date.now();
    if(range==='today'){ const d=new Date(); d.setHours(23,59,59,999); limit=d.getTime(); }
    else if(range==='7'){ limit = now + 7*86400000; }
    else if(range==='30'){ limit = now + 30*86400000; }
    return data.filter(it=>{
      const start = new Date(it.nextEv.start_at).getTime();
      if(limit && start>limit) return false;
      // Only enforce city filter if selectedCityId is a concrete numeric id
      if (typeof selectedCityId === 'number') {
        if (it.nextEv.city_id !== selectedCityId) return false;
      }
      if(lower){
        const blob = `${it.series?.title||''} ${it.series?.venue?.name||''}`.toLowerCase();
        if(!blob.includes(lower)) return false;
      }
      return true;
    });
  },[data, range, search, selectedCityId]);

  const sections = useMemo(()=>{
    if(!filtered.length) return [] as { title:string; data:RawItem[] }[];
    return [{ title:'LOCALES', data: filtered }];
  },[filtered]);

  // Top de hoy (usar items originales filtrando sólo eventos de hoy y ciudad seleccionada)
  const todayTopCandidates = useMemo(()=>{
    if(!data) return [] as RawItem[];
    if(range!=='today') return [];
    const end = new Date(); end.setHours(23,59,59,999); const limit=end.getTime();
    return data.filter(it=>{
      const start = new Date(it.nextEv.start_at).getTime();
      if(start>limit) return false;
      if (typeof selectedCityId === 'number') {
        if (it.nextEv.city_id !== selectedCityId) return false;
      }
      return true;
    });
  },[data, range, selectedCityId]);

  // Realtime refetch on my attendance changes
  useEffect(()=>{
    if(!user) return; const ch = supabase.channel('events-rt-att').on('postgres_changes',{ event:'*', schema:'public', table:'event_attendance', filter:`user_id=eq.${user.id}`}, ()=> refetch()).subscribe(); return ()=> { supabase.removeChannel(ch); };
  },[user?.id, refetch]);

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if(isLoading || error){
    // Minimal skeleton during initial load; discreet error message
    return (
      <Screen style={{ padding:0 }} edges={[]}> 
        <CenterScaffold variant='auth' style={{ paddingHorizontal: 0, maxWidth: 99999 }}>
          <YStack style={{ flex:1, paddingTop:16, paddingHorizontal:16 }}>
            {isLoading ? (
              <>
                {[0,1,2].map(i => (
                  <Fragment key={i}>
                  <YStack style={{ marginBottom:14, backgroundColor: theme.colors.card, borderRadius: theme.radius, padding:16, borderWidth:1, borderColor: theme.colors.border }}>
                    <View style={{ height:16, width:'55%', backgroundColor: theme.colors.border, borderRadius:8, marginBottom:10 }} />
                    <View style={{ height:12, width:'40%', backgroundColor: theme.colors.border, borderRadius:8, marginBottom:6 }} />
                    <View style={{ height:10, width:'30%', backgroundColor: theme.colors.border, borderRadius:8 }} />
                  </YStack>
                  </Fragment>
                ))}
              </>
            ) : (
              <Card>
                <Text style={{ color: theme.colors.text }}>Error al cargar</Text>
              </Card>
            )}
          </YStack>
        </CenterScaffold>
      </Screen>
    );
  }

  return (
    <Screen style={{ padding:0 }} edges={[]}>
      <CenterScaffold variant='auth' style={{ paddingHorizontal: 0, maxWidth: 99999 }}>
        <AnimatedSectionList
          onScroll={onScroll}
          scrollEventThrottle={16}
          sections={sections}
          keyExtractor={(item:RawItem)=> item.id }
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom:56, paddingTop:16 }}
          ListHeaderComponent={
            <YStack gap="$2" style={{ marginBottom:4 }}>
              {/* Título principal: Eventos en XXX */}
              <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight:'800', marginHorizontal:16, marginBottom:8 }}>
                {cityLabel ? `Eventos en ${cityLabel}` : 'Eventos'}
              </Text>
              {/* Búsqueda */}
              <Text style={{ color: theme.colors.textDim, fontSize:14, fontWeight:'600', textTransform:'uppercase', marginHorizontal:16, marginBottom:4 }}>Búsqueda</Text>
              <TextInput
                placeholder="Buscar evento, local o ciudad..."
                value={search}
                onChangeText={setSearch}
                style={{ backgroundColor: theme.colors.card, color: theme.colors.text, padding:12, borderRadius:8, marginHorizontal:16, marginBottom:8, borderWidth:1, borderColor: theme.colors.border }}
                placeholderTextColor={theme.colors.textDim}
              />
              {/* Scope */}
              {/* Contenido: en modo solo series no hay selector */}
              {/* Rango temporal */}
              <Text style={{ color: theme.colors.textDim, fontSize:14, fontWeight:'600', textTransform:'uppercase', marginHorizontal:16, marginBottom:4 }}>Rango temporal</Text>
              <View style={{ paddingHorizontal:16, marginBottom:8 }}>
                <SegmentedControl
                  segments={[
                    { id: 'today', label: 'Hoy' },
                    { id: '7', label: '7 días' },
                    { id: '30', label: '30 días' },
                    { id: 'all', label: 'Todos' },
                  ] as any}
                  selectedId={range as any}
                  onChange={(id)=> setRange(id as any)}
                />
              </View>
              {/* Top de hoy */}
              {range==='today' && <TodayTopSection items={todayTopCandidates} />}
            </YStack>
          }
          renderSectionHeader={({ section }: { section:{ title:string; data:RawItem[] } }) => section.data.length ? (
            <XStack ai="center" px="$4" pt="$5" pb="$1.5" style={{ paddingHorizontal:16, paddingTop:22, paddingBottom:6, flexDirection:'row', alignItems:'center' }}>
              <View style={{ width:6, height:26, borderRadius:3, backgroundColor: theme.colors.primary, marginRight:10 }} />
              <Text style={{ color: theme.colors.text, fontSize:22, fontWeight:'800' }}>{section.title}</Text>
            </XStack>
          ) : null}
          ListEmptyComponent={
            <EmptyState
              title="Sin resultados"
              subtitle="Ajusta los filtros o amplía el rango temporal."
              iconName="calendar-outline"
            />
          }
          renderItem={({ item }: { item:RawItem }) => {
            {
              const s = item as SeriesItem; const next = s.nextEv;
              // Compute price label for the next occurrence (use series next event as reference)
              const priceLabel = ((): string | undefined => {
                const next = s.nextEv;
                if (!next) return undefined;
                const isFree = Boolean(next.is_free);
                if (isFree) return 'Gratis';
                const cents = typeof next.price_cents === 'number' ? next.price_cents : null;
                if (cents === null) return undefined;
                const euros = (cents / 100).toLocaleString('es-ES', { style:'currency', currency: (next.currency||'EUR') });
                return euros;
              })();
              return <LocalCard
                seriesId={s.series.id}
                title={s.series.title}
                venueName={s.series.venue?.name}
                city={next.city}
                venueType={s.series.venue?.venue_type}
                nextDateISO={next.start_at}
                distanceKm={typeof next.distance_km==='number'? next.distance_km : undefined}
                weekDaysLabel={s.weekDaysLabel}
                sponsored={s.sponsored}
                expanded={expandedSeriesIds.has(s.series.id)}
                occurrences={s.occurrences}
                hasMoreOccurrences={s.occurrencesHasMore}
                attendeesCount={s.attendeesCount}
                attendeeAvatars={s.attendeeAvatars}
                going={s.going}
                togglingIds={toggling}
                onToggleExpand={()=> setExpandedSeriesIds(prev=>{ const n=new Set(prev); n.has(s.series.id)? n.delete(s.series.id): n.add(s.series.id); return n; })}
                onToggleGoing={(eid, g)=> toggleGoing(eid, g)}
                onOpenOccurrence={(id)=> {
                  // Find occurrence data
                  const occ = s.occurrences.find((o:any)=> o.id===id) || s.nextEv;
                  const pl = priceLabel;
                  setDetailData({ id, title: s.series.title, startISO: occ.start_at, venueName: occ.venue?.name || s.series.venue?.name, city: occ.city, venueType: s.series.venue?.venue_type, coverUrl: occ.banner_url || s.series.banner_url || null, description: null, priceLabel: pl || null, going: Boolean(occ.going) });
                  setDetailOpen(true);
                }}
                onOpenAttendees={(id)=> openAttendeesSheet(id)}
                onSeeAllOccurrences={(sid)=> router.push(`/events/series/${sid}`)}
                priceLabel={priceLabel}
              />
            }
          }}
        />
        <AttendeesSheet />
        <EventDetailSheet
          open={detailOpen}
          data={detailData}
          onClose={()=> setDetailOpen(false)}
          onToggleGoing={(id, going)=> toggleGoing(id, going)}
          onOpenAttendees={(id)=> openAttendeesSheet(id)}
          onOpenTickets={async (url)=> { try { await WebBrowser.openBrowserAsync(url); } catch {} }}
        />
      </CenterScaffold>
    </Screen>
  );
}

// Top de hoy (reintroducido simplificado)
function TodayTopSection({ items }: { items: RawItem[] }){
  // Placeholder sorts by sponsoredPriority desc then start
  const rows = useMemo(()=>{
    return [...items]
      .sort((a,b)=> (b.sponsoredPriority||0)-(a.sponsoredPriority||0))
      .slice(0,5);
  },[items]);
  if(!rows.length) return null;
  return (
    <YStack style={{ marginVertical:8 }}>
      <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700', marginHorizontal:16, marginBottom:8 }}>Top de hoy</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16 }}>
        {rows.map(r=> (
          <Pressable key={r.id} onPress={()=> {/* detalle desactivado */}}>
            <GlassCard elevationLevel={1} interactive style={{ width:240, marginRight:12 }} padding={12}>
              <Text style={{ color: theme.colors.text, fontWeight:'700' }} numberOfLines={1}>{(r as SeriesItem).series.title}</Text>
              <Text style={{ color: theme.colors.textDim, marginTop:4 }}>{(r as SeriesItem).nextEv.city}</Text>
            </GlassCard>
          </Pressable>
        ))}
      </ScrollView>
    </YStack>
  );
}
