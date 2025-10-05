import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native';
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
  totalFuture: number;
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
}

const DayBar = ({ label }: { label?: string }) => {
  if (!label) return null;
  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const active = new Set(label.split('·').map(s => s.trim()));
  return (
    <View style={{ flexDirection:'row', marginTop:6, gap:4 }}>
      {days.map(d => (
        <View key={d} style={{
          paddingHorizontal:6,
          paddingVertical:2,
          borderRadius:6,
          backgroundColor: active.has(d) ? `${theme.colors.primary}25` : theme.colors.card,
          borderWidth:1,
          borderColor: active.has(d) ? theme.colors.primary : theme.colors.border
        }}>
          <Text style={{ fontSize:11, color: active.has(d) ? theme.colors.primary : theme.colors.textDim }}>{d.charAt(0)}</Text>
        </View>
      ))}
    </View>
  );
};

export const LocalCard = memo(function LocalCard(props: LocalCardProps) {
  const {
  seriesId, title, venueName, city, venueType, nextDateISO, totalFuture, weekDaysLabel,
    sponsored, expanded, occurrences, hasMoreOccurrences, attendeesCount, attendeeAvatars,
    going, togglingIds, onToggleExpand, onToggleGoing, onOpenOccurrence, onOpenAttendees, onSeeAllOccurrences
  } = props;

  const nextDate = new Date(nextDateISO);
  const nextLabel = nextDate.toLocaleDateString('es', { weekday:'short', day:'numeric', month:'short' });
  const rel = relativeTime(nextDate);
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
      <View style={{ flexDirection:'row', alignItems:'flex-start', marginBottom:4 }}>
        <Pressable onPress={onToggleExpand} style={{ flex:1, paddingRight:8 }}>
          <Text style={{ color: theme.colors.text, fontSize:18, lineHeight:22, fontWeight:'800' }} numberOfLines={2}>{title}</Text>
        </Pressable>
      </View>
      {/* Compact dynamic badges row to use previous empty space */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:6 }} contentContainerStyle={{ paddingRight:4, gap:6, flexDirection:'row', alignItems:'center' }}>
        {isToday(nextDate) && <Badge tone="accent" label="HOY" />}
        <Badge tone="neutral" label={rel} />
        {totalFuture > 1 && <Badge tone="neutral" label={`+${totalFuture - 1} futuras`} />}
        {weekDaysLabel && <Badge tone="outline" label={weekDaysLabel.replace(/\s*·\s*/g,'·')} />}
        {venueType && venueType !== 'all' && <VenueTypeInline t={venueType} />}
        {attendeesCount > 0 && (
          <Pressable onPress={() => eventIdOfNext && onOpenAttendees(eventIdOfNext)}>
            <Badge tone="primary" label={`${attendeesCount} van`} />
          </Pressable>
        )}
      </ScrollView>
      {/* Summary block clickable to expand */}
      <Pressable onPress={onToggleExpand} style={{ paddingRight:8 }}>
        <Text style={{ color: theme.colors.textDim, fontSize:13 }}>
          Próxima: {nextLabel}
        </Text>
        {totalFuture > 1 && (
          <Text style={{ color: theme.colors.textDim, marginTop:2, fontSize:12 }}>+{totalFuture - 1} más próximamente</Text>
        )}
        <Text style={{ color: theme.colors.textDim, marginTop:2 }}>{venueName || ''}{venueName ? ' · ' : ''}{city || ''}</Text>
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
                    {togglingIds.has(o.id) ? '...' : (o.going ? '✓ Voy' : '+ Voy')}
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

// Small utility chips
function Badge({ label, tone }: { label:string; tone: 'primary'|'accent'|'neutral'|'outline' }) {
  let bg = theme.colors.card; let border = theme.colors.border; let color = theme.colors.textDim;
  if(tone==='primary'){ bg = theme.colors.primary + '22'; border = theme.colors.primary + '55'; color = theme.colors.primary; }
  if(tone==='accent'){ bg = '#FFE8A3'; border = '#FFC960'; color = '#7A4800'; }
  if(tone==='outline'){ bg = theme.colors.card; border = theme.colors.border; color = theme.colors.textDim; }
  return (
    <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:3, borderRadius:14, borderWidth:1, backgroundColor:bg, borderColor:border }}>
      <Text style={{ fontSize:11, fontWeight:'600', color }}>{label}</Text>
    </View>
  );
}

function VenueTypeInline({ t }: { t:string }) {
  return (
    <View style={[venueTypeBadgeStyle(t), { paddingVertical:2, paddingHorizontal:6 }] }>
      <Text style={venueTypeBadgeTextStyle(t)}>{venueTypeLabel(t)}</Text>
    </View>
  );
}

function isToday(d: Date){ const n=new Date(); return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear(); }

function relativeTime(dt: Date){
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffMin = Math.round(diffMs/60000);
  if(diffMin <= 0) return 'Ahora';
  if(diffMin < 60) return `En ${diffMin} min`;
  const diffH = Math.round(diffMin/60);
  if(diffH < 6) return `En ${diffH}h`;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(23,59,59,999);
  if(dt.getDate()===tomorrow.getDate() && dt.getMonth()===tomorrow.getMonth() && dt.getFullYear()===tomorrow.getFullYear()) return 'Mañana';
  const diffD = Math.round(diffH/24);
  if(diffD < 7) return `En ${diffD}d`;
  return dt.toLocaleDateString('es',{ day:'2-digit', month:'short' });
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
