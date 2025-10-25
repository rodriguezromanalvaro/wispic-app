import React from 'react';
import { Modal, View, Text, Pressable, Image, ScrollView } from 'react-native';
import { theme } from '../../lib/theme';
import { Card } from '../ui';

export interface EventDetailData {
  id: number;
  title: string;
  startISO: string;
  venueName?: string | null;
  city?: string | null;
  venueType?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  priceLabel?: string | null;
  ticketUrl?: string | null;
  going: boolean;
}

export const EventDetailSheet: React.FC<{
  open: boolean;
  data: EventDetailData | null;
  onClose(): void;
  onToggleGoing(id: number, going: boolean): void;
  onOpenAttendees(id: number): void;
  onOpenTickets?(url: string): void;
}> = ({ open, data, onClose, onToggleGoing, onOpenAttendees, onOpenTickets }) => {
  if (!data) return null;
  const dt = new Date(data.startISO);
  const dateLabel = dt.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.colors.overlay }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>Detalle del evento</Text>
          <Pressable onPress={onClose}><Text style={{ color: theme.colors.primary }}>Cerrar</Text></Pressable>
        </View>
        <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Card>
            {data.coverUrl ? (
              <View style={{ height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.bgAlt, marginBottom: 12 }}>
                <Image source={{ uri: data.coverUrl }} style={{ width: '100%', height: '100%' }} />
              </View>
            ) : null}
            <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>{data.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Text style={{ color: theme.colors.textDim }}>{dateLabel} · {time}</Text>
              {data.priceLabel ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: '700' }}>{data.priceLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: theme.colors.textDim, marginTop: 4 }}>{data.venueName || ''}{data.venueName ? ' · ' : ''}{data.city || ''}</Text>
            {data.description ? (
              <Text style={{ color: theme.colors.text, marginTop: 12 }}>{data.description}</Text>
            ) : (
              <Text style={{ color: theme.colors.subtext, marginTop: 12 }}>Sin descripción</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => onToggleGoing(data.id, data.going)}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: data.going ? theme.colors.primary : theme.colors.primary + '22', borderWidth: 1, borderColor: data.going ? theme.colors.primary : theme.colors.primary + '55' }}
              >
                <Text style={{ color: data.going ? theme.colors.white : theme.colors.primary, fontWeight: '700' }}>{data.going ? 'Dejar de ir' : 'Voy'}</Text>
              </Pressable>
              <Pressable onPress={() => onOpenAttendees(data.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Ver asistentes</Text>
              </Pressable>
              {data.ticketUrl ? (
                <Pressable onPress={() => onOpenTickets && onOpenTickets(data.ticketUrl!)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Conseguir entradas</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
};
