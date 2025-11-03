import { Modal, View, Text as RNText, Pressable, Image, ScrollView } from 'react-native';

import { YStack, XStack, Button as TgButton, Text as TgText } from 'components/tg';
import { Card } from 'components/ui';
import { theme } from 'lib/theme';

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

export const EventDetailSheet = ({ open, data, onClose, onToggleGoing, onOpenAttendees, onOpenTickets }: {
  open: boolean;
  data: EventDetailData | null;
  onClose(): void;
  onToggleGoing(id: number, going: boolean): void;
  onOpenAttendees(id: number): void;
  onOpenTickets?(url: string): void;
}) => {
  if (!data) return null;
  const Txt: any = TgText || RNText;
  const Btn: any = TgButton || Pressable;
  const dt = new Date(data.startISO);
  const dateLabel = dt.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.colors.overlay }} />
      <YStack style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        <XStack ai="center" jc="space-between" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>Detalle del evento</Txt>
          <Btn onPress={onClose}><Txt style={{ color: theme.colors.primary }}>Cerrar</Txt></Btn>
        </XStack>
        <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Card>
            {data.coverUrl ? (
              <View style={{ height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.bgAlt, marginBottom: 12 }}>
                <Image source={{ uri: data.coverUrl }} style={{ width: '100%', height: '100%' }} />
              </View>
            ) : null}
            <Txt style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>{data.title}</Txt>
            <XStack ai="center" gap={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Txt style={{ color: theme.colors.textDim }}>{dateLabel} · {time}</Txt>
              {data.priceLabel ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Txt style={{ color: theme.colors.text, fontSize: 11, fontWeight: '700' }}>{data.priceLabel}</Txt>
                </View>
              ) : null}
            </XStack>
            <Txt style={{ color: theme.colors.textDim, marginTop: 4 }}>{data.venueName || ''}{data.venueName ? ' · ' : ''}{data.city || ''}</Txt>
            {data.description ? (
              <Txt style={{ color: theme.colors.text, marginTop: 12 }}>{data.description}</Txt>
            ) : (
              <Txt style={{ color: theme.colors.subtext, marginTop: 12 }}>Sin descripción</Txt>
            )}
            <XStack gap={12} style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Btn
                onPress={() => onToggleGoing(data.id, data.going)}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: data.going ? theme.colors.primary : theme.colors.primary + '22', borderWidth: 1, borderColor: data.going ? theme.colors.primary : theme.colors.primary + '55' }}
              >
                <Txt style={{ color: data.going ? theme.colors.white : theme.colors.primary, fontWeight: '700' }}>{data.going ? 'Dejar de ir' : 'Voy'}</Txt>
              </Btn>
              <Btn onPress={() => onOpenAttendees(data.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                <Txt style={{ color: theme.colors.text, fontWeight: '700' }}>Ver asistentes</Txt>
              </Btn>
              {data.ticketUrl ? (
                <Btn onPress={() => onOpenTickets && onOpenTickets(data.ticketUrl!)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Txt style={{ color: theme.colors.text, fontWeight: '700' }}>Conseguir entradas</Txt>
                </Btn>
              ) : null}
            </XStack>
          </Card>
        </ScrollView>
      </YStack>
    </Modal>
  );
};
