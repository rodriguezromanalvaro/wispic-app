import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Text, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';

type MatchRow = {
  id: number;
  user_a: string;
  user_b: string;
  superlike: boolean;
  last_message_at: string | null;
  last_read_a: string | null;
  last_read_b: string | null;
};

export default function ChatList() {
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    enabled: !!user,
    queryKey: ['matches-enriched-unread', user?.id],
    queryFn: async () => {
      // 1) Traer matches
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id,user_a,user_b,superlike,last_message_at,last_read_a,last_read_b')
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (error) throw error;

      const list = (matches || []) as MatchRow[];
      if (!list.length) return [];

      // 2) Nombres
      const otherIds = Array.from(new Set(list.map((m) => (m.user_a === user!.id ? m.user_b : m.user_a))));
      const { data: profs } = await supabase.from('profiles').select('id,display_name').in('id', otherIds);
      const mapName = new Map<string, string>((profs || []).map((p: any) => [p.id, p.display_name || 'Sin nombre']));

      // 3) Contar no leídos por match (mensajes de la otra persona > mi last_read)
      const enriched = await Promise.all(list.map(async (m) => {
        const otherId = m.user_a === user!.id ? m.user_b : m.user_a;
        const otherName = mapName.get(otherId) || 'Match';
        const myRead = m.user_a === user!.id ? m.last_read_a : m.last_read_b;

        let unreadCount = 0;
        if (m.last_message_at) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', m.id)
            .neq('sender', user!.id)
            .gt('created_at', myRead || '1970-01-01T00:00:00.000Z'); // si nunca leí, cuenta desde el inicio
          unreadCount = count || 0;
        }

        return { ...m, otherId, otherName, unreadCount };
      }));

      // 4) Ordenar: por actividad
      enriched.sort((a, b) => {
        if (a.last_message_at && b.last_message_at) return a.last_message_at < b.last_message_at ? 1 : -1;
        if (a.last_message_at && !b.last_message_at) return -1;
        if (!a.last_message_at && b.last_message_at) return 1;
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

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />;

  return (
    <Screen>
      <TopBar title="Chats" hideBack />
      <FlatList
        data={data || []}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyExtractor={(m) => String(m.id)}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(tabs)/chat/${item.id}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.card,
                alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border,
              }}>
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                  {item.otherName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 16 }}>
                    {item.otherName}
                  </Text>
                  {item.superlike && <Text style={{ color: '#F59E0B', fontWeight: '900' }}>⭐</Text>}
                  {item.unreadCount > 0 && (
                    <View style={{ marginLeft: 4, minWidth: 24, paddingHorizontal: 6, paddingVertical: 2,
                      backgroundColor: theme.colors.primary, borderRadius: 999, alignItems: 'center' }}>
                      <Text style={{ color: theme.colors.primaryText, fontWeight: '800', fontSize: 12 }}>
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                {!!item.last_message_at && (
                  <Text style={{ color: theme.colors.subtext, marginTop: 2, fontSize: 12 }}>
                    Último: {new Date(item.last_message_at).toLocaleString()}
                  </Text>
                )}
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Card><Text style={{ color: theme.colors.text }}>Aún no tienes chats.</Text></Card>}
      />
    </Screen>
  );
}
