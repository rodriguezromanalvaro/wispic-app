import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  TextInput as RNTextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { Badge } from '../../../components/Badge';
import { useAuth } from '../../../lib/useAuth';
import { canSuperlike, incSuperlike } from '../../../lib/superlikes';
import { ensureMatchConsistency } from '../../../lib/match';

type Row = { id: string; display_name: string | null };
type Status = 'match' | 'superlike' | 'like' | 'pass' | 'new';

export default function EventPeople() {
  const router = useRouter();
  const { user } = useAuth();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const eid = Number(eventId);

  // ---- Estado local optimista por usuario ----
  const [local, setLocal] = useState<Map<string, Status>>(new Map());
  const setLocalStatus = (id: string, s: Status) =>
    setLocal((m) => new Map(m).set(id, s));

  // Título del evento
  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['event', eid],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id,title').eq('id', eid).maybeSingle();
      return data;
    },
  });

  // Asistentes (excepto yo) + estado GLOBAL
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    enabled: !!user,
    queryKey: ['event-people-full-global', eid, user?.id],
    queryFn: async () => {
      const { data: att } = await supabase
        .from('event_attendance')
        .select('user_id')
        .eq('event_id', eid)
        .eq('status', 'going');

      const ids = (att || []).map((a: any) => a.user_id).filter((id: string) => id !== user!.id);
      if (!ids.length) return { rows: [] as Row[], likeType: new Map<string, 'like'|'superlike'>(), passSet: new Set<string>(), matchedSet: new Set<string>() };

      const { data: profs } = await supabase
        .from('profiles').select('id, display_name').in('id', ids);

      // Positivos últimos
      const { data: myPositives } = await supabase
        .from('likes').select('liked,type,created_at')
        .eq('liker', user!.id)
        .in('type', ['like','superlike'])
        .order('created_at', { ascending: false });
      const likeType = new Map<string, 'like'|'superlike'>();
      (myPositives || []).forEach((l: any) => {
        if (!likeType.has(l.liked)) likeType.set(l.liked, l.type);
      });

      // Pass últimos
      const { data: myPasses } = await supabase
        .from('likes').select('liked,created_at')
        .eq('liker', user!.id)
        .eq('type','pass')
        .order('created_at', { ascending: false });
      const passSet = new Set<string>();
      (myPasses || []).forEach((p: any) => passSet.add(p.liked));

      // Matches actuales
      const { data: myMatches } = await supabase
        .from('matches').select('user_a, user_b')
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const matchedSet = new Set<string>();
      for (const m of myMatches || []) matchedSet.add(m.user_a === user!.id ? m.user_b : m.user_a);

      return { rows: (profs || []) as Row[], likeType, passSet, matchedSet };
    },
  });

  const [onlyNew, setOnlyNew] = useState(true);
  const [q, setQ] = useState('');

  const baseStatusOf = (id: string): Status => {
    if (!data) return 'new';
    if (data.matchedSet.has(id)) return 'match';
    if (data.likeType.get(id) === 'superlike') return 'superlike';
    if (data.likeType.get(id) === 'like') return 'like';
    if (data.passSet.has(id)) return 'pass';
    return 'new';
  };
  const statusOf = (id: string): Status => local.get(id) ?? baseStatusOf(id);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.rows
      .filter((p) => (q ? (p.display_name || '').toLowerCase().includes(q.toLowerCase()) : true))
      .filter((p) => (onlyNew ? ['new'].includes(statusOf(p.id)) : true))
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }, [data, q, onlyNew, local]);

  const renderBadgeById = (id: string) => {
    const st = statusOf(id);
    switch (st) {
      case 'match': return <Badge label="Match" variant="success" />;
      case 'superlike': return <Badge label="⭐ Superlike enviado" variant="warning" />;
      case 'like': return <Badge label="Like enviado" variant="warning" />;
      case 'pass': return <Badge label="No te interesa" />;
      default: return <Badge label="Nuevo" />;
    }
  };

  const ensureNotDecided = async (targetId: string) => {
    const { data: existing } = await supabase
      .from('likes').select('id,type')
      .eq('liker', user!.id).eq('liked', targetId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existing && existing.length) {
      Alert.alert('Ya decidido', 'Cambiar de opinión será una función premium 😉');
      return false;
    }
    return true;
  };

  const openChatWith = async (targetId: string) => {
    const ua = user!.id < targetId ? user!.id : targetId;
    const ub = user!.id < targetId ? targetId : user!.id;
    const { data: m } = await supabase
      .from('matches')
      .select('id,user_a,user_b')
      .eq('user_a', ua)
      .eq('user_b', ub)
      .maybeSingle();

    if (!m) {
      return Alert.alert('Sin chat', 'Aún no hay match con esta persona.');
    }
    router.push(`/(tabs)/chat/${m.id}`);
  };

  const doPass = async (targetId: string) => {
    if (!(await ensureNotDecided(targetId))) return;
    setLocalStatus(targetId, 'pass');

    const { error } = await supabase.from('likes').insert({
      liker: user!.id, liked: targetId, type: 'pass', context_event_id: eid,
    });
    if (error) {
      Alert.alert('Error', error.message);
      setLocal((m) => { const n = new Map(m); n.delete(targetId); return n; });
      return;
    }

    await ensureMatchConsistency(user!.id, targetId);
    await refetch();
  };

  const doLike = async (targetId: string, type: 'like' | 'superlike') => {
    if (!(await ensureNotDecided(targetId))) {
      if (type === 'superlike' && statusOf(targetId) === 'superlike') {
        Alert.alert('Repetido', 'Ya enviaste un ⭐ Superlike a este perfil.');
      }
      return;
    }
    if (type === 'superlike') {
      const { ok } = await canSuperlike(user!.id, 3);
      if (!ok) return Alert.alert('Límite diario', 'Has agotado tus ⭐ Superlikes de hoy.');
    }

    setLocalStatus(targetId, type);

    const { error } = await supabase.from('likes').insert({
      liker: user!.id, liked: targetId, type, context_event_id: eid,
    });
    if (error) {
      Alert.alert('Error', error.message);
      setLocal((m) => { const n = new Map(m); n.delete(targetId); return n; });
      return;
    }
    if (type === 'superlike') await incSuperlike(user!.id);

    const { matched, matchId } = await ensureMatchConsistency(user!.id, targetId);

    // 👇 si hay match, reflejarlo en el badge aunque decidas “Seguir en asistentes”
    if (matched) setLocalStatus(targetId, 'match');

    await refetch();

    if (matched && matchId) {
      Alert.alert(
        '¡Hay match! 🎉',
        '¿Quieres ir al chat ahora?',
        [
          { text: 'Seguir en asistentes', style: 'cancel' },
          { text: 'Ir al chat', onPress: () => router.push(`/(tabs)/chat/${matchId}`) },
        ]
      );
    }
  };

  if (isLoading || isLoadingEvent) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />;
  }

  return (
    <Screen>
      <TopBar title={event?.title ? `Asistentes: ${event.title}` : 'Asistentes'} />

      {/* Controles */}
      <Card style={{ gap: theme.spacing(1) }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <RNTextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por nombre"
            placeholderTextColor={theme.colors.subtext}
            style={{
              flex: 1,
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
              borderWidth: 1, borderColor: theme.colors.border,
              borderRadius: theme.radius,
              paddingHorizontal: 12, paddingVertical: 10,
            }}
          />
          <Pressable
            onPress={() => setOnlyNew((v) => !v)}
            style={{
              paddingHorizontal: 12, justifyContent: 'center',
              borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
              backgroundColor: onlyNew ? theme.colors.primary : theme.colors.card,
            }}
          >
            <Text style={{ color: onlyNew ? theme.colors.primaryText : theme.colors.text, fontWeight: '700' }}>
              {onlyNew ? 'Solo no vistos' : 'Todos'}
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* Lista */}
      {error ? (
        <Card><Text style={{ color: theme.colors.text }}>Error cargando asistentes</Text></Card>
      ) : (
        <FlatList
          data={filtered}
          refreshing={isRefetching}
          onRefresh={refetch}
          keyExtractor={(u) => u.id}
          extraData={local}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1) }} />}
          renderItem={({ item }) => {
            const st = statusOf(item.id);
            return (
              <Card style={{ gap: theme.spacing(0.75) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.card,
                    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border,
                  }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                      {(item.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                      {item.display_name || 'Sin nombre'}
                    </Text>
                  </View>
                  {renderBadgeById(item.id)}
                </View>

                {/* Acciones */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) }}>
                  {st === 'match' && (
                    <Button title="Ir al chat" onPress={() => openChatWith(item.id)} variant="ghost" />
                  )}

                  {st === 'new' && (
                    <>
                      <Button title="❌ No" onPress={() => doPass(item.id)} variant="ghost" />
                      <Button title="❤️ Like" onPress={() => doLike(item.id, 'like')} />
                      <Button title="⭐ Superlike" onPress={() => doLike(item.id, 'superlike')} variant="ghost" />
                    </>
                  )}
                  {st === 'like' && <Text style={{ color: theme.colors.subtext, alignSelf: 'center' }}>Ya enviaste Like</Text>}
                  {st === 'superlike' && <Text style={{ color: theme.colors.subtext, alignSelf: 'center' }}>Ya enviaste ⭐ Superlike</Text>}
                  {st === 'pass' && <Text style={{ color: theme.colors.subtext, alignSelf: 'center' }}>Descartado</Text>}
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<Card><Text style={{ color: theme.colors.text }}>No hay asistentes que cumplan el filtro.</Text></Card>}
        />
      )}
    </Screen>
  );
}
