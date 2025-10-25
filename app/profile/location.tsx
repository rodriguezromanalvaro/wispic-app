import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';
import { Screen, Card } from '../../components/ui';
import { haversineKm } from '../../lib/location/geo';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { useProfileMutations } from '../../features/profile/hooks/useProfileMutations';
import Constants from 'expo-constants';
import { useEventsFiltersStore } from '../../lib/stores/eventsFilters';

type NearbyEntry = { label:string; country?:string|null; distanceKm:number; lat:number; lng:number };
type SearchEntry = { label:string; placeId?:string; lat?:number; lng?:number };

export default function ProfileLocationSelect(){
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const mutations = useProfileMutations(profile?.id);
  const [coords, setCoords] = useState<{ lat:number; lng:number }|null>(null);
  const [search, setSearch] = useState('');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearby, setNearby] = useState<NearbyEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const placesKey = (Constants?.expoConfig as any)?.extra?.placesApiKey || (Constants?.manifest as any)?.extra?.placesApiKey;
  const [sessionToken, setSessionToken] = useState<string>('');
  const setLocationCenter = useEventsFiltersStore(s=>s.setLocationCenter);
  const setSelectedCityId = useEventsFiltersStore(s=>s.setSelectedCityId);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try{
        const ExpoLocation = await import('expo-location');
        const perm = await ExpoLocation.getForegroundPermissionsAsync();
        let status = perm.status;
        if(status!=='granted'){
          const req = await ExpoLocation.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if(status==='granted'){
          const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          if(mounted) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      }catch{}
    })();
    return ()=>{ mounted=false; };
  },[]);

  // Utility: displace lat/lng by bearing (deg) and distance (km)
  function move(lat:number, lng:number, bearingDeg:number, km:number){
    const R = 6371; const br = bearingDeg*Math.PI/180; const d = km/R;
    const lat1 = lat*Math.PI/180; const lng1 = lng*Math.PI/180;
    const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(br));
    const lng2 = lng1 + Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
    return { lat: lat2*180/Math.PI, lng: lng2*180/Math.PI };
  }

  // Run limited concurrency tasks
  async function runLimited<T>(tasks: Array<() => Promise<T>>, limit = 4): Promise<T[]> {
    const results: T[] = [];
    let i = 0; let running = 0; let resolveAll: (v:T[])=>void; let rejectAll:(e:any)=>void;
    const done = new Promise<T[]>((res, rej)=> { resolveAll = res; rejectAll = rej; });
    function next(){
      if(i >= tasks.length && running === 0){ resolveAll(results); return; }
      while(running < limit && i < tasks.length){
        const idx = i++; running++;
        tasks[idx]().then((r)=>{ results[idx]=r; }).catch(()=>{}).finally(()=>{ running--; next(); });
      }
    }
    next();
    return done;
  }

  // Build nearby cities purely from reverse geocoding around the user's location
  useEffect(()=>{
    if(!coords) return;
    let stopped = false;
    (async()=>{
      setLoadingNearby(true);
      try{
        const ExpoLocation = await import('expo-location');
        const bearings = [0,45,90,135,180,225,270,315];
        const rings = [8, 20, 40, 75]; // km, menos llamadas para ir rápido
        const outMap = new Map<string,NearbyEntry>();
        const target = 8;
        // Always include current city first
        try{
          const base = await ExpoLocation.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
          const item:any = base?.[0] || {};
          const city = (item.city || item.subregion || item.region || item.district || '').toString();
          const country = (item.country || '').toString();
          if(city){
            const key = `${city}||${country}`;
            outMap.set(key, { label: city, country, distanceKm: 0, lat: coords.lat, lng: coords.lng });
          }
        }catch{}
        for(const r of rings){
          if(stopped) return;
          // Prepare tasks for this ring
          const points = bearings.map(b=> move(coords.lat, coords.lng, b, r));
          const tasks = points.map(p => async ()=>{
            try{
              const rr = await ExpoLocation.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
              const item:any = rr?.[0] || {};
              const city = (item.city || item.subregion || item.region || item.district || '').toString();
              const country = (item.country || '').toString();
              if(city){
                const d = haversineKm({ lat: coords.lat, lng: coords.lng }, { lat: p.lat, lng: p.lng });
                const key = `${city}||${country}`;
                const prev = outMap.get(key);
                if(!prev || d < prev.distanceKm){ outMap.set(key, { label: city, country, distanceKm: d, lat: p.lat, lng: p.lng }); }
              }
            }catch{}
            return null as any;
          });
          await runLimited(tasks, 4);
          if(outMap.size >= target) break; // early stop cuando ya tenemos suficientes
        }
        const all = Array.from(outMap.values()).sort((a,b)=> a.distanceKm-b.distanceKm);
        setNearby(all.slice(0, target));
      } finally {
        setLoadingNearby(false);
      }
    })();
    return ()=>{ stopped = true; };
  },[coords?.lat, coords?.lng]);

  // Session token for Google autocomplete
  useEffect(()=>{ setSessionToken(Math.random().toString(36).slice(2)+Date.now().toString(36)); },[]);

  // Search: prefer Google Places Autocomplete with location bias; fallback to device geocoder
  useEffect(()=>{
    if(debounceRef.current){ clearTimeout(debounceRef.current); debounceRef.current = null; }
    const q = search.trim();
    if(!q){ setSearchResults([]); setSearching(false); return; }
    debounceRef.current = setTimeout(async()=>{
      try{
        setSearching(true);
        if(placesKey){
          const locBias = coords ? `&location=${coords.lat},${coords.lng}&radius=${Math.round(100*1000)}` : '';
          const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)${locBias}&language=es&sessiontoken=${encodeURIComponent(sessionToken)}&key=${encodeURIComponent(placesKey)}`;
          const res = await fetch(url); const json = await res.json();
          const preds = Array.isArray(json?.predictions)? json.predictions:[];
          setSearchResults(preds.slice(0,10).map((p:any)=> ({ label: p.description, placeId: p.place_id })));
        } else {
          const ExpoLocation = await import('expo-location');
          const results = await ExpoLocation.geocodeAsync(q);
          const mapped = (results||[]).map((r:any)=>{
            const parts:string[]=[]; const n=(r.name||r.city||r.subregion||r.region||'').toString().trim(); const c=(r.country||'').toString().trim(); if(n) parts.push(n); if(c) parts.push(c); return { label: parts.filter(Boolean).join(', ') || q, lat: r.latitude, lng: r.longitude } as SearchEntry;
          });
          const seen=new Set<string>(); setSearchResults(mapped.filter(m=>{ if(seen.has(m.label)) return false; seen.add(m.label); return true; }).slice(0,10));
        }
      }catch{ setSearchResults([]); }
      finally{ setSearching(false); }
    }, 300);
    return ()=>{ if(debounceRef.current){ clearTimeout(debounceRef.current); debounceRef.current=null; } };
  },[search, coords?.lat, coords?.lng, placesKey, sessionToken]);

  const selectEntry = async (entry: NearbyEntry | SearchEntry)=>{
    const label = entry.label;
    if(!label) return;

    let lat = (entry as any).lat as number | undefined;
    let lng = (entry as any).lng as number | undefined;

    // If no coords yet and we have a placeId, fetch details
    if((lat==null || lng==null) && (entry as SearchEntry).placeId && placesKey){
      try{
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent((entry as SearchEntry).placeId!)}&fields=geometry&language=es&sessiontoken=${encodeURIComponent(sessionToken)}&key=${encodeURIComponent(placesKey)}`;
        const res = await fetch(url); const json = await res.json();
        const loc = json?.result?.geometry?.location;
        if(loc && typeof loc.lat==='number' && typeof loc.lng==='number'){ lat = loc.lat; lng = loc.lng; }
      }catch{}
    }
    // Fallback: try device geocode
    if((lat==null || lng==null)){
      try{ const ExpoLocation = await import('expo-location'); const r = await ExpoLocation.geocodeAsync(label); const g = r?.[0]; if(g){ lat = g.latitude; lng = g.longitude; } }catch{}
    }

    // Always sync both: Events geo filters and Profile city label
    if(typeof lat==='number' && typeof lng==='number'){
      setLocationCenter(lat, lng, label);
      setSelectedCityId('all');
    }
    if(profile?.id){ try{ mutations.updateBasics.mutate({ city: label }); }catch{} }
    router.back();
  };

  return (
    <Screen style={{ padding:0 }} edges={[]}> 
      {/* Header fixed */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 8, flexDirection:'row', alignItems:'center', gap: 8 }}>
        <Pressable onPress={()=> router.back()} style={{ padding:8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight:'800' }}>Selecciona tu ciudad</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal:16, marginBottom:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, borderRadius: 16 }}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textDim} style={{ marginRight:8 }} />
          <TextInput
            placeholder="Buscar por ciudad"
            placeholderTextColor={theme.colors.textDim}
            value={search}
            onChangeText={setSearch}
            style={{ flex:1, color: theme.colors.text }}
          />
        </View>
      </View>

      {loadingNearby ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
          {/* Filtered results */}
          {!!search && (
            <View style={{ paddingHorizontal:16, paddingTop:8 }}>
              <Text style={{ color: theme.colors.text, fontSize:13, fontWeight:'700', marginBottom:8 }}>Resultados</Text>
              {searching && (
                <View style={{ paddingVertical:8 }}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              )}
              {!searching && searchResults.map((c, idx)=> (
                <Pressable key={`f-${idx}`} onPress={()=> selectEntry(c)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:10 }}>
                  <Ionicons name="location-outline" size={18} color={theme.colors.textDim} style={{ width:26 }} />
                  <Text style={{ color: theme.colors.text, fontSize:16, fontWeight:'700' }}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Nearby */}
          {!!coords && !!nearby.length && !search && (
            <View style={{ paddingHorizontal:16, paddingTop:8 }}>
              <Text style={{ color: theme.colors.text, fontSize:13, fontWeight:'700', marginBottom:8 }}>Ciudades cercanas</Text>
              {nearby.map((c,idx)=> (
                <Pressable key={`n-${idx}`} onPress={()=> selectEntry(c)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:10 }}>
                  <Ionicons name="location-outline" size={18} color={theme.colors.textDim} style={{ width:26 }} />
                  <Text style={{ color: theme.colors.text, fontSize:16, fontWeight:'700' }}>{c.label}</Text>
                  {!!c.country && <Text style={{ color: theme.colors.textDim, marginLeft:6 }}>, {c.country}</Text>}
                  <Text style={{ color: theme.colors.textDim, marginLeft:6, fontSize:12 }}>{c.distanceKm < 10 ? c.distanceKm.toFixed(1) : Math.round(c.distanceKm)} km</Text>
                </Pressable>
              ))}
            </View>
          )}

          {!loadingNearby && !nearby.length && !search && (
            <Card style={{ margin:16 }}>
              <Text style={{ color: theme.colors.text }}>No hay ciudades disponibles.</Text>
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
