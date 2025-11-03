import { supabase } from 'lib/supabase'

// Ensure a match row exists if there is reciprocal like between two users.
// Returns whether matched and the match id.
export async function ensureMatchConsistency(userId: string, targetId: string){
  try {
    if (!userId || !targetId || userId === targetId) return { matched: false as const, matchId: undefined as string | undefined }

    // 1) Check if target already liked me (like or superlike), any context
    const { data: reciprocal, error: likeErr } = await supabase
      .from('likes')
      .select('id')
      .eq('liker', targetId)
      .eq('liked', userId)
      .in('type', ['like','superlike'] as any)
      .limit(1)
    if (likeErr) {
      console.warn('[match] reciprocal like check error', likeErr.message)
    }
    if (!reciprocal || reciprocal.length === 0) {
      return { matched: false as const, matchId: undefined as string | undefined }
    }

    // 2) ¿Ya existe un match? (el trigger de DB crea el match cuando hay reciprocidad)
    const a = userId < targetId ? userId : targetId
    const b = userId < targetId ? targetId : userId
    const { data: existing, error: exErr } = await supabase
      .from('matches')
      .select('id')
      .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
      .limit(1)
    if (exErr) console.warn('[match] existing check error', exErr.message)
    if (existing && existing.length > 0) {
      const id = (existing as any)[0]?.id
      // 3) Asegurar match_reads para ambos usuarios (idempotente)
      try {
        await supabase.from('match_reads').upsert([
          { match_id: id, user_id: a },
          { match_id: id, user_id: b },
        ] as any, { onConflict: 'match_id,user_id' })
      } catch (e:any) { console.warn('[match] match_reads upsert error', e?.message) }
      return { matched: true as const, matchId: id }
    }
    // Si no existe match aún, no lo intentamos crear desde cliente (RLS lo impide);
    // devolvemos matched=false y dejamos que DB sea la fuente de verdad.
    return { matched: false as const, matchId: undefined as string | undefined }
  } catch (e:any) {
    console.warn('[match] ensureMatchConsistency exception', e?.message)
    return { matched: false as const, matchId: undefined as string | undefined }
  }
}
