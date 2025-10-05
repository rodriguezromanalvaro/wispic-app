import React from 'react';
import { Modal, View, Pressable, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useEventSheetStore } from '../../lib/stores/eventSheet';
import { useEventDetail } from '../../lib/hooks/useEventDetail';
import { theme } from '../../lib/theme';
import { Button, Card } from '../ui';

export const EventDetailSheet: React.FC = () => {
  const open = useEventSheetStore(s=>s.open);
  const eventId = useEventSheetStore(s=>s.eventId);
  const close = useEventSheetStore(s=>s.close);

  const { event, going, loading, toggleGoing, checkIn, checkingIn, presence, presenceLabel } = useEventDetail(eventId, { enabled: open });

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={{ flex:1, backgroundColor:'#0008' }} onPress={close} />
      <View style={{ position:'absolute', left:0, right:0, bottom:0 }}>
  <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:16, maxHeight:'80%' }}>
          <View style={{ alignItems:'center', marginBottom:8 }}>
            <View style={{ width:40, height:4, borderRadius:2, backgroundColor: theme.colors.border }} />
          </View>
          {loading && (
            <ActivityIndicator color={theme.colors.primary} style={{ marginVertical:32 }} />
          )}
          {!loading && !event && (
            <Text style={{ color: theme.colors.text }}>Evento no encontrado</Text>
          )}
          {!loading && event && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '100%' }}>
              <Text style={{ color: theme.colors.text, fontSize:20, fontWeight:'800' }}>{event.title}</Text>
              <Text style={{ color: theme.colors.textDim, marginTop:4 }}>{event.city} — {new Date(event.start_at).toLocaleString()}</Text>
              {event.description && <Text style={{ color: theme.colors.text, marginTop:12 }}>{event.description}</Text>}

              {/* Presence meter */}
              <View style={{ marginTop:16 }}>
                <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Ambiente ahora</Text>
                <View style={{ height:10, backgroundColor: theme.colors.card, borderRadius:6, overflow:'hidden', marginTop:6 }}>
                  <View style={{ height:'100%', width:`${Math.min(100, Math.round((presence?.present_count ?? 0) * 6))}%`, backgroundColor: presenceLabel.color }} />
                </View>
                <Text style={{ color: theme.colors.textDim, marginTop:4 }}>
                  {presenceLabel.text}
                  {presence && <> · {presence.verified_count} verificados · {presence.manual_count} manuales</>}
                  {presence?.last_sample_at && <> · actualizado {timeAgo(presence.last_sample_at)}</>}
                </Text>
              </View>

              {/* Actions */}
              <View style={{ flexDirection:'row', gap:8, marginTop:16, flexWrap:'wrap' }}>
                <Button title={going? 'Dejar de ir':'Voy a este evento'} onPress={toggleGoing} variant={going? 'danger':'primary'} />
                <Button title="Ver asistentes" onPress={()=>{/* TODO: open people sheet / navigate */}} variant="ghost" />
                <Button title="Cerrar" onPress={close} variant="outline" />
              </View>
              <View style={{ height:40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (secs < 60) return 'hace unos segundos';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs} h`;
}
