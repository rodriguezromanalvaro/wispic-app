import React, { useEffect, useMemo, useState } from 'react';

import { View, Text, Pressable, ActivityIndicator, Platform, ScrollView, Modal, Animated } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import ConfettiCannon from 'react-native-confetti-cannon';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, P, TextInput, Button, Card, StickyFooterCTA } from 'components/ui';
import OwnerHero from 'features/owner/ui/OwnerHero';
import { RequireOwnerReady } from 'features/owner/RequireOwnerReady';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { OwnerHeader } from 'features/owner/ui/OwnerHeader';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useToast } from 'lib/toast';
import { useAuth } from 'lib/useAuth';

type VenueRow = { id: number; name: string; city_id: number; avatar_url?: string | null };

export default function OwnerEvents() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  // DateTimePicker is a native module; requires Dev Client / build

  const [loadingVenue, setLoadingVenue] = useState(true);
  const [venue, setVenue] = useState<VenueRow | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showCongrats, setShowCongrats] = useState(false);

  // Recurrence state
  const [isRecurring] = useState(true); // simplified: only weekly recurring
  const [recDays, setRecDays] = useState<Set<number>>(new Set()); // 0=Mon..6=Sun
  const [recStartDate, setRecStartDate] = useState<string>(''); // YYYY-MM-DD (no UI; fallback to hoy)
  const [recEndDate, setRecEndDate] = useState<string>(''); // '' or YYYY-MM-DD (sin UI)
  const [recStartTime, setRecStartTime] = useState<string>('');
  const [recEndTime, setRecEndTime] = useState<string>('');
  // Horizon is fixed to 1 week (7 days) per spec; not exposed in UI
  const recHorizon = 1;
  // Native time pickers state (iOS inline; Android dialog)
  const [showRecStartTimePicker, setShowRecStartTimePicker] = useState(false);
  const [showRecEndTimePicker, setShowRecEndTimePicker] = useState(false);
  // Scroll-driven background flair
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const tzid = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch { return 'Europe/Madrid'; }
  })();

  const toggleRecDay = (d:number) => {
    setRecDays(prev => { const nx = new Set(prev); if (nx.has(d)) nx.delete(d); else nx.add(d); return nx; });
  };

  function toDateParts(str: string): { y:number;m:number;d:number } | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const [y,m,d] = str.split('-').map(x=>parseInt(x,10));
    return { y, m, d };
  }

  function toTimeParts(str: string): { H:number; M:number } | null {
    if (!/^\d{2}:\d{2}$/.test(str)) return null;
    const [H,M] = str.split(':').map(x=>parseInt(x,10));
    return { H, M };
  }

  // Client-side preview removed per simplification

  // Load current owner's venue
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      try {
        setLoadingVenue(true);
        const { data: membership, error: mErr } = await supabase
          .from('venue_staff')
          .select('venue_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();
        if (mErr) throw mErr;
        const vId = membership?.venue_id as number | undefined;
        if (!vId) { if (alive) setVenue(null); return; }
        const { data: vRow, error: vErr } = await supabase
          .from('venues')
          .select('id,name,city_id,avatar_url')
          .eq('id', vId)
          .maybeSingle();
        if (vErr) throw vErr;
        if (alive) setVenue(vRow as any);
      } catch {
        if (alive) setVenue(null);
      } finally {
        if (alive) setLoadingVenue(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // One-off helpers removed in simplified weekly-only flow

  const canSubmit = useMemo(() => {
    if (!venue) return false;
    if (!title.trim()) return false;
    if (!(recStartTime && /^\d{2}:\d{2}$/.test(recStartTime))) return false;
    if (recDays.size===0) return false;
    return true;
  }, [venue, title, recStartTime, recDays.size]);

  const handleCreate = async () => {
    if (!canSubmit || !venue) return;
    try {
      setSubmitting(true);
      // Recurring weekly series via RPC (only path)
      const defaults: any = {
        // Reuse venue avatar as cover for created events
        cover_url: venue.avatar_url || null,
        status: 'published',
      };
      const days = Array.from(recDays.values()).sort((a,b)=>a-b);
      // Compute start date fallback (today) when not provided
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth()+1).padStart(2,'0');
      const dd = String(now.getDate()).padStart(2,'0');
      const startDateStr = recStartDate && /^\d{4}-\d{2}-\d{2}$/.test(recStartDate) ? recStartDate : `${yyyy}-${mm}-${dd}`;
      const { error: rpcErr } = await supabase.rpc('create_or_update_series', {
        p_series_id: null,
        p_venue_id: venue.id,
        p_title: title.trim(),
        p_days: days,
        p_start_date: startDateStr,
        p_end_date: null,
        p_start_time: recStartTime+':00',
        p_end_time: recEndTime ? recEndTime+':00' : null,
        p_tzid: tzid,
        p_horizon_weeks: recHorizon, // fixed to 1 week per spec
        p_defaults: defaults,
      });
  if (rpcErr) throw rpcErr;
  toast.show('Serie publicada', 'success');
      try { qc.invalidateQueries({ queryKey: ['events-full'] }); } catch {}
      try { qc.invalidateQueries({ queryKey: ['owner-series'] }); } catch {}
      try { qc.invalidateQueries({ queryKey: ['owner-events-list', venue.id] }); } catch {}
      try { qc.invalidateQueries({ queryKey: ['owner-next-event', venue.id] }); } catch {}
      // Reset key fields
      setTitle(''); setRecDays(new Set()); setRecStartDate(''); setRecEndDate(''); setRecStartTime(''); setRecEndTime('');
      setShowCongrats(true);
    } catch (e:any) {
      const msg = e?.message || 'No se pudo crear el evento';
      toast.show(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // No one-off quick fill needed in simplified flow

  return (
    <RequireOwnerReady>
      <OwnerBackground>
      <Screen style={{ backgroundColor: 'transparent' }}>
        {/* Scroll-reactive background glaze */}
        <Animated.View pointerEvents="none" style={{ position:'absolute', left:0, right:0, top:0, height:260, opacity: scrollY.interpolate({ inputRange:[0, 120, 260], outputRange:[1, 0.5, 0], extrapolate:'clamp' }) }}>
          <LinearGradient colors={theme.gradients.brandSoft as any} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position:'absolute', left:0, right:0, bottom:0, height:240, opacity: scrollY.interpolate({ inputRange:[0, 200, 480], outputRange:[0.15, 0.35, 0.55], extrapolate:'clamp' }) }}>
          <LinearGradient colors={theme.gradients.brand as any} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1, opacity: 0.15 }} />
        </Animated.View>

  <CenterScaffold transparentBg variant="minimal">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 8 }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <OwnerHero
            title="Crear eventos"
            subtitle="Crea una serie semanal. Solo necesitas título, días y horas. Nosotros publicamos los próximos 7 días."
          />

          {/* Consejo breve */}
          <Card variant="glass" gradientBorder>
            <Text style={{ color: theme.colors.text, fontWeight: '800' }}>✨ Consejo</Text>
            <Text style={{ color: theme.colors.subtext, marginTop: 6 }}>Nosotros rellenamos automáticamente las próximas fechas (7 días vista).</Text>
          </Card>

          {/* Detalles básicos */}
          <Card variant="glass" gradientBorder>
          {loadingVenue ? (
            <View style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={theme.colors.primary} />
              <P>Buscando tu local…</P>
            </View>
          ) : venue ? (
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <View style={{ backgroundColor: theme.colors.primary, width: 8, height: 8, borderRadius: 4 }} />
              <Text style={{ color: theme.colors.subtext }}>Local:</Text>
              <Text style={{ color: theme.colors.text, fontWeight:'700' }}>{venue.name}</Text>
            </View>
          ) : (
            <P dim>No encontramos tu local. Asegúrate de completar el onboarding.</P>
          )}

          <View style={{ height: 8 }} />

          <P bold>Título</P>
          <TextInput value={title} onChangeText={setTitle} placeholder="Ej: Fiesta de los 80s" />

          <View style={{ height: 12 }} />

          {/* Weekly recurring only */}
          <>
            <P bold>Patrón semanal</P>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
              {['L','M','X','J','V','S','D'].map((lbl, idx) => (
                <Pressable key={idx} onPress={()=>toggleRecDay(idx)} style={{ paddingHorizontal:12,paddingVertical:8, borderRadius:999, borderWidth:1, borderColor: recDays.has(idx)? theme.colors.primary: theme.colors.border, backgroundColor: recDays.has(idx)? theme.colors.primary: 'transparent' }}>
                  <Text style={{ color: recDays.has(idx)? theme.colors.primaryText: theme.colors.text, fontWeight:'700' }}>{lbl}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: theme.colors.subtext, marginTop: 6 }}>Puedes elegir uno o varios días.</Text>
            <View style={{ height: 8 }} />
            {/* Sin fecha desde/hasta: generamos automáticamente 7 días vista */}
            <P bold>Hora inicio / fin</P>
            <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
              <View style={{ width:140, position:'relative' }}>
                <TextInput value={recStartTime} onChangeText={setRecStartTime} placeholder="HH:mm" />
                {Platform.OS === 'ios' && (
                  <Pressable onPress={() => setShowRecStartTimePicker(true)} style={{ position:'absolute', left:0,right:0,top:0,bottom:0 }} />
                )}
                {Platform.OS === 'android' && (
                  <Pressable onPress={() => {
                    try {
                      const base = new Date(1970,0,1, Number(recStartTime.split(':')[0]||'22'), Number(recStartTime.split(':')[1]||'0'));
                      DateTimePickerAndroid.open({ value: base, mode: 'time', is24Hour: true, onChange: (e,d)=>{ if(e.type==='set'&&d){ const HH=String(d.getHours()).padStart(2,'0'); const MM=String(d.getMinutes()).padStart(2,'0'); setRecStartTime(`${HH}:${MM}`);} } });
                    } catch {}
                  }} style={{ position:'absolute', left:0,right:0,top:0,bottom:0 }} />
                )}
              </View>
              <View style={{ width:160, position:'relative' }}>
                <TextInput value={recEndTime} onChangeText={setRecEndTime} placeholder="HH:mm (opcional)" />
                {Platform.OS === 'ios' && (
                  <Pressable onPress={() => setShowRecEndTimePicker(true)} style={{ position:'absolute', left:0,right:0,top:0,bottom:0 }} />
                )}
                {Platform.OS === 'android' && (
                  <Pressable onPress={() => {
                    try {
                      const base = new Date(1970,0,1, Number((recEndTime||'').split(':')[0]||'6'), Number((recEndTime||'').split(':')[1]||'0'));
                      DateTimePickerAndroid.open({ value: base, mode: 'time', is24Hour: true, onChange: (e,d)=>{ if(e.type==='set'&&d){ const HH=String(d.getHours()).padStart(2,'0'); const MM=String(d.getMinutes()).padStart(2,'0'); setRecEndTime(`${HH}:${MM}`);} } });
                    } catch {}
                  }} style={{ position:'absolute', left:0,right:0,top:0,bottom:0 }} />
                )}
              </View>
            </View>
            <View style={{ height: 8 }} />
            <P dim>Zona horaria: {tzid}</P>
            <Text style={{ color: theme.colors.subtext, marginTop: 6 }}>La hora de fin es opcional. Puedes cambiar el horario cuando quieras.</Text>
          </>
          

          {Platform.OS === 'ios' && showRecStartTimePicker && (
            <DateTimePicker
              value={new Date(1970,0,1, Number(recStartTime.split(':')[0]||'22'), Number(recStartTime.split(':')[1]||'0'))}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: any, d?: Date) => {
                if (!d) { setShowRecStartTimePicker(false); return; }
                const HH = String(d.getHours()).padStart(2, '0');
                const MM = String(d.getMinutes()).padStart(2, '0');
                setRecStartTime(`${HH}:${MM}`);
              }}
            />
          )}
          {Platform.OS === 'ios' && showRecEndTimePicker && (
            <DateTimePicker
              value={new Date(1970,0,1, Number((recEndTime||'').split(':')[0]||'6'), Number((recEndTime||'').split(':')[1]||'0'))}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: any, d?: Date) => {
                if (!d) { setShowRecEndTimePicker(false); return; }
                const HH = String(d.getHours()).padStart(2, '0');
                const MM = String(d.getMinutes()).padStart(2, '0');
                setRecEndTime(`${HH}:${MM}`);
              }}
            />
          )}

          <View style={{ height: 12 }} />
          </Card>
  </ScrollView>
  </CenterScaffold>

        <StickyFooterCTA
          title={submitting ? 'Publicando…' : 'Publicar'}
          onPress={handleCreate}
          disabled={!canSubmit || submitting || !venue}
        />
        {/* Link to series list removed; it's now accessible via the "Mis Eventos" tab */}
      </Screen>
      </OwnerBackground>
      {/* Modal de enhorabuena al publicar */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCongrats(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Card variant="glass" gradientBorder style={{ width: '100%', maxWidth: 360, alignItems: 'center', paddingVertical: 24 }}>
            <View style={{ position: 'absolute', top: -10, left: 0, right: 0 }} pointerEvents="none">
              <ConfettiCannon count={80} origin={{ x: 0, y: 0 }} fadeOut autoStart={true} explosionSpeed={450} fallSpeed={2400} />
            </View>
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>¡Evento publicado!</Text>
            <Text style={{ color: theme.colors.subtext, marginTop: 8, textAlign: 'center' }}>Enhorabuena 🎉 Ya es visible para los usuarios.</Text>
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Crear otro" onPress={() => setShowCongrats(false)} variant="outline" />
              <Button title="Vale" onPress={() => setShowCongrats(false)} />
            </View>
          </Card>
        </View>
      </Modal>
    </RequireOwnerReady>
  );
}

// Chip component not needed in simplified flow; removed
