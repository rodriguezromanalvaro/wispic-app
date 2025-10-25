import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, ScrollView, Modal } from 'react-native';
import { theme } from '../../lib/theme';
import { Screen, H1, P, TextInput, Button, Card, Switch } from '../../components/ui';
import { RequireOwnerReady } from '../../features/owner/RequireOwnerReady';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../lib/toast';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import ConfettiCannon from 'react-native-confetti-cannon';

type VenueRow = { id: number; name: string; city_id: number };

function buildDateFromParts(dateStr: string, timeStr: string): Date {
  // Build a local Date from YYYY-MM-DD and HH:mm without timezone misparsing
  const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  const [H, M] = timeStr.split(':').map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, H || 0, M || 0, 0, 0);
  return dt;
}

function parsePriceToCents(input: string): number | null {
  // Accepts "12", "12,3", "12.34" (UI already normalizes comma to dot)
  const t = input.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!isFinite(n) || Number.isNaN(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  return cents >= 0 ? cents : null;
}

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
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD (display)
  const [timeStr, setTimeStr] = useState(''); // HH:mm (display)
  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [timeObj, setTimeObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [isFree, setIsFree] = useState<boolean>(true);
  const [priceStr, setPriceStr] = useState('');
  const [showCongrats, setShowCongrats] = useState(false);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recDays, setRecDays] = useState<Set<number>>(new Set()); // 0=Mon..6=Sun
  const [recStartDate, setRecStartDate] = useState<string>(''); // YYYY-MM-DD
  const [recEndDate, setRecEndDate] = useState<string>(''); // '' or YYYY-MM-DD
  const [recStartTime, setRecStartTime] = useState<string>('22:00');
  const [recEndTime, setRecEndTime] = useState<string>('');
  const [recHorizon, setRecHorizon] = useState<number>(8);
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

  // Client-side preview of next N dates (local approximation)
  const previewDates = useMemo(() => {
    if (!isRecurring) return [] as string[];
    const sd = toDateParts(recStartDate); const st = toTimeParts(recStartTime);
    if (!sd || !st || recDays.size===0) return [];
    const end = recEndDate && toDateParts(recEndDate);
    const limitWeeks = Math.max(recHorizon, 1);
    const today = new Date();
    const maxUntil = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    maxUntil.setDate(maxUntil.getDate() + (limitWeeks*7));
    const start = new Date(sd.y, sd.m-1, sd.d, st.H, st.M, 0, 0);
    const until = end ? new Date(end.y, end.m-1, end.d, 23,59,59,999) : maxUntil;
    const out: string[] = [];
    const daysArr = Array.from(recDays.values());
    for (let d = new Date(start); d <= until; d.setDate(d.getDate()+1)) {
      // JS getDay: 0=Sun..6=Sat, our conv: 0=Mon..6=Sun
      const iso = ((d.getDay()+6)%7);
      if (daysArr.includes(iso)) {
        out.push(new Date(d).toISOString());
        if (out.length>=10) break;
      }
    }
    return out;
  }, [isRecurring, recStartDate, recEndDate, recStartTime, recDays, recHorizon]);

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
          .select('id,name,city_id')
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

  // Suggestion helpers
  const setQuickDateTime = (d: Date) => {
    // Format YYYY-MM-DD and HH:mm from local date
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    setDateStr(`${yyyy}-${mm}-${dd}`);
    setTimeStr(`${HH}:${MM}`);
    setDateObj(new Date(yyyy, d.getMonth(), d.getDate(), 12, 0, 0, 0)); // midday avoids DST oddities
    setTimeObj(new Date(1970, 0, 1, d.getHours(), d.getMinutes(), 0, 0));
  };

  const nextFridayAt = (hour: number, minute = 0) => {
    const now = new Date();
    const d = new Date(now);
    // JS getDay(): 0 Sun ... 6 Sat. We want next Friday (5)
    const day = d.getDay();
    const delta = (5 - day + 7) % 7 || 7; // if today is Fri, go next week
    d.setDate(d.getDate() + delta);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // Android: open native dialogs; iOS: render inline component
  const openAndroidDate = () => {
    const base = dateObj ?? new Date();
    try {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type !== 'set' || !d) return;
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          setDateStr(`${yyyy}-${mm}-${dd}`);
          setDateObj(new Date(yyyy, d.getMonth(), d.getDate(), 12, 0, 0, 0));
        },
      });
    } catch {
      toast.show('No se pudo abrir el selector de fecha', 'error');
    }
  };

  const openAndroidTime = () => {
    const base = timeObj ?? new Date(1970, 0, 1, 22, 0, 0, 0);
    try {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'time',
        is24Hour: true,
        onChange: (event, d) => {
          if (event.type !== 'set' || !d) return;
          const HH = String(d.getHours()).padStart(2, '0');
          const MM = String(d.getMinutes()).padStart(2, '0');
          setTimeStr(`${HH}:${MM}`);
          setTimeObj(new Date(1970, 0, 1, d.getHours(), d.getMinutes(), 0, 0));
        },
      });
    } catch {
      toast.show('No se pudo abrir el selector de hora', 'error');
    }
  };

  const canSubmit = useMemo(() => {
    if (!venue) return false;
    if (!title.trim()) return false;
    if (isRecurring) {
      if (!(recStartDate && /^\d{4}-\d{2}-\d{2}$/.test(recStartDate))) return false;
      if (!(recStartTime && /^\d{2}:\d{2}$/.test(recStartTime))) return false;
      if (recDays.size===0) return false;
      return true;
    } else {
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
      if (!timeStr.match(/^\d{2}:\d{2}$/)) return false;
      const dt = buildDateFromParts(dateStr, timeStr);
      return !isNaN(dt.getTime());
    }
  }, [venue, title, dateStr, timeStr, isRecurring, recStartDate, recStartTime, recDays.size]);

  const handleCreate = async (mode: 'draft' | 'publish') => {
    if (!canSubmit || !venue) return;
    try {
      setSubmitting(mode);
      // One-off path
      if (!isRecurring) {
        const startLocal = buildDateFromParts(dateStr, timeStr);
      // Keep description as provided (price stored in structured fields)
      const finalDescription = description.trim();

      // Upload cover to storage (optional)
      let cover_url: string | null = null;
      if (coverUri) {
        try {
          const base64 = await FileSystem.readAsStringAsync(coverUri, { encoding: 'base64' as any });
          const arr = decode(base64);
          const extGuess = coverUri.split('.').pop()?.toLowerCase();
          const ext = extGuess && ['jpg','jpeg','png','webp'].includes(extGuess) ? extGuess : 'jpg';
          const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const path = `event_${Date.now()}.${ext}`;
          const { data: up, error: upErr } = await supabase.storage.from('event-covers').upload(path, arr, { contentType });
          if (!upErr && up?.path) {
            const { data: pub } = supabase.storage.from('event-covers').getPublicUrl(up.path);
            cover_url = pub?.publicUrl || null;
          }
        } catch (e) {
          // Silenciar fallo de portada; seguimos sin portada
        }
      }

      const price_cents = isFree ? null : parsePriceToCents(priceStr);
      const payload: any = {
        title: title.trim(),
        description: finalDescription || null,
        start_at: startLocal.toISOString(),
        venue_id: venue.id,
        city_id: venue.city_id,
        status: mode === 'publish' ? 'published' : 'draft',
        published_at: mode === 'publish' ? new Date().toISOString() : null,
        cover_url,
        is_free: !!isFree,
        price_cents: price_cents,
        currency: 'EUR',
        ticket_url: ticketUrl.trim() ? ticketUrl.trim() : null,
      };
    const { data, error } = await supabase.from('events').insert(payload).select('id').maybeSingle();
        if (error) throw error;
        toast.show(mode === 'publish' ? 'Evento publicado' : 'Borrador guardado', 'success');
  // Invalida el listado de eventos del usuario final para refrescar en el próximo focus/mount
    try { qc.invalidateQueries({ queryKey: ['events-full'] }); } catch {}
    try { qc.invalidateQueries({ queryKey: ['owner-events-list', venue.id] }); } catch {}
    try { qc.invalidateQueries({ queryKey: ['owner-next-event', venue.id] }); } catch {}
      // Reset form but keep date/time for faster consecutive creation
        setTitle('');
        setDescription('');
        setCoverUri(null);
        setIsFree(true);
        setPriceStr('');
        setTicketUrl('');
      // Ya no navegamos al feed/swipe del usuario final. Mostramos modal de enhorabuena.
        if (mode === 'publish') setShowCongrats(true);
      // Optionally navigate to event detail later
      } else {
        // Recurring path via RPC
        const price_cents = isFree ? null : parsePriceToCents(priceStr);
        const defaults: any = {
          is_free: !!isFree,
          price_cents: price_cents,
          currency: 'EUR',
          ticket_url: ticketUrl.trim() ? ticketUrl.trim() : null,
          cover_url: null,
          description: description.trim() || null,
          status: mode === 'publish' ? 'published' : 'draft',
        };
        const days = Array.from(recDays.values()).sort((a,b)=>a-b);
        const { data: rpc, error: rpcErr } = await supabase.rpc('create_or_update_series', {
          p_series_id: null,
          p_venue_id: venue.id,
          p_title: title.trim(),
          p_days: days,
          p_start_date: recStartDate,
          p_end_date: recEndDate || null,
          p_start_time: recStartTime+':00',
          p_end_time: recEndTime ? recEndTime+':00' : null,
          p_tzid: tzid,
          p_horizon_weeks: recHorizon,
          p_defaults: defaults,
        });
        if (rpcErr) throw rpcErr;
  toast.show(mode === 'publish' ? 'Serie publicada' : 'Serie guardada', 'success');
  try { qc.invalidateQueries({ queryKey: ['events-full'] }); } catch {}
  try { qc.invalidateQueries({ queryKey: ['owner-series'] }); } catch {}
  try { qc.invalidateQueries({ queryKey: ['owner-events-list', venue.id] }); } catch {}
  try { qc.invalidateQueries({ queryKey: ['owner-next-event', venue.id] }); } catch {}
        // Reset key fields
        setTitle(''); setDescription(''); setCoverUri(null); setIsFree(true); setPriceStr(''); setTicketUrl('');
        setIsRecurring(false); setRecDays(new Set()); setRecStartDate(''); setRecEndDate(''); setRecStartTime('22:00'); setRecEndTime('');
        if (mode === 'publish') setShowCongrats(true);
      }
    } catch (e:any) {
      const msg = e?.message || 'No se pudo crear el evento';
      toast.show(msg, 'error');
    } finally {
      setSubmitting(null);
    }
  };

  // Default quick fill: set to today 22:00 if empty on first load
  useEffect(() => {
    if (!dateStr && !timeStr) {
      const d = new Date();
      d.setHours(22, 0, 0, 0);
      setQuickDateTime(d);
    }
  }, []);

  return (
    <RequireOwnerReady>
      <Screen style={{ backgroundColor: theme.colors.bg }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          <View style={{ gap: 8 }}>
            <H1>Eventos</H1>
            <P>Publica un evento rápido. Lo mínimo: título y fecha/hora.</P>
          </View>

          <Card>
          {loadingVenue ? (
            <View style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={theme.colors.primary} />
              <P>Buscando tu local…</P>
            </View>
          ) : venue ? (
            <P dim>
              Local: <Text style={{ color: theme.colors.text }}>{venue.name}</Text>
            </P>
          ) : (
            <P dim>No encontramos tu local. Asegúrate de completar el onboarding.</P>
          )}

          <View style={{ height: 8 }} />

          <P bold>Título</P>
          <TextInput value={title} onChangeText={setTitle} placeholder="Ej: Fiesta de los 80s" />

          <View style={{ height: 12 }} />

          <P bold>Recurrencia</P>
          <View style={{ flexDirection: 'row', alignItems:'center', gap: 12, marginBottom: 8 }}>
            <Switch value={isRecurring} onValueChange={setIsRecurring} />
            <Text style={{ color: theme.colors.text }}>{isRecurring ? 'Recurrente' : 'Una vez'}</Text>
          </View>
          <P dim>Activa "Recurrente" para configurar un patrón semanal (días y horas) y publicar una serie.</P>

          {!isRecurring && (
          <>
            <P bold>Fecha y hora</P>
            <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, position: 'relative' }}>
              <TextInput value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" />
              {Platform.OS === 'android' && (
                <Pressable onPress={openAndroidDate} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              )}
            </View>
            <View style={{ width: 120, position: 'relative' }}>
              <TextInput value={timeStr} onChangeText={setTimeStr} placeholder="HH:mm" />
              {Platform.OS === 'android' && (
                <Pressable onPress={openAndroidTime} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              )}
            </View>
            </View>
          </>
          )}

          {isRecurring && (
          <>
            <P bold>Patrón semanal</P>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
              {['L','M','X','J','V','S','D'].map((lbl, idx) => (
                <Pressable key={idx} onPress={()=>toggleRecDay(idx)} style={{ paddingHorizontal:12,paddingVertical:8, borderRadius:999, borderWidth:1, borderColor: recDays.has(idx)? theme.colors.primary: theme.colors.border, backgroundColor: recDays.has(idx)? theme.colors.primary: 'transparent' }}>
                  <Text style={{ color: recDays.has(idx)? theme.colors.primaryText: theme.colors.text, fontWeight:'700' }}>{lbl}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: 8 }} />
            <P bold>Desde / Hasta</P>
            <View style={{ flexDirection:'row', gap:8 }}>
              <TextInput value={recStartDate} onChangeText={setRecStartDate} placeholder="YYYY-MM-DD (inicio)" style={{ flex:1 }} />
              <TextInput value={recEndDate} onChangeText={setRecEndDate} placeholder="YYYY-MM-DD (fin opcional)" style={{ flex:1 }} />
            </View>
            <View style={{ height: 8 }} />
            <P bold>Hora inicio / fin</P>
            <View style={{ flexDirection:'row', gap:8 }}>
              <TextInput value={recStartTime} onChangeText={setRecStartTime} placeholder="HH:mm" style={{ width:120 }} />
              <TextInput value={recEndTime} onChangeText={setRecEndTime} placeholder="HH:mm (opcional)" style={{ width:160 }} />
            </View>
            <View style={{ height: 8 }} />
            <P dim>Zona horaria: {tzid}</P>
            <View style={{ height: 8 }} />
            <P bold>Generar próximas (semanas)</P>
            <TextInput value={String(recHorizon)} onChangeText={(t)=>{ const n = parseInt(t||'0',10); if (!isNaN(n) && n>=1 && n<=26) setRecHorizon(n); }} placeholder="8" keyboardType="numeric" style={{ width:100 }} />
            <View style={{ height: 8 }} />
            <P bold>Vista previa (primeras 10 fechas)</P>
            <View style={{ gap:4 }}>
              {previewDates.length===0 ? <Text style={{ color: theme.colors.subtext }}>Completa patrón para ver fechas…</Text> : previewDates.map((iso,i)=> (
                <Text key={i} style={{ color: theme.colors.text }}>{new Date(iso).toLocaleString()}</Text>
              ))}
            </View>
          </>
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <DateTimePicker
              value={dateObj ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_: any, d?: Date) => {
                if (!d) { setShowDatePicker(false); return; }
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                setDateStr(`${yyyy}-${mm}-${dd}`);
                setDateObj(new Date(yyyy, d.getMonth(), d.getDate(), 12, 0, 0, 0));
                // iOS inline stays until user dismisses
              }}
            />
          )}

          {Platform.OS === 'ios' && showTimePicker && (
            <DateTimePicker
              value={timeObj ?? new Date(1970, 0, 1, 22, 0, 0, 0)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: any, d?: Date) => {
                if (!d) { setShowTimePicker(false); return; }
                const HH = String(d.getHours()).padStart(2, '0');
                const MM = String(d.getMinutes()).padStart(2, '0');
                setTimeStr(`${HH}:${MM}`);
                setTimeObj(new Date(1970, 0, 1, d.getHours(), d.getMinutes(), 0, 0));
                // iOS inline stays until user dismisses
              }}
            />
          )}

          {!isRecurring && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <Chip label="Hoy 22:00" onPress={() => { const d=new Date(); d.setHours(22,0,0,0); setQuickDateTime(d); }} />
              <Chip label="Mañana 22:00" onPress={() => { const d=new Date(); d.setDate(d.getDate()+1); d.setHours(22,0,0,0); setQuickDateTime(d); }} />
              <Chip label="Viernes 23:00" onPress={() => setQuickDateTime(nextFridayAt(23))} />
            </View>
          )}

          <View style={{ height: 12 }} />

          <P bold>Descripción (opcional)</P>
          <TextInput value={description} onChangeText={setDescription} placeholder="Detalles para los asistentes" multiline />

          <View style={{ height: 12 }} />

          <P bold>Entradas (opcional)</P>
          <TextInput
            value={ticketUrl}
            onChangeText={setTicketUrl}
            placeholder="URL de venta de entradas (https://...)"
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={{ height: 12 }} />

          <P bold>Portada</P>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Button
              title={coverUri ? 'Cambiar portada' : 'Subir portada'}
              variant="outline"
              onPress={async () => {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (perm.status !== 'granted') { toast.show('Permiso denegado para acceder a fotos', 'error'); return; }
                const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
                if (!res.canceled && res.assets?.[0]?.uri) setCoverUri(res.assets[0].uri);
              }}
            />
            {coverUri ? <Text style={{ color: theme.colors.subtext, flex: 1 }} numberOfLines={1}>Portada seleccionada</Text> : null}
          </View>

          <View style={{ height: 12 }} />

          <P bold>Entrada</P>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Switch value={isFree} onValueChange={setIsFree} />
            <Text style={{ color: theme.colors.text }}>Gratis</Text>
          </View>
          {!isFree && (
            <View style={{ marginTop: 8, width: 160 }}>
              <TextInput
                value={priceStr}
                onChangeText={(t) => { if (/^\d{0,4}(?:[\.,]\d{0,2})?$/.test(t)) setPriceStr(t.replace(',', '.')); }}
                placeholder="Precio €"
                keyboardType="numeric"
              />
            </View>
          )}
          </Card>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            title={submitting==='draft' ? 'Guardando…' : 'Guardar borrador'}
            onPress={() => handleCreate('draft')}
            variant="outline"
            disabled={!canSubmit || submitting !== null}
          />
          <View style={{ flex: 1 }} />
          <Button
            title={submitting==='publish' ? 'Publicando…' : 'Publicar'}
            onPress={() => handleCreate('publish')}
            disabled={!canSubmit || submitting !== null || !venue}
          />
        </View>
        <View style={{ marginTop: 8 }}>
          <Button title="Ver mis series" variant="outline" onPress={() => router.push('/(owner)/series' as any)} />
        </View>
      </Screen>
      {/* Modal de enhorabuena al publicar */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCongrats(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Card style={{ width: '100%', maxWidth: 360, alignItems: 'center', paddingVertical: 24 }}>
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

const Chip: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable
    onPress={onPress}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: (theme.colors as any).surfaceMuted || theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    }}
  >
    <Text style={{ color: theme.colors.text }}>{label}</Text>
  </Pressable>
);
