import { useEffect, useRef, useState } from 'react';


import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';

import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Card } from 'components/ui';
import { useProfile } from 'features/profile/hooks/useProfile';
import { useProfileMutations } from 'features/profile/hooks/useProfileMutations';
import { haversineKm } from 'lib/location/geo';
import { useEventsFiltersStore } from 'lib/stores/eventsFilters';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

type NearbyEntry = { label:string; country?:string|null; distanceKm:number; lat:number; lng:number };
type SearchEntry = { label:string; placeId?:string; lat?:number; lng?:number };

export default function ProfileLocationSelect(){
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const mutations = useProfileMutations(profile?.id);
  const { user } = useAuth();
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
    let i = 0; let running = 0; let resolveAll!: (v:T[])=>void;
    const done = new Promise<T[]>((res)=> { resolveAll = res; });
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

    // Synchronize UI filters for Events (label only) and persist profile location
    if(typeof lat==='number' && typeof lng==='number'){
      setLocationCenter(lat, lng, label);
      setSelectedCityId('all');
  // Persist in profile_locations for global proximity (via RPC)
  try {
    const { error: locErr } = await supabase.rpc('set_profile_location', { p_user: user!.id, p_lat: lat, p_lng: lng, p_label: label, p_place_id: (entry as any).placeId || null, p_country_code: null });
    if (locErr) {
      const msg = String(locErr.message||'');
      if (msg.includes('Could not find the function') || msg.includes('schema cache') || msg.includes('42883')) {
        await supabase.from('profile_locations').upsert({ user_id: user!.id, lat, lng, city_label: label, place_id: (entry as any).placeId || null, country_code: null }, { onConflict: 'user_id' });
      }
    }
  } catch {}
      // Find nearest city in our cities table to set profiles.city_id
      try {
        let cityId: number | null = null;
        // Try by bounding box to limit results then pick nearest client-side
        const latDelta = 1.0; // ~111km
        const lngDelta = 1.0; // ~111km near equator
        const { data: cityRows } = await supabase
          .from('cities')
          .select('id, name, country, lat, lng')
          .gte('lat', lat - latDelta).lte('lat', lat + latDelta)
          .gte('lng', lng - lngDelta).lte('lng', lng + lngDelta)
          .limit(200);
        if (Array.isArray(cityRows) && cityRows.length > 0) {
          let best: any = null; let bestD = Number.POSITIVE_INFINITY;
          for (const c of cityRows) {
            if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
            const d = haversineKm({ lat, lng }, { lat: c.lat, lng: c.lng });
            if (d < bestD) { bestD = d; best = c; }
          }
          if (best && typeof best.id === 'number') cityId = best.id;
        }
        // Fallback: try ilike by label if bbox search failed
        if (!cityId) {
          const { data: byName } = await supabase
            .from('cities')
            .select('id')
            .ilike('name', label.split(',')[0].trim())
            .limit(1)
            .maybeSingle();
          if (byName && typeof (byName as any).id === 'number') cityId = (byName as any).id;
        }
        // Save both: normalized label and city_id
        if (profile?.id) {
          try {
            await mutations.updateBasics.mutateAsync({ city: label, city_id: cityId });
          } catch (e:any) {
            // Fallback: update directly by auth user id if profile.id not ready yet
            console.warn('[profile/location] updateBasics mutate error, fallback direct update:', e?.message||e);
            await supabase.from('profiles').update({ city: label, city_id: cityId }).eq('id', user!.id);
          }
        } else {
          // Profile not loaded yet; direct update using auth user id
          try {
            await supabase.from('profiles').update({ city: label, city_id: cityId }).eq('id', user!.id);
          } catch (e:any) {
            console.warn('[profile/location] direct update failed:', e?.message||e);
          }
        }
        // Ensure profile screen reflects the new city immediately
        await queryClient.invalidateQueries({ queryKey: ['profile:full', user!.id] });
      } catch {}
    }
  // Invalidate location query so Classic reloads immediately
  queryClient.invalidateQueries({ queryKey: ['my-profile-location', user?.id] });
  queryClient.invalidateQueries({ queryKey: ['classic-swipe-profiles', user?.id] });
  router.replace('/(tabs)/profile');
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

      {/* Use current location quick action */}
      {!!coords && (
        <View style={{ paddingHorizontal:16, marginBottom:8 }}>
          <Pressable
            onPress={async ()=>{
              try{
                // Resolve and set profile city via RPC (server-side nearest)
                const { data: ok, error: rpcErr } = await supabase.rpc('set_profile_city_by_coords', { p_user: user!.id, p_lat: coords.lat, p_lng: coords.lng });
                if (rpcErr) throw rpcErr; // tolerate void/nullable return types as success
                // Persist coordinates in profile_locations as source of truth
                try {
                  const { error: locErr } = await supabase.rpc('set_profile_location', { p_user: user!.id, p_lat: coords.lat, p_lng: coords.lng, p_label: null, p_place_id: null, p_country_code: null });
                  if (locErr) {
                    const msg = String(locErr.message||'');
                    if (msg.includes('Could not find the function') || msg.includes('schema cache') || msg.includes('42883')) {
                      await supabase.from('profile_locations').upsert({ user_id: user!.id, lat: coords.lat, lng: coords.lng, city_label: null, place_id: null, country_code: null }, { onConflict: 'user_id' });
                    }
                  }
                } catch {}
                // Optionally, set events filter label (UI only)
                setLocationCenter(null, null, null);
                setSelectedCityId('all');
                // Refresh local profile cache
                await queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
                router.replace('/(tabs)/profile');
              } catch (e:any) {
                // Fallback: reverse geocode to a label and reuse existing handler
                try{
                  const ExpoLocation = await import('expo-location');
                  const rev = await ExpoLocation.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
                  const first = rev?.[0];
                  const label = ((first?.city)||first?.subregion||first?.region||'').toString();
                  if(label){ await selectEntry({ label, lat: coords.lat, lng: coords.lng }); return; }
                }catch{}
              }
            }}
            style={{ backgroundColor: theme.colors.card, borderRadius:12, paddingHorizontal:12, paddingVertical:10, borderWidth:1, borderColor: theme.colors.border, flexDirection:'row', alignItems:'center', gap:8 }}
          >
            <Ionicons name="navigate" size={18} color={theme.colors.text} />
            <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Usar mi ubicación actual</Text>
          </Pressable>
        </View>
      )}

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
