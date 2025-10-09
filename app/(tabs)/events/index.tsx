// FULL ADVANCED RESTORE (series, sponsorship, attendance, Top de hoy) 2025-10-05
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, TextInput, ScrollView, Alert, SectionList } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useEventsFiltersStore } from '../../../lib/stores/eventsFilters';
import { useFeedScopeStore } from '../../../lib/stores/feedScope';
import { useRefetchOnFocus } from '../../../lib/useRefetchOnFocus';
import { LocalCard } from '../../../components/events/LocalCard';
import { EventCard } from '../../../components/events/EventCard';
import { useAttendeesSheetStore } from '../../../lib/stores/attendeesSheet';
import { AttendeesSheet } from '../../../components/events/AttendeesSheet';

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
type EventItem = {
  kind:'event';
  id:string;
  ev:any;
  going:boolean;
  sponsored:boolean;
  sponsoredPriority:number;
  attendeesCount:number;
  attendeeAvatars:any[];
};
type RawItem = SeriesItem | EventItem;

type FilterRange = 'today' | '7' | '30' | 'all';

export default function Events(){
  const router = useRouter();
  const { user } = useAuth();
  const openAttendeesSheet = useAttendeesSheetStore(s=>s.openFor);

  const range = useEventsFiltersStore(s=>s.range);
  const setRange = useEventsFiltersStore(s=>s.setRange);
  const search = useEventsFiltersStore(s=>s.search);
  const setSearch = useEventsFiltersStore(s=>s.setSearch);
  const selectedCityId = useEventsFiltersStore(s=>s.selectedCityId);
  const setSelectedCityId = useEventsFiltersStore(s=>s.setSelectedCityId);
  const feedScope = useFeedScopeStore(s=>s.feedScope);
  const setFeedScope = useFeedScopeStore(s=>s.setFeedScope);
  const [showCityPicker, setShowCityPicker] = useState(false);
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

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey:['events-full', user?.id, selectedCityId, range],
    queryFn: async ()=>{
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
      const minStart = range==='today'? startOfToday : now;
      let query = supabase
        .from('events')
        .select(`*, venue:venues!inner(id,name,venue_type)`) // require venue
        .gte('start_at', minStart.toISOString())
        .order('start_at');
      if(selectedCityId !== 'all') query = query.eq('city_id', selectedCityId);
      const { data: events, error: e1 } = await query; if(e1) throw e1;
      const list = (events||[]) as any[];

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
  items.push({ kind:'series', id:`s-${sid}`, series, nextEv, going: goingSet.has(nextEv.id), sponsored: combinedSponsored, sponsoredPriority: combinedPriority, weekDaysLabel, occurrences, occurrencesHasMore, attendeesCount: attendanceCounts[nextEv.id]||0, attendeeAvatars: avatarSamples[nextEv.id]||[] });
      }

      // Standalone events
      list.forEach(ev=>{ if(ev.series_id) return; const pEv = evPri.get(ev.id)||0; const combinedPriority = Math.max(Number(ev.sponsored_priority||0), pEv); const combinedSponsored = Boolean(ev.is_sponsored)||combinedPriority>0; items.push({ kind:'event', id:`e-${ev.id}`, ev, going: goingSet.has(ev.id), sponsored: combinedSponsored, sponsoredPriority: combinedPriority, attendeesCount: attendanceCounts[ev.id]||0, attendeeAvatars: avatarSamples[ev.id]||[] }); });

      return items.sort((a,b)=>{
        // sponsor priority desc then start time
        const ap = (a.kind==='event'? a.sponsoredPriority : a.sponsoredPriority)||0;
        const bp = (b.kind==='event'? b.sponsoredPriority : b.sponsoredPriority)||0;
        if(ap!==bp) return bp-ap;
        const at = new Date(a.kind==='event'? a.ev.start_at : a.nextEv.start_at).getTime();
        const bt = new Date(b.kind==='event'? b.ev.start_at : b.nextEv.start_at).getTime();
        return at-bt;
      });
    }
  });

  useRefetchOnFocus(refetch);

  // Toggle going
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const toggleGoing = async (eventId:number, going:boolean) => {
    if(!user){ Alert.alert('Inicia sesión','Necesitas una cuenta.'); return; }
    // Optimistic cache update for this query key
    setToggling(s=> new Set(s).add(eventId));
    const qKey = ['events-full', user.id, selectedCityId, range];
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
        // Usar RPC leave_event (SECURITY DEFINER) para asegurar permiso
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
        const { error: rpcErr } = await supabase.rpc('join_event', { p_event: eventId });
        if(rpcErr){
          console.warn('[toggleGoing] RPC join_event error, fallback upsert', rpcErr.message);
          const { error } = await supabase.from('event_attendance').upsert({ event_id:eventId, user_id:user.id, status:'going' }, { onConflict:'event_id,user_id' });
          if(error) throw error;
        }
      }
      // Verificación rápida
      const { data: verify } = await supabase.from('event_attendance').select('status').match({ event_id:eventId, user_id:user.id }).maybeSingle();
      console.info('[toggleGoing verify]', eventId, 'after op status=>', verify?.status ?? '(no row)');
      if(going && verify?.status==='going'){
        console.warn('[toggleGoing] fila sigue presente tras delete. Revisa RLS: permitir DELETE al propietario (user_id). Rollback UI');
        // Rollback porque realmente no saliste
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
      const start = new Date(it.kind==='event'? it.ev.start_at : it.nextEv.start_at).getTime();
      if(limit && start>limit) return false;
      if(selectedCityId!=='all'){
        const cityId = it.kind==='event'? it.ev.city_id : it.nextEv.city_id;
        if(cityId !== selectedCityId) return false;
      }
      if(lower){
        const blob = it.kind==='event' ? `${it.ev.title} ${it.ev.venue?.name||''}`.toLowerCase() : `${it.series?.title||''} ${it.series?.venue?.name||''}`.toLowerCase();
        if(!blob.includes(lower)) return false;
      }
      return true;
    });
  },[data, range, search, selectedCityId]);

  const sections = useMemo(()=>{
    if(!filtered.length) return [] as { title:string; data:RawItem[] }[];
    if(feedScope==='events') return [{ title:'EVENTOS', data: filtered.filter(i=>i.kind==='event') }];
    if(feedScope==='series') return [{ title:'LOCALES', data: filtered.filter(i=>i.kind==='series') }];
    const series = filtered.filter(i=>i.kind==='series');
    const events = filtered.filter(i=>i.kind==='event');
    const out: { title:string; data:RawItem[] }[] = [];
    if(series.length) out.push({ title:'LOCALES', data:series });
    if(events.length) out.push({ title:'EVENTOS', data:events });
    return out;
  },[filtered, feedScope]);

  // Top de hoy (usar items originales filtrando sólo eventos de hoy y ciudad seleccionada)
  const todayTopCandidates = useMemo(()=>{
    if(!data) return [] as RawItem[];
    if(range!=='today') return [];
    const end = new Date(); end.setHours(23,59,59,999); const limit=end.getTime();
    return data.filter(it=>{
      const start = new Date(it.kind==='event'? it.ev.start_at : it.nextEv.start_at).getTime();
      if(start>limit) return false;
      if(selectedCityId!=='all'){
        const cityId = it.kind==='event'? it.ev.city_id : it.nextEv.city_id;
        if(cityId!==selectedCityId) return false;
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
    return <Screen style={{ padding:0 }}>
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', paddingTop:16 }}>
        {isLoading ? <ActivityIndicator color={theme.colors.primary}/> : <Text style={{ color: theme.colors.text }}>Error al cargar</Text>}
      </View>
    </Screen>;
  }

  return (
    <Screen style={{ padding:0 }}>
      <AnimatedSectionList
        onScroll={onScroll}
        scrollEventThrottle={16}
        sections={sections}
        keyExtractor={(item:RawItem)=> item.id }
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ paddingBottom:56, paddingTop:16 }}
        ListHeaderComponent={
          <View style={{ marginBottom:4 }}>
            {/* Ciudad */}
            <Text style={{ color: theme.colors.textDim, fontSize:14, fontWeight:'600', textTransform:'uppercase', marginHorizontal:16, marginBottom:4 }}>Ciudad</Text>
            <View style={{ paddingHorizontal:16, marginBottom:8, flexDirection:'row', alignItems:'center' }}>
              <Pressable onPress={()=> setShowCityPicker(v=>!v)} style={{ backgroundColor: theme.colors.card, borderRadius:16, paddingHorizontal:12, paddingVertical:8, marginRight:8, borderWidth:1, borderColor: theme.colors.border }}>
                <Text style={{ color: theme.colors.text }}>{ selectedCityId==='all'? 'Todas las ciudades' : (cities?.find(c=>c.id===selectedCityId)?.name || 'Ciudad') }</Text>
              </Pressable>
              {selectedCityId!=='all' && (
                <Pressable onPress={()=> setSelectedCityId('all')}><Text style={{ color: theme.colors.primary }}>Limpiar</Text></Pressable>
              )}
            </View>
            {showCityPicker && (
              <View style={{ backgroundColor: theme.colors.card, marginHorizontal:16, borderRadius:10, padding:8, maxHeight:240, borderWidth:1, borderColor: theme.colors.border }}>
                <ScrollView>
                  <Pressable onPress={()=> { setSelectedCityId('all'); setShowCityPicker(false); }} style={{ padding:8 }}><Text style={{ color: theme.colors.text }}>Todas</Text></Pressable>
                  {(cities||[]).map(c=> (
                    <Pressable key={c.id} onPress={()=> { setSelectedCityId(c.id); setShowCityPicker(false); }} style={{ padding:8 }}>
                      <Text style={{ color: theme.colors.text }}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
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
            <Text style={{ color: theme.colors.textDim, fontSize:14, fontWeight:'600', textTransform:'uppercase', marginHorizontal:16, marginBottom:4 }}>Contenido</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16, marginBottom:8 }} contentContainerStyle={{ alignItems:'center' }}>
              {[{id:'all',label:'Todo'},{id:'series',label:'Locales'},{id:'events',label:'Eventos'}].map(sc=> (
                <Pressable key={sc.id} onPress={()=> setFeedScope(sc.id as any)} style={{ backgroundColor: feedScope===sc.id? theme.colors.primary : theme.colors.card, paddingHorizontal:14, paddingVertical:6, borderRadius:18, marginRight:8, borderWidth:1, borderColor: feedScope===sc.id? theme.colors.primary: theme.colors.border }}>
                  <Text style={{ color: feedScope===sc.id? theme.colors.white: theme.colors.text }}>{sc.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Rango temporal */}
            <Text style={{ color: theme.colors.textDim, fontSize:14, fontWeight:'600', textTransform:'uppercase', marginHorizontal:16, marginBottom:4 }}>Rango temporal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16, marginBottom:8 }} contentContainerStyle={{ alignItems:'center' }}>
              {(['today','7','30','all'] as FilterRange[]).map(r=> (
                <Pressable key={r} onPress={()=> setRange(r)} style={{ backgroundColor: range===r? theme.colors.primary: theme.colors.card, paddingHorizontal:12, paddingVertical:6, borderRadius:16, marginRight:8, borderWidth:1, borderColor: range===r? theme.colors.primary: theme.colors.border }}>
                  <Text style={{ color: range===r? theme.colors.white: theme.colors.text }}>{ r==='today'? 'Hoy' : r==='7'? '7 días' : r==='30'? '30 días' : 'Todos' }</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Top de hoy */}
            {range==='today' && <TodayTopSection items={todayTopCandidates} />}
            {/* Etiqueta ciudad */}
            {selectedCityId!=='all' && (
              <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700', marginHorizontal:16, marginTop:4, marginBottom:4 }}>En {cities?.find(c=>c.id===selectedCityId)?.name}</Text>
            )}
          </View>
        }
        renderSectionHeader={({ section }: { section:{ title:string; data:RawItem[] } }) => section.data.length ? (
          <View style={{ paddingHorizontal:16, paddingTop:22, paddingBottom:6, flexDirection:'row', alignItems:'center' }}>
            <View style={{ width:6, height:26, borderRadius:3, backgroundColor: theme.colors.primary, marginRight:10 }} />
            <Text style={{ color: theme.colors.text, fontSize:22, fontWeight:'800' }}>{section.title}</Text>
          </View>
        ) : null}
        ListEmptyComponent={
          <Card style={{ margin:24 }}>
            <Text style={{ color: theme.colors.text, fontWeight:'700', marginBottom:4 }}>Sin resultados</Text>
            <Text style={{ color: theme.colors.textDim }}>Ajusta los filtros o amplía el rango temporal.</Text>
          </Card>
        }
        renderItem={({ item }: { item:RawItem }) => {
          if(item.kind==='series'){
            const s = item as SeriesItem; const next = s.nextEv;
            return <LocalCard
              seriesId={s.series.id}
              title={s.series.title}
              venueName={s.series.venue?.name}
              city={next.city}
              venueType={s.series.venue?.venue_type}
              nextDateISO={next.start_at}
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
              onOpenOccurrence={(id)=> {/* detalle desactivado */}}
              onOpenAttendees={(id)=> openAttendeesSheet(id)}
              onSeeAllOccurrences={(sid)=> router.push(`/events/series/${sid}`)}
            />
          }
            const e = item as EventItem;
            return <EventCard
              id={e.ev.id}
              title={e.ev.title}
              startISO={e.ev.start_at}
              venueName={e.ev.venue?.name}
              city={e.ev.city}
              venueType={e.ev.venue?.venue_type}
              attendeesCount={e.attendeesCount}
              attendeeAvatars={e.attendeeAvatars}
              going={e.going}
              sponsored={e.sponsored}
              toggling={toggling.has(e.ev.id)}
              onToggleGoing={(id, g)=> toggleGoing(id, g)}
              onOpen={(id)=> {/* detalle desactivado */}}
              onOpenAttendees={(id)=> openAttendeesSheet(id)}
            />
        }}
      />
      <AttendeesSheet />
    </Screen>
  );
}

// Top de hoy (reintroducido simplificado)
function TodayTopSection({ items }: { items: RawItem[] }){
  // We could enrich with presence RPC here; placeholder sorts by sponsoredPriority desc then start
  const rows = useMemo(()=>{
    return [...items]
      .filter(it=> it.kind==='event')
      .sort((a,b)=> (b.sponsoredPriority||0)-(a.sponsoredPriority||0))
      .slice(0,5);
  },[items]);
  if(!rows.length) return null;
  return (
    <View style={{ marginVertical:8 }}>
      <Text style={{ color: theme.colors.text, fontSize:18, fontWeight:'700', marginHorizontal:16, marginBottom:8 }}>Top de hoy</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16 }}>
        {rows.map(r=> (
          <Pressable key={r.id} onPress={()=> {/* detalle desactivado */}}>
            <Card style={{ width:240, marginRight:12 }}>
              <Text style={{ color: theme.colors.text, fontWeight:'700' }} numberOfLines={1}>{(r as EventItem).ev.title}</Text>
              <Text style={{ color: theme.colors.textDim, marginTop:4 }}>{(r as EventItem).ev.city}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
