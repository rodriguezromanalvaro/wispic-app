import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, SectionList, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, Card } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { useRefetchOnFocus } from '../../../lib/useRefetchOnFocus';
import { EventCard } from '../../../components/events/EventCard';
import { LocalCard } from '../../../components/events/LocalCard';
import { useFeedScopeStore } from '../../../lib/stores/feedScope';

// Placeholder simplified new layout (WIP) for filters ordering demonstration.
export default function EventsNew(){
  const router = useRouter();
  const { user } = useAuth();
  const { feedScope, setFeedScope } = useFeedScopeStore();
  const [range, setRange] = useState<'today'|'7'|'30'|'all'>('7');
  const [search, setSearch] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<'all'|string>('all');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll:e=>{ scrollY.value = e.contentOffset.y; } });

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey:['events-new', user?.id],
    queryFn: async () => {
      const { data: events, error: e1 } = await supabase.from('events').select('*, venue:venues(*), city:cities(*)').gte('start_at', new Date().toISOString()).order('start_at');
      if(e1) throw e1;
      return events || [];
    }
  });
  useRefetchOnFocus(refetch);

  const filtered = useMemo(()=>{
    if(!data) return [] as any[];
    let limit: number|undefined; const now = Date.now();
    if(range==='today'){ const d=new Date(); d.setHours(23,59,59,999); limit=d.getTime(); }
    else if(range==='7'){ limit= now + 7*86400000; }
    else if(range==='30'){ limit= now + 30*86400000; }
    return data.filter(ev=>{
      const t = new Date(ev.start_at).getTime(); if(limit && t>limit) return false;
      if(selectedCityId!=='all' && ev.city_id!==selectedCityId) return false;
      if(search && !(`${ev.title} ${ev.venue?.name||''} ${ev.city?.name||''}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  },[data, range, selectedCityId, search]);

  if(isLoading) return <Screen><ActivityIndicator style={{ marginTop:80 }} /></Screen>;

  return (
    <Screen style={{ padding:0 }}>
      <TopBar title="Eventos (Nuevo)" hideBack />
      <Animated.View style={{ flex:1 }}>
        <SectionList
          sections={[{ title:'RESULTADOS', data: filtered }]}
          keyExtractor={i=>`e-${i.id}`}
          onScroll={onScroll}
          ListHeaderComponent={
            <View style={{ marginBottom:12 }}>
              {/* Ciudad */}
              <View style={{ paddingHorizontal:16, marginTop:12 }}>
                <Text style={{ color: theme.colors.textDim, fontSize:11, fontWeight:'600', marginBottom:6 }}>CIUDAD</Text>
                <Pressable onPress={()=> setShowCityPicker(v=>!v)} style={{ backgroundColor: theme.colors.card, paddingHorizontal:14, paddingVertical:8, borderRadius:14, borderWidth:1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.text }}>{ selectedCityId==='all' ? 'Todas las ciudades' : selectedCityId }</Text>
                </Pressable>
              </View>
              {/* Rango temporal */}
              <View style={{ paddingHorizontal:16, marginTop:14 }}>
                <Text style={{ color: theme.colors.textDim, fontSize:11, fontWeight:'600', marginBottom:6 }}>RANGO TEMPORAL</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
                  {[{id:'today',label:'Hoy'},{id:'7',label:'7 días'},{id:'30',label:'30 días'},{id:'all',label:'Todo'}].map(r=> (
                    <Pressable key={r.id} onPress={()=> setRange(r.id as any)} style={{ backgroundColor: range===r.id ? theme.colors.primary : theme.colors.card, borderWidth:1, borderColor: range===r.id? theme.colors.primary: theme.colors.border, paddingHorizontal:14, paddingVertical:6, borderRadius:16, marginRight:8, marginBottom:8 }}>
                      <Text style={{ color: range===r.id ? theme.colors.white : theme.colors.text, fontWeight:'600', fontSize:13 }}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {/* Ámbito */}
              <View style={{ paddingHorizontal:16, marginTop:14 }}>
                <Text style={{ color: theme.colors.textDim, fontSize:11, fontWeight:'600', marginBottom:6 }}>ÁMBITO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {[{id:'all',label:'Todo'},{id:'series',label:'Locales'},{id:'events',label:'Eventos'}].map(sc=> (
                    <Pressable key={sc.id} onPress={()=> setFeedScope(sc.id as any)} style={{ backgroundColor: feedScope===sc.id ? theme.colors.primary : theme.colors.card, borderWidth:1, borderColor: feedScope===sc.id? theme.colors.primary: theme.colors.border, paddingHorizontal:14, paddingVertical:6, borderRadius:16, marginRight:8 }}>
                      <Text style={{ color: feedScope===sc.id ? theme.colors.white : theme.colors.text, fontWeight:'600', fontSize:13 }}>{sc.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {/* Búsqueda */}
              <View style={{ paddingHorizontal:16, marginTop:14 }}>
                <Text style={{ color: theme.colors.textDim, fontSize:11, fontWeight:'600', marginBottom:6 }}>BÚSQUEDA</Text>
                <TextInput value={search} onChangeText={setSearch} placeholder="Buscar..." placeholderTextColor={theme.colors.textDim} style={{ backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, paddingHorizontal:12, paddingVertical:10, borderRadius:10, color: theme.colors.text }} />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginHorizontal:16, marginBottom:12 }}>
              <Text style={{ color: theme.colors.text }}>{item.title}</Text>
            </Card>
          )}
        />
      </Animated.View>
    </Screen>
  );
}
