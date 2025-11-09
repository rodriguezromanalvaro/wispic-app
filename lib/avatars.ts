import { supabase } from './supabase'
import { DEFAULT_PUBLIC_BUCKET } from './storage'
import { debugLog, debugError } from './debug'

/**
 * Devuelve una URL lista para usar en <Image />. Si recibe un path relativo del bucket,
 * lo convierte a URL pública. Si ya viene con http/https, lo devuelve igual.
 */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  const u = (url || '').trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  try {
    const { data } = supabase.storage.from(DEFAULT_PUBLIC_BUCKET).getPublicUrl(u)
    return data?.publicUrl || null
  } catch {
    return null
  }
}

/**
 * Obtiene el mejor avatar disponible para un usuario, normalizando la URL:
 * 1) profiles.avatar_url
 * 2) primera foto en user_photos por sort_order
 */
export async function getBestAvatarUrl(userId: string): Promise<string | null> {
  try {
    debugLog('avatar.best.start', { userId })
    const { data: prof } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle()
    const rawPrimary = (prof as any)?.avatar_url || null
    const primary = normalizeAvatarUrl(rawPrimary)
    debugLog('avatar.best.profile', { userId, rawPrimary, normalized: primary })
    if (primary) return primary
    const { data: photos } = await supabase
      .from('user_photos')
      .select('url,sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .limit(1)
    const fallback = (photos?.[0]?.url as string | null) || null
    const normalizedFallback = normalizeAvatarUrl(fallback)
    debugLog('avatar.best.user_photos', { userId, found: !!fallback, raw: fallback, normalized: normalizedFallback })
    if (normalizedFallback) return normalizedFallback

    // STORAGE LIST FALLBACK: scan storage folder if DB rows are missing
    try {
      const folder = `users/${userId}`
      const list = await supabase.storage.from(DEFAULT_PUBLIC_BUCKET).list(folder, { limit: 10, sortBy: { column: 'created_at', order: 'asc' } as any })
      if ((list as any)?.error) {
        debugError('avatar.best.storage.listError', (list as any).error)
      } else if (Array.isArray((list as any).data) && (list as any).data.length) {
        const first = (list as any).data[0]
        const path = `${folder}/${first.name}`
        const { data: pub } = supabase.storage.from(DEFAULT_PUBLIC_BUCKET).getPublicUrl(path)
        const fromStorage = pub?.publicUrl || null
        debugLog('avatar.best.storage.fallback', { userId, path, url: fromStorage })
        if (fromStorage) return fromStorage
      } else {
        debugLog('avatar.best.storage.empty', { userId, folder })
      }
    } catch (e:any) {
      debugError('avatar.best.storage.exception', e)
    }

    return null
  } catch (e:any) {
    debugError('avatar.best.exception', e)
    return null
  }
}
