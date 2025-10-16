import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../ui';
import { theme } from '../../lib/theme';
import { AvatarStack } from '../AvatarStack';

export interface EventCardProps {
  id: number;
  title: string;
  startISO: string;
  venueName?: string;
  city?: string;
  venueType?: string; // para badge de tipo
  attendeesCount: number;
  attendeeAvatars: Array<{ id: string; avatar_url: string | null }>;
  going: boolean;
  sponsored?: boolean;
  toggling: boolean;
  onToggleGoing(id: number, going: boolean): void;
  onOpen(id: number): void;
  onOpenAttendees(id: number): void;
}

export const EventCard = memo(function EventCard(props: EventCardProps) {
  const { id, title, startISO, venueName, city, venueType, attendeesCount, attendeeAvatars, going, sponsored, toggling, onToggleGoing, onOpen, onOpenAttendees } = props;
  const dt = new Date(startISO);
  const dateLabel = dt.toLocaleDateString('es', { weekday:'short', day:'numeric', month:'short' });
  const time = dt.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });

  return (
    <Card style={{ margin:16, marginTop:6, paddingLeft:12, paddingRight:12, overflow:'hidden', paddingBottom: sponsored ? 44 : 14 }}>
      <View style={{ position:'absolute', left:0, top:0, bottom:0, width:4, backgroundColor:'#0EA5E9' }} />
      {/* Unified top row: title + attendees + GO button */}
      <View style={{ flexDirection:'row', alignItems:'flex-start', marginBottom:6 }}>
        <Pressable onPress={() => onOpen(id)} style={{ flex:1, paddingRight:8 }}>
          <Text style={{ color: theme.colors.text, fontSize:22, lineHeight:27, fontWeight:'800' }} numberOfLines={2}>{title}</Text>
          <Text style={{ color: theme.colors.textDim, marginTop:4, fontSize:14 }}>
            {dateLabel} · {time}
          </Text>
          <Text style={{ color: theme.colors.textDim, marginTop:2, fontSize:12 }}>
            {venueName || ''}{venueName ? ' · ' : ''}{city || ''}
          </Text>
          {venueType && venueType !== 'all' && (
            <View style={[venueTypeBadgeStyle(venueType), { marginTop:4 }]}> 
              <Text style={venueTypeBadgeTextStyle(venueType)}>{venueTypeLabel(venueType)}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => onToggleGoing(id, going)}
          style={{
            paddingHorizontal:16,
            paddingVertical:8,
            borderRadius:20,
            backgroundColor: going ? theme.colors.primary : theme.colors.primary + '22',
            borderWidth:1,
            borderColor: going ? theme.colors.primary : theme.colors.primary + '55',
            minWidth:78,
            alignItems:'center'
          }}
          disabled={toggling}
        >
          <Text style={{ color: going ? theme.colors.white : theme.colors.primary, fontSize:14, fontWeight:'600' }}>
            {toggling ? '...' : going ? 'Dejar de ir' : 'Voy'}
          </Text>
        </Pressable>
      </View>
      {attendeesCount > 0 && (
        <Pressable onPress={() => onOpenAttendees(id)} style={{ marginTop:2, alignSelf:'flex-start' }}>
          <AvatarStack avatars={attendeeAvatars} total={attendeesCount} />
        </Pressable>
      )}
      {sponsored && (
        <View style={{ position:'absolute', bottom:8, right:12 }}>
          <LinearGradient
            colors={['#FFE8A3','#FFC15A','#FF9F43']}
            start={{ x:0, y:0 }} end={{ x:1, y:1 }}
            style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:12, flexDirection:'row', alignItems:'center' }}
          >
            <View style={{ width:6, height:6, borderRadius:3, backgroundColor:'#7A3E00', marginRight:6, shadowColor:'#7A3E00', shadowOpacity:0.35, shadowRadius:4 }} />
            <Text style={{ fontSize:10, fontWeight:'700', color:'#4A2A00', letterSpacing:0.8 }}>DESTACADO</Text>
          </LinearGradient>
        </View>
      )}
    </Card>
  );
});

function venueTypeLabel(t?: string) {
  switch (t) {
    case 'nightclub': return 'Discoteca';
    case 'concert_hall': return 'Sala';
    case 'festival': return 'Festival';
    default: return '';
  }
}

function venueTypeBadgeStyle(t: string) {
  const map: Record<string,{bg:string;border:string;text:string}> = {
    nightclub: { bg:'#F5ECFF', border:'#E3D2FF', text:'#5A1FA8' },
    concert_hall: { bg:'#E7F4FF', border:'#C9E4FF', text:'#164C80' },
    festival: { bg:'#FFF6E6', border:'#FFE0B3', text:'#8A5300' }
  };
  const c = map[t] || { bg: theme.colors.card, border: theme.colors.border, text: theme.colors.textDim };
  return {
    paddingHorizontal:6,
    paddingVertical:2,
    borderRadius:6,
    backgroundColor: c.bg,
    borderWidth:1,
    borderColor: c.border,
  alignSelf:'flex-start' as const
  };
}

function venueTypeBadgeTextStyle(t: string) {
  const map: Record<string,{text:string}> = {
    nightclub: { text:'#5A1FA8' },
    concert_hall: { text:'#164C80' },
    festival: { text:'#8A5300' }
  };
  const c = map[t] || { text: theme.colors.textDim };
  return { color: c.text, fontSize:9, fontWeight:'600', letterSpacing:0.5 } as const;
}
