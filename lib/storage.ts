import * as FileSystem from 'expo-file-system'

import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from './supabase'

export const DEFAULT_PUBLIC_BUCKET = (process.env.EXPO_PUBLIC_STORAGE_BUCKET as string | undefined) ?? 'user-photos'

type UploadUserPhotosArgs = {
  userId: string
  uris: string[]
  max?: number
  concurrency?: number
  resize?: { maxWidth: number; maxHeight: number; quality: number }
  onProgress?: (p: { current: number; total: number }) => void
  onRetry?: (info: { attempt: number; maxAttempts: number; uri: string }) => void
}

type UploadUserPhotosResult = {
  urls: string[]
  avatarUrl: string | null
}

export async function uploadUserPhotos(args: UploadUserPhotosArgs): Promise<UploadUserPhotosResult> {
  const { userId, uris, onProgress } = args
  const total = uris.length
  const out: string[] = []
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]
    try {
      const url = await uploadSinglePhoto({ userId, uri, resize: args.resize })
      out.push(url)
    } catch (e) {
      // Skip failed uploads but continue others
      console.warn('[uploadUserPhotos] failed uploading', uri, e)
    }
    onProgress?.({ current: i + 1, total })
    await Promise.resolve()
  }
  if (out.length === 0) {
    // Bubble an explicit error so UI can inform the user
    throw new Error('UPLOAD_FAILED:No se pudieron subir las fotos. Revisa el permiso de fotos/cámara y la configuración del bucket de Storage.')
  }
  return { urls: out, avatarUrl: out[0] || null }
}

export async function uploadSinglePhoto(args: { userId: string; uri: string; resize?: any }): Promise<string> {
  const { userId, uri } = args
  // Convert local file URI to ArrayBuffer (works better on RN/Hermes than Blob)
  const arrayBuffer = await uriToArrayBuffer(uri)
  const contentType = guessContentType(uri)
  const objectPath = makeObjectPath({ userId, uri })

  const { data, error } = await supabase
    .storage
    .from(DEFAULT_PUBLIC_BUCKET)
    .upload(objectPath, arrayBuffer, { contentType, upsert: true })

  if (error) throw error

  // Build public URL (assumes bucket is public)
  const url = getPublicUrl(data.path)
  return url
}

export async function processPendingUploads(_opts: { userId: string; retries?: number }){
  // no-op in stub
}

export async function loadJSON<T>(key: string, fallback?: T): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if(!raw) return (fallback ?? null) as any
    return JSON.parse(raw) as T
  } catch {
    return (fallback ?? null) as any
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

// Helpers
function guessContentType(uri: string): string {
  const lower = uri.split('?')[0].toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // Try direct fetch first (works for many file:/// URIs)
  try {
    const res = await fetch(uri)
    if (res.ok && (res as any).arrayBuffer) {
      return await (res as any).arrayBuffer()
    }
  } catch {}
  // Fallback: read as base64 via Expo FileSystem and convert using data URL, then to ArrayBuffer
  try {
    const contentType = guessContentType(uri)
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any })
    const dataUrl = `data:${contentType};base64,${base64}`
    const res2: any = await fetch(dataUrl)
    if (!res2 || !res2.ok || !res2.arrayBuffer) throw new Error('Failed to create ArrayBuffer from base64')
    return await res2.arrayBuffer()
  } catch (e) {
    throw new Error(`UPLOAD_FAILED:No se pudo leer el archivo local (${String(e)})`)
  }
}

function makeObjectPath({ userId, uri }: { userId: string; uri: string }): string {
  const ts = Date.now()
  // Try to infer extension
  const clean = uri.split('?')[0]
  const ext = (clean.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg').toLowerCase()
  return `users/${userId}/${ts}.${ext}`
}

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(DEFAULT_PUBLIC_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
