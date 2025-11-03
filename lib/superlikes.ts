import { supabase } from './supabase'

// Server-authoritative remaining superlikes (per UTC day)
// Falls back to `initial` if RPC is unavailable or errors
export async function remainingSuperlikes(userId: string, initial: number = 0): Promise<number> {
	try {
		const { data, error } = await supabase.rpc('superlikes_remaining_today', { p_user: userId })
		if (error) return initial
		const n = typeof data === 'number' ? data : Number(data)
		if (Number.isFinite(n)) return n
		return initial
	} catch {
		return initial
	}
}

// No-op: quota is enforced in DB; callers should refetch remaining via RPC
export function incSuperlike(_userId: string) {
	return
}
