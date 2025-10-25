import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View, Pressable, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { CenterScaffold } from '../../../components/Scaffold';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../lib/theme';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

type MatchRow = {
  id: number;
  user_a: string;
  user_b: string;
  superlike: boolean;
  last_message_at: string | null;
  created_by_like_id?: number | null;
};

const AnimatedFlatList: any = Animated.createAnimatedComponent(FlatList as any);

export default function ChatList() {
  const router = useRouter();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const locale = (() => {
    try {
      const l = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
      return l.startsWith('es') ? 'es' : 'en';
    } catch { return 'en'; }
  })();
  const T = useMemo(() => ({
    chats: locale === 'es' ? 'Chats' : 'Chats',
    empty: locale === 'es' ? 'Aún no tienes chats.' : 'You have no chats yet.',
    last: locale === 'es' ? 'Último' : 'Last',
  }), [locale]);

  function formatRelative(iso?: string|null) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    // Detectar 'ayer'
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
    if (sameDay) {
      // Mostrar solo hora (HH:mm)
      try { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d); } catch { return d.toLocaleTimeString(); }
    }
    if (isYesterday) {
      return locale === 'es' ? 'Ayer' : 'Yesterday';
    }
    const sameYear = d.getFullYear() === now.getFullYear();
    if (sameYear) {
      // Día + mes corto (ej: 14 oct)
      try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(d); } catch { return d.toLocaleDateString(); }
    }
    // Año diferente: incluir año
    try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(d); } catch { return d.toLocaleDateString(); }
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    enabled: !!user,
    queryKey: ['matches-enriched-unread', user?.id],
    queryFn: async () => {
      // 1) Traer matches
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id,user_a,user_b,superlike,last_message_at,created_by_like_id')
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (error) throw error;

      const list = (matches || []) as MatchRow[];
      if (!list.length) return [];

      // Obtener lecturas propias desde match_reads (solo mi usuario)
      const matchIds = list.map(m => m.id);
      const { data: readRows } = await supabase
        .from('match_reads')
        .select('match_id,last_read_at')
        .eq('user_id', user!.id)
        .in('match_id', matchIds);
      const mapReads = new Map<number, string>( (readRows||[]).map(r => [r.match_id, r.last_read_at]) );

      // 2) Nombres
      const otherIds = Array.from(new Set(list.map((m) => (m.user_a === user!.id ? m.user_b : m.user_a))));
      const { data: profs } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', otherIds);
      const mapProfile = new Map<string, { name: string; avatar_url: string | null }>((profs || []).map((p: any) => [p.id, { name: p.display_name || 'Sin nombre', avatar_url: p.avatar_url || null }]));

      // 2b) Likes para dirección de superlike (mejor: mirar ambos sentidos entre tú y cada otro)
      // Hacemos dos queries separadas usando .in() para evitar problemas de quoting en UUIDs
      let superlikeFromMeSet = new Set<string>();
      let superlikeFromOtherSet = new Set<string>();
      if (otherIds.length) {
        try {
          // Yo → otros
          const { data: l1 } = await supabase
            .from('likes')
            .select('liker,liked')
            .eq('liker', user!.id)
            .in('liked', otherIds)
            .eq('type', 'superlike');
          for (const r of (l1 || []) as any[]) superlikeFromMeSet.add(r.liked);

          // Otros → yo
          const { data: l2 } = await supabase
            .from('likes')
            .select('liker,liked')
            .in('liker', otherIds)
            .eq('liked', user!.id)
            .eq('type', 'superlike');
          for (const r of (l2 || []) as any[]) superlikeFromOtherSet.add(r.liker);
        } catch {}
      }

      // Fallback adicional: si hay created_by_like_id, intentar deducir el liker a partir de esos ids
      const likeIds = Array.from(new Set((list.map(m => m.created_by_like_id).filter(Boolean) as number[])));
      let mapLikeLiker = new Map<number, string>();
      if (likeIds.length) {
        const { data: likesRows } = await supabase.from('likes').select('id,liker').in('id', likeIds);
        mapLikeLiker = new Map<number, string>((likesRows || []).map((r: any) => [r.id, r.liker]));
      }

      // 3) Batch fetch mensajes recientes para contar no leídos (evita N+1)
      const minRead = [...mapReads.values()].sort()[0] || '1970-01-01T00:00:00.000Z';
      // Traemos hasta 1000 mensajes recientes de estos matches (optimizable con RPC futura)
      const { data: recentForeign } = await supabase
        .from('messages')
        .select('id,match_id,sender,content,created_at')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(matchIds.length * 50, 1000));
      const msgs = (recentForeign || []) as any[];

      // Index último mensaje por match (primera ocurrencia orden desc)
      const lastMsgMap = new Map<number, any>();
      for (const m of msgs) {
        if (!lastMsgMap.has(m.match_id)) lastMsgMap.set(m.match_id, m);
      }
      // Contar no leídos (solo mensajes del otro y más nuevos que mi last_read)
      const unreadMap = new Map<number, number>();
      for (const m of msgs) {
        const myRead = mapReads.get(m.match_id) || null;
        if (m.sender !== user!.id && (!myRead || m.created_at > myRead)) {
          unreadMap.set(m.match_id, (unreadMap.get(m.match_id) || 0) + 1);
        }
      }

      const enriched = list.map(m => {
        const otherId = m.user_a === user!.id ? m.user_b : m.user_a;
        const prof = mapProfile.get(otherId);
        const otherName = prof?.name || 'Match';
        const otherAvatarUrl = prof?.avatar_url || null;
        const unreadCount = unreadMap.get(m.id) || 0;
        const lastMsg = lastMsgMap.get(m.id) || null;
        let preview: string | null = lastMsg ? lastMsg.content : null;
        if (preview && preview.length > 80) preview = preview.slice(0, 77) + '…';
        const lastAt = lastMsg ? lastMsg.created_at : m.last_message_at;
        // Dirección de superlike
        let superlikeFromMe = false;
        let superlikeFromOther = false;
        if (m.superlike) {
          // Preferimos datos de la consulta por pares
          superlikeFromMe = superlikeFromMeSet.has(otherId);
          superlikeFromOther = superlikeFromOtherSet.has(otherId);
          // Si no hay info por pares, probamos fallback por created_by_like_id
          if (!superlikeFromMe && !superlikeFromOther && m.created_by_like_id) {
            const liker = mapLikeLiker.get(m.created_by_like_id) || null;
            if (liker) {
              if (liker === user!.id) superlikeFromMe = true;
              else if (liker === otherId) superlikeFromOther = true;
            }
          }
        }

        return { ...m, otherId, otherName, otherAvatarUrl, unreadCount, preview, lastAt, superlikeFromMe, superlikeFromOther };
      });

      // 4) Ordenar: por actividad
      enriched.sort((a, b) => {
        if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
        if (a.lastAt && !b.lastAt) return -1;
        if (!a.lastAt && b.lastAt) return 1;
        return b.id - a.id;
      });

      return enriched;
    },
    // Fallback polling while Realtime may be disabled on backend
    refetchInterval: isFocused ? 8000 : false,
  });

  // Show pull-to-refresh spinner only on manual refresh, not on realtime refetches
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try { await refetch(); } finally { setManualRefreshing(false); }
  }, [refetch]);

  // Realtime: si llegan mensajes o cambian last_read, refrescamos
  useEffect(() => {
    if (!user?.id) return;
    const onChange = () => refetch();
    const chMsgs = supabase
      .channel('messages-for-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, onChange)
      .subscribe();
    const chMatches = supabase
      .channel('matches-for-list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, onChange)
      .subscribe();
    const chReads = supabase
      .channel('match-reads-for-me')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_reads', filter: `user_id=eq.${user.id}` }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(chMsgs); supabase.removeChannel(chMatches); supabase.removeChannel(chReads); };
  }, [user?.id]);

  // Refresh when the tab/screen regains focus
  useFocusEffect(useCallback(() => { if (user?.id) refetch(); }, [user?.id]));
  // Small delayed refetch to catch recent markRead() commits after navigating back
  useEffect(() => {
    if (isFocused && user?.id) {
      const t = setTimeout(() => { refetch(); }, 350);
      return () => clearTimeout(t);
    }
  }, [isFocused, user?.id]);

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (isLoading) {
    // Skeleton en lugar de spinner
    const skeletons = [0,1,2,3];
    return (
      <Screen style={{ padding:0 }} edges={[]}>        
        <CenterScaffold variant='auth'>
          <View style={{ flex:1, paddingTop:16 }}>
            {skeletons.map(i => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap: theme.spacing(1), backgroundColor: theme.colors.card, borderRadius: theme.radius, padding:12, borderWidth:1, borderColor: theme.colors.border, marginBottom: theme.spacing(1) }}>
                <View style={{ width:44, height:44, borderRadius:22, backgroundColor: theme.colors.border }} />
                <View style={{ flex:1 }}>
                  <View style={{ height:14, width:'50%', backgroundColor: theme.colors.border, borderRadius:7, marginBottom:6 }} />
                  <View style={{ height:10, width:'35%', backgroundColor: theme.colors.border, borderRadius:6 }} />
                </View>
              </View>
            ))}
          </View>
        </CenterScaffold>
      </Screen>
    );
  }

  return (
  <Screen style={{ padding:0 }} edges={[]}>
      <CenterScaffold variant='auth'>
        <AnimatedFlatList
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={data || []}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          keyExtractor={(m:any) => String(m.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop:16, paddingBottom:48, gap: theme.spacing(1) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
          renderItem={({ item }: any) => {
            const rel = formatRelative(item.lastAt);
            const starFromOther = !!(item.superlike && item.superlikeFromOther);
            const starFromMe = !!(item.superlike && item.superlikeFromMe);
            const slOtherText = locale === 'es' ? 'Te dio superlike' : 'Superliked you';
            const slMeText = locale === 'es' ? 'Diste superlike' : 'You superliked';
            return (
              <Pressable onPress={() => router.push(`/(tabs)/chat/${item.id}`)}>
                <Card style={{ flexDirection:'row', alignItems:'center', gap: theme.spacing(1) }}>
                  <View style={{ width:44, height:44, borderRadius:22, overflow:'hidden', backgroundColor: theme.colors.card, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor: theme.colors.border }}>
                    {item.otherAvatarUrl ? (
                      <Image source={{ uri: item.otherAvatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:16 }}>
                        {item.otherName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center' }}>
                      <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:8, paddingRight:8, position:'relative' }}>
                        <View style={{ flex:1, overflow:'hidden' }}>
                          <Text numberOfLines={1} style={{ color: theme.colors.text, fontWeight:'800', fontSize:16 }}>
                            {item.otherName}
                          </Text>
                          <LinearGradient
                            pointerEvents="none"
                            colors={[ 'rgba(0,0,0,0)', theme.colors.bgAlt ]}
                            start={{ x:0, y:0 }} end={{ x:1, y:0 }}
                            style={{ position:'absolute', right:0, top:0, bottom:0, width:22 }}
                          />
                        </View>
                        {item.unreadCount > 0 && (
                          <View style={{ minWidth:22, paddingHorizontal:6, paddingVertical:2, backgroundColor: theme.colors.primary, borderRadius:999, alignItems:'center' }}>
                            <Text style={{ color: theme.colors.primaryText, fontWeight:'800', fontSize:11 }}>{item.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                      {!!rel && (
                        <Text style={{ color: theme.colors.subtext, fontSize:11, marginLeft:8, textAlign:'right' }} numberOfLines={1}>
                          {rel}
                        </Text>
                      )}
                    </View>
                    {item.preview && (
                      <Text
                        numberOfLines={1}
                        style={{
                          color: item.unreadCount > 0 ? theme.colors.text : theme.colors.subtext,
                          fontSize: 12,
                          marginTop: 2,
                          fontWeight: item.unreadCount > 0 ? '600' as const : '400' as const,
                        }}
                      >
                        {item.preview}
                      </Text>
                    )}
                    {(starFromOther || starFromMe) && (
                      <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:8, marginTop: 4 }}>
                        {starFromOther && (
                          <Text style={{ color:'#F59E0B', fontWeight:'900', fontSize:12 }}>{slOtherText}</Text>
                        )}
                        {starFromMe && (
                          <Text style={{ color: theme.colors.primary, fontWeight:'900', fontSize:12 }}>{slMeText}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Card><Text style={{ color: theme.colors.text }}>{T.empty}</Text></Card>}
        />
      </CenterScaffold>
    </Screen>
  );
}
