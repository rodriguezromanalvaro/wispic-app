import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { useQueryClient } from '@tanstack/react-query';

export default function EventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [event, setEvent] = useState<any>(null);
  const [going, setGoing] = useState(false);
  const [loading, setLoading] = useState(true);
  const eid = Number(id);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Carga del evento
      const { data: ev, error: e1 } = await supabase
        .from('events')
        .select('*')
        .eq('id', eid)
        .maybeSingle();
      if (e1) console.warn('Error loading event:', e1);
      setEvent(ev || null);

      // ¿Estoy apuntado?
      if (user) {
        const { data: att } = await supabase
          .from('event_attendance')
          .select('event_id')
          .eq('event_id', eid)
          .eq('user_id', user.id)
          .eq('status', 'going')
          .maybeSingle();
        setGoing(!!att);
      }

      setLoading(false);
    })();
  }, [eid, user?.id]);

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

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />;
  }

  if (!event) {
    return (
      <Screen>
        <TopBar title="Evento" />
        <Card><Text style={{ color: theme.colors.text }}>Evento no encontrado</Text></Card>
      </Screen>
    );
  }

  const dt = new Date(event.start_at);

  return (
    <Screen style={{ gap: theme.spacing(2) }}>
      <TopBar title="Evento" />

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

        {/* Acciones */}
        <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
          <Button
            title={going ? 'Dejar de ir' : 'Voy a este evento'}
            onPress={toggle}
            variant={going ? 'danger' : 'primary'}
          />
          <Button
            title="Ver asistentes"
            onPress={() => router.push(`/(tabs)/events/people?eventId=${eid}`)}
            variant="ghost"
          />
        </View>
      </Card>
    </Screen>
  );
}
