import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { Badge } from '../../../components/Badge';
import { useAuth } from '../../../lib/useAuth';
import { canSuperlike, incSuperlike, remainingSuperlikes, decSuperlike } from '../../../lib/superlikes';
import { ensureMatchConsistency } from '../../../lib/match';
import { saveJSON, loadJSON } from '../../../lib/storage';
import { loadUserDefaultFilters, saveUserDefaultFilters, type FilterState } from '../../../lib/userPrefs';
import { usePremiumStore } from '../../../lib/premium';
import { openPaywall } from '../../../components/PaywallModal';

type ProfileRow = {
  id: string;
  display_name: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  interests: string[] | null;
};
type Status = 'match' | 'superlike' | 'like' | 'pass' | 'new';

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const Filters = React.memo(function Filters({
  minAge, setMinAge,
  maxAge, setMaxAge,
  gender, setGender,
  interest, setInterest,
  loadGlobalsIntoEvent,
  saveCurrentAsGlobals,
}: {
  minAge: string; setMinAge: (v: string) => void;
  maxAge: string; setMaxAge: (v: string) => void;
  gender: 'any' | 'male' | 'female' | 'other'; setGender: (g: 'any' | 'male' | 'female' | 'other') => void;
  interest: string; setInterest: (v: string) => void;
  loadGlobalsIntoEvent: () => void; saveCurrentAsGlobals: () => void;
}) {
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Filtros</Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Edad mín.</Text>
          <TextInput
            value={minAge}
            onChangeText={setMinAge}
            keyboardType="number-pad"
            inputMode="numeric"
            blurOnSubmit={false}
            placeholder="18"
            placeholderTextColor={theme.colors.subtext}
            style={{
              color: theme.colors.text, backgroundColor: theme.colors.card,
              borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
              paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Edad máx.</Text>
          <TextInput
            value={maxAge}
            onChangeText={setMaxAge}
            keyboardType="number-pad"
            inputMode="numeric"
            blurOnSubmit={false}
            placeholder="40"
            placeholderTextColor={theme.colors.subtext}
            style={{
              color: theme.colors.text, backgroundColor: theme.colors.card,
              borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
              paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            }}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(['any','male','female','other'] as const).map((g) => {
          const active = gender === g;
          const label = g === 'any' ? 'Todos' : g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : 'Otro';
          return (
            <Pressable
              key={g}
              onPress={() => setGender(g)}
              style={{
                paddingVertical: 8, paddingHorizontal: 12, borderRadius: theme.radius, borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: active ? theme.colors.primaryText : theme.colors.text, fontWeight: '700' }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <Text style={{ color: theme.colors.subtext, marginBottom: 4 }}>Interés contiene…</Text>
        <TextInput
          value={interest}
          onChangeText={setInterest}
          placeholder="salsa, techno, indie…"
          placeholderTextColor={theme.colors.subtext}
          blurOnSubmit={false}
          style={{
            color: theme.colors.text, backgroundColor: theme.colors.card,
            borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
            paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          title="Limpiar filtros"
          variant="ghost"
          onPress={() => { setMinAge(''); setMaxAge(''); setGender('any'); setInterest(''); }}
        />
        <View style={{ flex: 1 }} />
        <View style={{ width: '100%', flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Cargar globales" variant="ghost" onPress={loadGlobalsIntoEvent} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Guardar como globales" onPress={saveCurrentAsGlobals} />
          </View>
        </View>
      </View>
    </Card>
  );
});

type ActionItem = {
  targetId: string;
  type: Status;           // 'like' | 'superlike' | 'pass'
  likeRowId?: number | null;
};

export default function FeedByEvent() {
  const { eventId, source } = useLocalSearchParams<{ eventId: string; source?: string }>();
  const eid = Number(eventId);
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  // premium via store
  const { isPremium, refresh: refreshPremium } = usePremiumStore();
  useEffect(() => {
    if (user?.id) refreshPremium(user.id);
  }, [user?.id]);

  // estado local (optimista) por usuario
  const [local, setLocal] = useState<Map<string, Status>>(new Map());
  const setLocalStatus = (id: string, s: Status) => setLocal((m) => new Map(m).set(id, s));

  // filtros por evento con fallback a globales
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');
  const [gender, setGender] = useState<'any' | 'male' | 'female' | 'other'>('any');
  const [interest, setInterest] = useState<string>('');

  // contador visible de superlikes restantes
  const { data: remaining = 0, refetch: refetchRemaining } = useQuery({
    enabled: !!user,
    queryKey: ['superlikes-remaining', user?.id],
    queryFn: async () => remainingSuperlikes(user!.id, 3),
  });

  // cargar filtros (evento → globales si no hay)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const key = `filters:event:${eid}`;
      const byEvent = await loadJSON<FilterState>(key);
      if (mounted && byEvent) {
        setMinAge(byEvent.minAge);
        setMaxAge(byEvent.maxAge);
        setGender(byEvent.gender);
        setInterest(byEvent.interest);
        return;
      }
      const globals = await loadUserDefaultFilters();
      if (mounted && globals) {
        setMinAge(globals.minAge);
        setMaxAge(globals.maxAge);
        setGender(globals.gender);
        setInterest(globals.interest);
      }
    })();
    return () => { mounted = false; };
  }, [eid]);

  // persistir cada cambio de filtros por evento
  useEffect(() => {
    const t = setTimeout(() => {
      const state: FilterState = { minAge, maxAge, gender, interest };
      saveJSON(`filters:event:${eid}`, state);
    }, 250);
    return () => clearTimeout(t);
  }, [eid, minAge, maxAge, gender, interest]);

  // título del evento
  const { data: eventTitle } = useQuery<string | null>({
    queryKey: ['event-title', eid],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('title').eq('id', eid).maybeSingle();
      return (data?.title as string) ?? null;
    },
  });

  // dataset principal
  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['feed-by-event', eid, user?.id],
    queryFn: async () => {
      // asistentes (excluyéndome)
      const { data: att } = await supabase
        .from('event_attendance')
        .select('user_id')
        .eq('event_id', eid)
        .eq('status', 'going');

      const ids = (att || []).map((a: any) => a.user_id).filter((id: string) => id !== user!.id);

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, age, gender, interests')
        .in('id', ids);

      // mis decisiones previas
      const { data: myPositives } = await supabase
        .from('likes').select('id, liked, type, created_at')
        .eq('liker', user!.id)
        .in('type', ['like','superlike'])
        .order('created_at', { ascending: false });
      const likeType = new Map<string, 'like'|'superlike'>();
      (myPositives || []).forEach((l: any) => { if (!likeType.has(l.liked)) likeType.set(l.liked, l.type); });

      const { data: myPasses } = await supabase
        .from('likes').select('liked,created_at')
        .eq('liker', user!.id).eq('type','pass')
        .order('created_at', { ascending: false });
      const passSet = new Set<string>();
      (myPasses || []).forEach((p: any) => passSet.add(p.liked));

      const { data: myMatches } = await supabase
        .from('matches').select('user_a, user_b')
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const matchedSet = new Set<string>();
      for (const m of myMatches || []) matchedSet.add(m.user_a === user!.id ? m.user_b : m.user_a);

      // BOOST: quién me dio superlike
      const { data: boosters } = await supabase
        .from('likes')
        .select('liker')
        .eq('liked', user!.id)
        .eq('type', 'superlike');
      const boostSet = new Set<string>((boosters || []).map((b: any) => b.liker));

      return { rows: (profs || []) as ProfileRow[], likeType, passSet, matchedSet, boostSet };
    },
  });

  const baseStatusOf = (id: string): Status => {
    if (!data) return 'new';
    if (data.matchedSet.has(id)) return 'match';
    if (data.likeType.get(id) === 'superlike') return 'superlike';
    if (data.likeType.get(id) === 'like') return 'like';
    if (data.passSet.has(id)) return 'pass';
    return 'new';
  };
  const statusOf = (id: string): Status => local.get(id) ?? baseStatusOf(id);

  const applyFilters = (rows: ProfileRow[]) => {
    const min = minAge.trim() ? Number(minAge) : null;
    const max = maxAge.trim() ? Number(maxAge) : null;
    const g = gender;
    const q = norm(interest.trim());
    return rows.filter((u) => {
      if (min !== null && (u.age ?? 999) < min) return false;
      if (max !== null && (u.age ?? 0) > max) return false;
      if (g !== 'any' && u.gender !== g) return false;
      if (q) {
        const pool = [u.display_name || '', ...(u.interests || [])].map(norm);
        if (!pool.some((s) => s.includes(q))) return false;
      }
      return true;
    });
  };

  const people = useMemo(() => {
    if (!data) return [];
    let list = [...data.rows];
    if (!source) list = list.filter((u) => statusOf(u.id) === 'new');
    list = applyFilters(list);
    // BOOST primero
    list.sort((a, b) => {
      const ab = data.boostSet.has(a.id) ? 1 : 0;
      const bb = data.boostSet.has(b.id) ? 1 : 0;
      return bb - ab;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, local, minAge, maxAge, gender, interest, source]);

  // índice del carrusel
  const [index, setIndex] = useState(0);
  const [focusUserId, setFocusUserId] = useState<string | null>(null);
  useEffect(() => {
    if (index >= people.length) setIndex(0);
  }, [people.length, index]);

  // util para ir a un usuario concreto si sigue visible con los filtros
  const goToUserIdIfPresent = (id: string) => {
    const idx = people.findIndex((p) => p.id === id);
    if (idx >= 0) setIndex(idx);
  };

  // pila de acciones para UNDO
  const actionsRef = useRef<ActionItem[]>([]);

  const openChatWith = async (targetId: string) => {
    const ua = user!.id < targetId ? user!.id : targetId;
    const ub = user!.id < targetId ? targetId : user!.id;
    const { data: m } = await supabase
      .from('matches')
      .select('id,user_a,user_b')
      .eq('user_a', ua).eq('user_b', ub).maybeSingle();
    if (!m) return Alert.alert('Sin chat', 'Aún no hay match con esta persona.');
    router.push(`/(tabs)/chat/${m.id}`);
  };

  const advance = () => setIndex((i) => i + 1);

  // ---- PASS (con upsert) ----
  const doPass = async (targetId: string) => {
    // optimista
    setLocalStatus(targetId, 'pass');
    setFocusUserId(null);
    advance();

    // upsert por clave (liker,liked,context_event_id)
    const payload = {
      liker: user!.id,
      liked: targetId,
      type: 'pass' as const,
      context_event_id: eid,
      created_at: new Date().toISOString(),
    };

    const { data: up, error } = await supabase
      .from('likes')
      .upsert(payload, { onConflict: 'liker,liked,context_event_id' })
      .select('id')
      .single();

    // registrar acción para UNDO
    if (!error) {
      actionsRef.current.push({ targetId, type: 'pass', likeRowId: up?.id ?? null });
    }

    if (error) {
      Alert.alert('Error', error.message);
      // revertir optimista
      setLocal((m) => { const n = new Map(m); n.delete(targetId); return n; });
      setIndex((i) => Math.max(i - 1, 0));
      // retirar acción
      actionsRef.current.pop();
      return;
    }

    await ensureMatchConsistency(user!.id, targetId);
    refetch();
  };

  // ---- LIKE / SUPERLIKE (con upsert) ----
  const doLike = async (targetId: string, type: 'like' | 'superlike') => {
    if (type === 'superlike') {
      const { ok } = await canSuperlike(user!.id, 3);
      if (!ok) return Alert.alert('Límite diario', 'Has agotado tus ⭐ Superlikes de hoy.');
    }

    // optimista
    setLocalStatus(targetId, type);
    setFocusUserId(null);
    advance();

    const payload = {
      liker: user!.id,
      liked: targetId,
      type,
      context_event_id: eid,
      created_at: new Date().toISOString(),
    };

    const { data: up, error } = await supabase
      .from('likes')
      .upsert(payload, { onConflict: 'liker,liked,context_event_id' })
      .select('id')
      .single();

    // registrar/actualizar acción para UNDO
    if (!error) {
      actionsRef.current.push({ targetId, type, likeRowId: up?.id ?? null });
    }

    if (error) {
      Alert.alert('Error', error.message);
      setLocal((m) => { const n = new Map(m); n.delete(targetId); return n; });
      setIndex((i) => Math.max(i - 1, 0));
      actionsRef.current.pop();
      return;
    }

    if (type === 'superlike') { await incSuperlike(user!.id); refetchRemaining(); }

    const { matched, matchId } = await ensureMatchConsistency(user!.id, targetId);
    refetch();

    if (matched && matchId) {
      Alert.alert(
        '¡Hay match! 🎉',
        '¿Quieres ir al chat ahora?',
        [
          { text: 'Seguir en feed', style: 'cancel' },
          { text: 'Ir al chat', onPress: () => router.push(`/(tabs)/chat/${matchId}`) },
        ]
      );
      // push opcional al otro usuario
      try {
        await supabase.functions.invoke('notify', {
          body: { type: 'match', toUserId: targetId, title: '¡Nuevo match!', body: 'Tienes un nuevo match en Wispic 🎉' },
        });
      } catch {}
    }
  };

  const loadGlobalsIntoEvent = async () => {
    const g = await loadUserDefaultFilters();
    if (!g) return Alert.alert('Sin globales', 'Aún no has definido preferencias globales en tu perfil.');
    setMinAge(g.minAge); setMaxAge(g.maxAge); setGender(g.gender); setInterest(g.interest);
    await saveJSON(`filters:event:${eid}`, g);
    Alert.alert('Hecho', 'Cargadas las preferencias globales en este evento.');
  };

  const saveCurrentAsGlobals = async () => {
    const state: FilterState = { minAge, maxAge, gender, interest };
    await saveUserDefaultFilters(state);
    Alert.alert('Listo', 'Filtros actuales guardados como globales.');
  };

  // UNDO (premium + borra exactamente la fila del mismo evento)
  const undoLast = async () => {
    if (!isPremium) {
      openPaywall('Deshacer última decisión');
      return;
    }
    const last = actionsRef.current.pop();
    if (!last) {
      Alert.alert('Nada que deshacer', 'No hay decisiones anteriores en esta sesión.');
      return;
    }

    // 1) Intentar borrar por id
    if (last.likeRowId) {
      await supabase.from('likes').delete().eq('id', last.likeRowId);
    } else {
      // 2) Borrar por clave única completa (mismo evento)
      await supabase
        .from('likes')
        .delete()
        .eq('liker', user!.id)
        .eq('liked', last.targetId)
        .eq('context_event_id', eid);
    }

    // 3) Si era superlike → reembolsar 1 uso
    if (last.type === 'superlike') {
      await decSuperlike(user!.id);
      refetchRemaining();
    }

    // 4) Recalcular match y refrescar vistas
    await ensureMatchConsistency(user!.id, last.targetId);
    setLocalStatus(last.targetId, 'new');
    await refetch();
    await qc.invalidateQueries({ queryKey: ['event-people-full-global'] });
    await qc.invalidateQueries({ queryKey: ['matches-enriched3', user?.id] });

    // 5) Volver al usuario si sigue visible
    const idx = people.findIndex((p) => p.id === last.targetId);
    if (idx >= 0) setIndex(idx);

    Alert.alert('Hecho', 'Se deshizo tu última decisión.');
  };

  const current = focusUserId
    ? people.find((p) => p.id === focusUserId) ?? people[index]
    : people[index];
  const onBack = () => router.replace('/(tabs)/feed');

  return (
    <Screen>
      <TopBar title={`Feed de ${eventTitle ?? `evento ${eid}`}`} onBack={onBack} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: theme.spacing(1), paddingBottom: theme.spacing(2) }}>
        <Filters
          minAge={minAge} setMinAge={setMinAge}
          maxAge={maxAge} setMaxAge={setMaxAge}
          gender={gender} setGender={setGender}
          interest={interest} setInterest={setInterest}
          loadGlobalsIntoEvent={loadGlobalsIntoEvent}
          saveCurrentAsGlobals={saveCurrentAsGlobals}
        />

        <Card>
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
            ⭐ Te quedan {remaining} superlikes hoy
          </Text>
        </Card>

        <Card>
          <Button
            title="↩️ Deshacer última"
            onPress={undoLast}
            variant={isPremium ? 'primary' : 'ghost'}
          />
          {!isPremium && (
            <Text style={{ color: theme.colors.subtext, marginTop: 6 }}>
              Función premium — se abrirá una ventana para activar Premium si lo necesitas.
            </Text>
          )}
        </Card>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 8 }} color={theme.colors.primary} />
        ) : error ? (
          <Card><Text style={{ color: theme.colors.text }}>Error cargando feed</Text></Card>
        ) : !current ? (
          <Card>
            <Text style={{ color: theme.colors.text }}>
              {source ? 'No hay perfiles que cumplan los filtros.' : 'No tienes personas pendientes (o no cumplen filtros).'}
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: theme.spacing(1), alignItems: 'center' }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card,
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border,
            }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.text }}>
                {(current.display_name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>

            {data?.boostSet.has(current.id) && (
              <Badge label="⭐ Te dio superlike" variant="success" />
            )}

            <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 20 }}>
              {current.display_name || 'Sin nombre'}
            </Text>
            <Text style={{ color: theme.colors.subtext }}>
              {current.age ? `${current.age} · ` : ''}{current.gender ? (current.gender === 'male' ? 'Hombre' : current.gender === 'female' ? 'Mujer' : 'Otro') : '—'}
            </Text>
            {!!(current.interests && current.interests.length) && (
              <Text style={{ color: theme.colors.subtext }}>
                Intereses: {current.interests.join(', ')}
              </Text>
            )}

            <View style={{ marginVertical: 8 }}>
              <Badge
                key={`${current.id}:${(local.get(current.id) ?? 'new')}`}
                label={
                  (local.get(current.id) ?? 'new') === 'match' ? 'Match'
                  : (local.get(current.id) ?? 'new') === 'superlike' ? '⭐ Superlike enviado'
                  : (local.get(current.id) ?? 'new') === 'like' ? 'Like enviado'
                  : (local.get(current.id) ?? 'new') === 'pass' ? 'No te interesa'
                  : 'Nuevo'
                }
                variant={(local.get(current.id) ?? 'new') === 'match' ? 'success' : (local.get(current.id) ?? 'new') === 'new' ? 'neutral' : 'warning'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing(2), flexWrap: 'wrap', justifyContent: 'center' }}>
              {(local.get(current.id) ?? 'new') === 'new' && (
                <>
                  <Button title="❌ No" onPress={() => doPass(current.id)} variant="ghost" />
                  <Button title="❤️ Like" onPress={() => doLike(current.id, 'like')} />
                  <Button title="⭐ Superlike" onPress={() => doLike(current.id, 'superlike')} variant="ghost" />
                </>
              )}
              {(local.get(current.id) ?? 'new') === 'like' && <Text style={{ color: theme.colors.subtext }}>Ya enviaste Like</Text>}
              {(local.get(current.id) ?? 'new') === 'superlike' && <Text style={{ color: theme.colors.subtext }}>Ya enviaste ⭐ Superlike</Text>}
              {(local.get(current.id) ?? 'new') === 'pass' && <Text style={{ color: theme.colors.subtext }}>Descartado</Text>}
              {(local.get(current.id) ?? 'new') === 'match' && <Button title="Ir al chat" onPress={() => openChatWith(current.id)} />}
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
