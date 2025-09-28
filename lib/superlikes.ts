import { supabase } from './supabase';

/** Normaliza la fecha a YYYY-MM-DD (UTC) */
function todayUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Devuelve cuántos superlikes llevas usados hoy. */
export async function getUsedToday(userId: string): Promise<number> {
  const day = todayUTC();
  const { data, error } = await supabase
    .from('superlike_counters')
    .select('used')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  if (error) {
    console.warn('Error en getUsedToday:', error);
    return 0;
  }
  return data?.used ?? 0;
}

/** ¿Puedes usar un superlike hoy? y cuántos te quedan. */
export async function canSuperlike(userId: string, dailyLimit: number) {
  const used = await getUsedToday(userId);
  const remaining = Math.max(dailyLimit - used, 0);
  return { ok: remaining > 0, remaining };
}

/** Incrementa el contador diario (tras usar un superlike). */
export async function incSuperlike(userId: string) {
  const day = todayUTC();
  const { data: row, error: selError } = await supabase
    .from('superlike_counters')
    .select('used')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();

  if (selError) {
    console.warn('incSuperlike select error', selError);
  }

  if (!row) {
    // primera vez hoy
    const { error: insError } = await supabase
      .from('superlike_counters')
      .insert({ user_id: userId, day, used: 1 });
    if (insError) console.warn('incSuperlike insert error', insError);
    return;
  }

  const { error: updError } = await supabase
    .from('superlike_counters')
    .update({ used: (row.used ?? 0) + 1 })
    .eq('user_id', userId)
    .eq('day', day);

  if (updError) console.warn('incSuperlike update error', updError);
}

/** Cuántos te quedan hoy con un límite dado. */
export async function remainingSuperlikes(userId: string, dailyLimit: number) {
  const used = await getUsedToday(userId);
  return Math.max(dailyLimit - used, 0);
}

/** ➖ Resta uno al contador (reembolso de un superlike). */
export async function decSuperlike(userId: string) {
  const day = todayUTC();
  const { data: row } = await supabase
    .from('superlike_counters')
    .select('used')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();

  if (!row) return; // nada que reembolsar

  const newUsed = Math.max((row.used ?? 0) - 1, 0);
  const { error } = await supabase
    .from('superlike_counters')
    .update({ used: newUsed })
    .eq('user_id', userId)
    .eq('day', day);

  if (error) console.warn('decSuperlike update error', error);
}
