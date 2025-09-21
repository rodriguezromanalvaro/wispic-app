import { supabase } from './supabase';

type Decision = 'like' | 'superlike' | 'pass';
const isPositive = (t?: string) => t === 'like' || t === 'superlike';

/**
 * Devuelve la ÚLTIMA decisión A->B (o undefined si nunca decidió).
 */
async function getLastDecision(liker: string, liked: string): Promise<Decision | undefined> {
  const { data, error } = await supabase
    .from('likes')
    .select('type')
    .eq('liker', liker)
    .eq('liked', liked)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return undefined;
  return data?.[0]?.type as Decision | undefined;
}

/**
 * Garantiza que el estado de `matches` refleje las ÚLTIMAS decisiones de ambos.
 * - Si ambas últimas son ❤️/⭐ → asegura que exista match (lo crea si falta).
 * - En cualquier otro caso → asegura que NO exista match (lo borra si estaba).
 *
 * Devuelve:
 *  - matched: estado final (true/false)
 *  - matchId: id si existe
 *  - changed: si insertó o borró algo
 */
export async function ensureMatchConsistency(aId: string, bId: string): Promise<{ matched: boolean; matchId: number | null; changed: boolean }> {
  // Orden estable para la fila de matches
  const ua = aId < bId ? aId : bId;
  const ub = aId < bId ? bId : aId;

  // Últimas decisiones (en cualquier evento)
  const [ab, ba] = await Promise.all([
    getLastDecision(aId, bId),
    getLastDecision(bId, aId),
  ]);

  // ¿Existe match hoy?
  const { data: existing } = await supabase
    .from('matches')
    .select('id, superlike')
    .eq('user_a', ua)
    .eq('user_b', ub)
    .maybeSingle();

  const bothPositive = isPositive(ab) && isPositive(ba);

  // Caso 1: ambas positivas → debe existir match
  if (bothPositive) {
    if (existing) {
      // ya existe, quizá actualizamos "superlike" si una de las últimas fue ⭐
      const usedSuper = ab === 'superlike' || ba === 'superlike';
      if (existing.superlike !== usedSuper) {
        await supabase.from('matches').update({ superlike: usedSuper }).eq('id', existing.id);
        return { matched: true, matchId: existing.id, changed: true };
      }
      return { matched: true, matchId: existing.id, changed: false };
    } else {
      const usedSuper = ab === 'superlike' || ba === 'superlike';
      const { data: created, error } = await supabase
        .from('matches')
        .insert({ user_a: ua, user_b: ub, superlike: usedSuper })
        .select('id')
        .single();
      if (error || !created) {
        // carrera: consultar otra vez
        const { data: again } = await supabase
          .from('matches')
          .select('id')
          .eq('user_a', ua)
          .eq('user_b', ub)
          .maybeSingle();
        return again ? { matched: true, matchId: again.id, changed: false } : { matched: false, matchId: null, changed: false };
      }
      return { matched: true, matchId: created.id, changed: true };
    }
  }

  // Caso 2: alguna última es ❌ o falta decisión → NO debe existir match
  if (existing) {
    await supabase.from('matches').delete().eq('id', existing.id);
    // opcional: también podrías borrar mensajes del match si quieres "limpieza total"
    // await supabase.from('messages').delete().eq('match_id', existing.id);
    return { matched: false, matchId: null, changed: true };
  }
  return { matched: false, matchId: null, changed: false };
}

/**
 * Atajo: llama a ensureMatchConsistency y, si hay match final, devuelve {matched:true, matchId}.
 * La diferencia con la versión anterior es que aquí nunca deja un match si las últimas decisiones no son positivas.
 */
export async function checkAndCreateMatch(myId: string, otherId: string) {
  const res = await ensureMatchConsistency(myId, otherId);
  return { matched: res.matched, matchId: res.matchId };
}
