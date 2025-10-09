import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Text, View, ScrollView } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { GradientScaffold } from '../../../features/profile/components/GradientScaffold';
import { useAttendeesSheetStore } from '../../../lib/stores/attendeesSheet';

export default function EventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [event, setEvent] = useState<any>(null);
  const [going, setGoing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckInAt, setLastCheckInAt] = useState<number | null>(null);
  const [presence, setPresence] = useState<{ verified_count: number; manual_count: number; present_count: number; last_sample_at: string | null } | null>(null);
  const eid = Number(id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Carga del evento
      const { data: ev, error: e1 } = await supabase
        .from('events')
        .select('*')
        .eq('id', eid)
        .maybeSingle();
      if (e1) console.warn('[event detail] Error loading event:', e1);
      if (!cancelled) setEvent(ev || null);

      // ¿Estoy apuntado?
      if (user) {
        const { data: att } = await supabase
          .from('event_attendance')
          .select('event_id')
          .eq('event_id', eid)
          .eq('user_id', user.id)
          .eq('status', 'going')
          .maybeSingle();
        if (!cancelled) setGoing(!!att);
      }

      // (Opcional) futuro: cargar métricas de presencia de otra tabla/view.
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eid, user?.id]);

  const presenceLabel = useMemo(() => {
    const pc = presence?.present_count ?? 0;
    if (pc <= 2) return { text: 'Tranquilo', color: '#4caf50' };
    if (pc <= 6) return { text: 'Normal', color: '#ffb300' };
    if (pc <= 12) return { text: 'Lleno', color: '#fb8c00' };
    return { text: 'A tope', color: '#e53935' };
  }, [presence?.present_count]);

  const toggle = async () => {
    if (!user) return Alert.alert('Sesión requerida');

    if (going) {
      const { error } = await supabase
        .from('event_attendance')
        .delete()
        .match({ event_id: eid, user_id: user.id, status: 'going' });
      if (error) return Alert.alert('Error', error.message);
      setGoing(false);
      // 🔄 refrescar feed y lista de eventos
      qc.invalidateQueries({ queryKey: ['my-feed-events-with-pending', user.id] });
      qc.invalidateQueries({ queryKey: ['events-all', user.id] });
      Alert.alert('Hecho', 'Has dejado de ir a este evento');
    } else {
      const { error } = await supabase
        .from('event_attendance')
        .upsert({ event_id: eid, user_id: user.id, status: 'going' }, { onConflict: 'event_id,user_id' });
      if (error) return Alert.alert('Error', error.message);
      setGoing(true);
      // 🔄 refrescar feed y lista de eventos
      qc.invalidateQueries({ queryKey: ['my-feed-events-with-pending', user.id] });
      qc.invalidateQueries({ queryKey: ['events-all', user.id] });
      Alert.alert('Apuntado', '✓ Ya estás apuntado');
    }
  };

  const doCheckIn = async () => {
    if (!user) return Alert.alert('Sesión requerida');
    // Cooldown de 10 minutos en cliente
    const now = Date.now();
    if (lastCheckInAt && now - lastCheckInAt < 10 * 60 * 1000) {
      const mins = Math.ceil((10 * 60 * 1000 - (now - lastCheckInAt)) / 60000);
      return Alert.alert('Espera un poco', `Podrás volver a actualizar tu presencia en ~${mins} min`);
    }
    try {
      setCheckingIn(true);
      const { error } = await supabase
        .from('event_checkins')
        .upsert(
          {
            event_id: eid,
            user_id: user.id,
            last_seen_at: new Date().toISOString(),
            method: 'manual',
            verified: false,
          },
          { onConflict: 'event_id,user_id' }
        );
      if (error) throw error;
      setLastCheckInAt(Date.now());
      // Podemos invalidar queries relacionadas si las hubiera en el feed en el futuro
      Alert.alert('¡Listo!', 'Hemos registrado que estás en el local (no verificado).');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo registrar la presencia');
    } finally {
      setCheckingIn(false);
    }
  };

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (loading) {
    return (
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <View style={{ flex:1, paddingTop:16, alignItems:'center' }}>
            <ActivityIndicator style={{ marginTop:40 }} color={theme.colors.primary} />
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <View style={{ flex:1, paddingTop:16 }}>
            <Card style={{ margin:16 }}><Text style={{ color: theme.colors.text }}>Evento no encontrado</Text></Card>
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  const dt = new Date(event.start_at);

  return (
    <Screen style={{ padding:0 }}>
      <GradientScaffold>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop:16, paddingBottom:64, paddingHorizontal:16, gap: theme.spacing(2) }}
          showsVerticalScrollIndicator={false}
        >
      <Card style={{ gap: theme.spacing(1) }}>
        <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800' }}>
          {event.title}
        </Text>
        <Text style={{ color: theme.colors.subtext }}>
          {event.city} — {dt.toLocaleString()}
        </Text>
        <Text style={{ color: theme.colors.text, marginTop: theme.spacing(1) }}>
          {event.description || 'Sin descripción'}
        </Text>

        <View style={{ height: theme.spacing(1) }} />

        {/* Crowd meter */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Ambiente ahora</Text>
          <View style={{ height: 10, backgroundColor: theme.colors.card, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((presence?.present_count ?? 0) * 6))}%`,
                backgroundColor: presenceLabel.color,
              }}
            />
          </View>
          <Text style={{ color: theme.colors.subtext }}>
            {presenceLabel.text}
            {presence && (
              <> · {presence.verified_count} verificados · {presence.manual_count} manuales</>
            )}
            {presence?.last_sample_at && (
              <> · actualizado {timeAgo(presence.last_sample_at)}</>
            )}
          </Text>
        </View>

        {/* Acciones */}
        <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
          <Button
            title={going ? 'Dejar de ir' : 'Voy a este evento'}
            onPress={toggle}
            variant={going ? 'danger' : 'primary'}
          />
          <Button
            title={checkingIn ? 'Registrando…' : 'Estoy aquí'}
            onPress={doCheckIn}
            disabled={checkingIn}
            variant="ghost"
          />
          <Button
            title="Ver asistentes"
            onPress={() => useAttendeesSheetStore.getState().openFor(eid)}
            variant="ghost"
          />
        </View>
      </Card>
        </Animated.ScrollView>
      </GradientScaffold>
    </Screen>
  );
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (secs < 60) return 'hace unos segundos';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs} h`;
}
