import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Text, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { GradientScaffold } from '../../../features/profile/components/GradientScaffold';
import { theme } from '../../../lib/theme';

type MatchRow = {
  id: number;
  user_a: string;
  user_b: string;
  superlike: boolean;
  last_message_at: string | null;
};

const AnimatedFlatList: any = Animated.createAnimatedComponent(FlatList as any);

export default function ChatList() {
  const router = useRouter();
  const { user } = useAuth();

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
    const now = Date.now();
    const diffMs = now - d.getTime();
    const oneDay = 86400000;
    if (diffMs < oneDay) {
      try { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d); } catch { return d.toLocaleTimeString(); }
    }
    try { return new Intl.DateTimeFormat(locale, { month: 'short', day: '2-digit' }).format(d); } catch { return d.toLocaleDateString(); }
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    enabled: !!user,
    queryKey: ['matches-enriched-unread', user?.id],
    queryFn: async () => {
      // 1) Traer matches
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id,user_a,user_b,superlike,last_message_at')
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
      const { data: profs } = await supabase.from('profiles').select('id,display_name').in('id', otherIds);
      const mapName = new Map<string, string>((profs || []).map((p: any) => [p.id, p.display_name || 'Sin nombre']));

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
        const otherName = mapName.get(otherId) || 'Match';
        const unreadCount = unreadMap.get(m.id) || 0;
        const lastMsg = lastMsgMap.get(m.id) || null;
        let preview: string | null = lastMsg ? lastMsg.content : null;
        if (preview && preview.length > 80) preview = preview.slice(0, 77) + '…';
        const lastAt = lastMsg ? lastMsg.created_at : m.last_message_at;
        return { ...m, otherId, otherName, unreadCount, preview, lastAt };
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
  });

  // Realtime: si llegan mensajes o cambian last_read, refrescamos
  useEffect(() => {
    const chMsgs = supabase
      .channel('messages-for-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => refetch())
      .subscribe();
    const chMatches = supabase
      .channel('matches-for-list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(chMsgs); supabase.removeChannel(chMatches); };
  }, []);

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (isLoading) {
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

  return (
    <Screen style={{ padding:0 }}>
      <GradientScaffold>
        <AnimatedFlatList
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={data || []}
          refreshing={isRefetching}
          onRefresh={refetch}
          keyExtractor={(m:any) => String(m.id)}
          contentContainerStyle={{ paddingTop:16, paddingBottom:48, paddingHorizontal:16, gap: theme.spacing(1) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
          renderItem={({ item }: any) => {
            const rel = formatRelative(item.lastAt);
            return (
              <Pressable onPress={() => router.push(`/(tabs)/chat/${item.id}`)}>
                <Card style={{ flexDirection:'row', alignItems:'center', gap: theme.spacing(1) }}>
                  <View style={{ width:44, height:44, borderRadius:22, backgroundColor: theme.colors.card, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor: theme.colors.border }}>
                    <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:16 }}>
                      {item.otherName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                      <Text numberOfLines={1} style={{ flexShrink:1, color: theme.colors.text, fontWeight:'800', fontSize:16 }}>{item.otherName}</Text>
                      {item.superlike && <Text style={{ color:'#F59E0B', fontWeight:'900' }}>⭐</Text>}
                      {item.unreadCount > 0 && (
                        <View style={{ marginLeft:4, minWidth:24, paddingHorizontal:6, paddingVertical:2, backgroundColor: theme.colors.primary, borderRadius:999, alignItems:'center' }}>
                          <Text style={{ color: theme.colors.primaryText, fontWeight:'800', fontSize:12 }}>{item.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection:'row', marginTop:2, alignItems:'center' }}>
                      {item.preview && (
                        <Text numberOfLines={1} style={{ flex:1, color: theme.colors.subtext, fontSize:12 }}>
                          {item.preview}
                        </Text>
                      )}
                      {!!rel && (
                        <Text style={{ color: theme.colors.subtext, fontSize:11, marginLeft:6 }}>
                          {rel}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Card><Text style={{ color: theme.colors.text }}>{T.empty}</Text></Card>}
        />
      </GradientScaffold>
    </Screen>
  );
}
