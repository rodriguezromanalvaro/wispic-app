import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../ui';
import { theme } from '../../lib/theme';
import { AvatarStack } from '../AvatarStack';

export interface LocalOccurrence {
  id: number;
  start_at: string;
  city?: string | null;
  venue?: any;
  going: boolean;
}

export interface LocalCardProps {
  seriesId: number;
  title: string;
  venueName?: string;
  city?: string;
  venueType?: string; // para badge de tipo
  nextDateISO: string;
  distanceKm?: number;
  weekDaysLabel?: string;
  sponsored?: boolean;
  expanded: boolean;
  occurrences: LocalOccurrence[];
  hasMoreOccurrences: boolean;
  attendeesCount: number;
  attendeeAvatars: Array<{ id: string; avatar_url: string | null }>;
  going: boolean;
  togglingIds: Set<number>;
  onToggleExpand(): void;
  onToggleGoing(eventId: number, going: boolean): void;
  onOpenOccurrence(eventId: number): void;
  onOpenAttendees(eventId: number): void;
  onSeeAllOccurrences(seriesId: number): void;
  priceLabel?: string; // opcional, si hay precio coherente para la próxima
}

const DayBar = ({ label }: { label?: string }) => {
  if (!label) return null;
  // Entrada esperada weekDaysLabel: "Lun·Mar·Mié·Jue·Vie" etc.
  const days = [
    { key: 'Lun', display: 'L' },
    { key: 'Mar', display: 'M' },
    { key: 'Mié', display: 'X' }, // Usamos X para miércoles para evitar duplicar la M
    { key: 'Jue', display: 'J' },
    { key: 'Vie', display: 'V' },
    { key: 'Sáb', display: 'S' },
    { key: 'Dom', display: 'D' },
  ];
  const active = new Set(label.split('·').map(s => s.trim()));
  return (
    <View style={{ marginTop:6 }}>
      <View style={{ flexDirection:'row', gap:4 }}>
        {days.map(d => {
          const isActive = active.has(d.key);
          return (
            <View key={d.key} accessibilityLabel={`${d.key}: ${isActive ? 'abierto' : 'cerrado'}`}
              style={{
                paddingHorizontal:6,
                paddingVertical:2,
                borderRadius:6,
                backgroundColor: isActive ? `${theme.colors.primary}25` : theme.colors.card,
                borderWidth:1,
                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                minWidth:22,
                alignItems:'center'
              }}>
              <Text style={{ fontSize:11, fontWeight:isActive?'700':'500', color: isActive ? theme.colors.primary : theme.colors.textDim }}>{d.display}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ marginTop:4, fontSize:10, color: theme.colors.textDim }}>Días marcados = abiertos</Text>
    </View>
  );
};

export const LocalCard = memo(function LocalCard(props: LocalCardProps) {
  const {
  seriesId, title, venueName, city, venueType, nextDateISO, distanceKm, weekDaysLabel,
    sponsored, expanded, occurrences, hasMoreOccurrences, attendeesCount, attendeeAvatars,
    going, togglingIds, onToggleExpand, onToggleGoing, onOpenOccurrence, onOpenAttendees, onSeeAllOccurrences,
    priceLabel
  } = props;

  const nextDate = new Date(nextDateISO);
  const nextLabel = nextDate.toLocaleDateString('es', { weekday:'short', day:'numeric', month:'short' });
  const eventIdOfNext = occurrences.find(o=>o.id) ? occurrences[0]?.id : undefined; // not strictly needed

  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  // Enable LayoutAnimation on Android if needed
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch {/* noop */}
    }
  }, []);

  useEffect(() => {
    // Smooth layout change (height of occurrences block) to avoid scroll jump
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  const occStyle = {
    opacity: anim,
    // Remove negative translate to prevent upward jump relative to list viewport
    transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.98,1] }) }]
  } as const;

  return (
    <Card style={{ margin:16, marginTop:6, paddingLeft:12, overflow:'hidden', paddingBottom: sponsored ? 40 : 12 }}>
      <View style={{ position:'absolute', left:0, top:0, bottom:0, width:4, backgroundColor:'#6D4DFF' }} />
      {/* Header: title + attendees (removed primary series-level go button) */}
      <View style={{ flexDirection:'row', alignItems:'flex-start', marginBottom:6 }}>
        <Pressable onPress={onToggleExpand} style={{ flex:1, paddingRight:8 }}>
          <Text style={{ color: theme.colors.text, fontSize:22, lineHeight:27, fontWeight:'800' }} numberOfLines={2}>
            {title}
          </Text>
          {attendeesCount > 0 && (
            <Pressable onPress={() => eventIdOfNext && onOpenAttendees(eventIdOfNext)} style={{ marginTop:4 }}>
              <AvatarStack avatars={attendeeAvatars} total={attendeesCount} />
            </Pressable>
          )}
        </Pressable>
      </View>
      {/* Summary block clickable to expand */}
      <Pressable onPress={onToggleExpand} style={{ paddingRight:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={{ color: theme.colors.textDim, fontSize:13 }}>
            Próxima: {nextLabel}
          </Text>
          {priceLabel ? (
            <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:999, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border }}>
              <Text style={{ color: theme.colors.text, fontSize:11, fontWeight:'700' }}>{priceLabel}</Text>
            </View>
          ) : null}
        </View>
        {/* Se elimina el contador de próximas para dar protagonismo a la barra de días abiertos */}
        {weekDaysLabel && <DayBar label={weekDaysLabel} />}
        <Text style={{ color: theme.colors.textDim, marginTop:4 }}>
          {venueName || ''}{venueName ? ' · ' : ''}{city || ''}
        </Text>
        {typeof distanceKm === 'number' && (
          <Text style={{ color: theme.colors.textDim, marginTop:2, fontSize:12 }}>
            Distancia: {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km
          </Text>
        )}
        {venueType && venueType !== 'all' && (
          <View style={[venueTypeBadgeStyle(venueType), { marginTop:4 }]}>
            <Text style={venueTypeBadgeTextStyle(venueType)}>{venueTypeLabel(venueType)}</Text>
          </View>
        )}
        {!expanded && (
          <View style={{ marginTop:8, alignSelf:'flex-start', backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.primary + '55', paddingHorizontal:10, paddingVertical:4, borderRadius:14, flexDirection:'row', alignItems:'center' }}>
            <Text style={{ color: theme.colors.primary, fontSize:11, fontWeight:'600', letterSpacing:0.5 }}>VER FECHAS</Text>
            <Text style={{ color: theme.colors.primary, fontSize:12, marginLeft:4 }}>▾</Text>
          </View>
        )}
      </Pressable>
      <Animated.View style={[{ marginTop: expanded ? 10 : 0 }, occStyle]}> 
        {expanded && (
        <View style={{ borderTopWidth:1, borderTopColor: theme.colors.border, paddingTop:8, gap:6 }}>
          {occurrences.map(o => {
            const dt = new Date(o.start_at);
            const label = dt.toLocaleDateString('es', { weekday:'short', day:'numeric', month:'short' });
            const time = dt.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
            return (
              <View key={o.id} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Pressable onPress={() => onOpenOccurrence(o.id)} style={{ flex:1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: o.id === eventIdOfNext ? '700':'500' }}>
                    {label} · {time}
                  </Text>
                  <Text style={{ color: theme.colors.textDim, fontSize:12 }}>
                    {o.venue?.name || venueName || ''}{(o.city || city) ? ` · ${o.city || city}`:''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onToggleGoing(o.id, o.going)}
                  disabled={togglingIds.has(o.id)}
                  style={{
                    paddingHorizontal:12,
                    paddingVertical:6,
                    borderRadius:16,
                    backgroundColor: o.going ? theme.colors.primary : theme.colors.primary + '22',
                    borderWidth:1,
                    borderColor: o.going ? theme.colors.primary : theme.colors.primary + '55',
                    minWidth:60,
                    alignItems:'center'
                  }}
                >
                  <Text style={{ color: o.going ? theme.colors.white : theme.colors.primary, fontSize:12, fontWeight:'600' }}>
                    {togglingIds.has(o.id) ? '...' : (o.going ? 'Dejar de ir' : 'Voy')}
                  </Text>
                </Pressable>
              </View>
            );
          })}
          {hasMoreOccurrences && (
            <Pressable onPress={() => onSeeAllOccurrences(seriesId)} style={{ marginTop:4 }}>
              <Text style={{ color: theme.colors.primary, fontSize:12 }}>Ver todas las fechas →</Text>
            </Pressable>
          )}
        </View> )}
      </Animated.View>
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
