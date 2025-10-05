import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
// Evitamos dependencia de crypto.getRandomValues en entornos donde falla (Android hermes sin polyfill)
function generateId() {
  try {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
    }
  } catch {}
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10)
  ).slice(0,32);
}
// Compresión/resize: dependerá de expo-image-manipulator (si no está, hacemos fallback)
let ImageManipulator: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ImageManipulator = require('expo-image-manipulator');
} catch {}
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';

// Bucket por defecto centralizado. Puede configurarse vía variable de entorno EXPO_PUBLIC_STORAGE_BUCKET
// para alinearlo con el bucket existente (por ejemplo 'user-photos').
export const DEFAULT_PUBLIC_BUCKET = process.env.EXPO_PUBLIC_STORAGE_BUCKET || 'user-photos';
const DEBUG_UPLOADS = (process.env.EXPO_PUBLIC_DEBUG_UPLOADS || '').toLowerCase() === 'true';

// Persistencia simple clave/valor en AsyncStorage
export async function saveJSON<T>(key: string, value: T) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export async function loadJSON<T>(key: string): Promise<T | null> {
  try { const s = await AsyncStorage.getItem(key); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

// ------------------ Helpers de subida de fotos ------------------
export type UploadPhotoOptions = {
  userId: string;
  uris: string[];
  bucket?: string;
  pathPrefix?: string;
  max?: number;
  retries?: number;
  backoffMs?: number;
  onProgress?: (info: { current: number; total: number; uri?: string }) => void;
  onRetry?: (info: { attempt: number; maxAttempts: number; uri: string; error: any }) => void;
  concurrency?: number; // subidas paralelas (default 1 secuencial)
  resize?: { maxWidth: number; maxHeight: number; quality: number }; // compresión/resize
  offlineQueue?: boolean; // en caso de fallo de red, guardar pendiente
};

export type UploadPhotoResult = { avatarUrl: string | null; urls: string[] };
// Cola offline (persistida en AsyncStorage)
const PENDING_UPLOADS_KEY = 'pending_uploads_v1';
type PendingUpload = { id: string; userId: string; uris: string[]; createdAt: string };

async function loadPendingUploads(): Promise<PendingUpload[]> {
  const raw = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
async function savePendingUploads(list: PendingUpload[]) {
  try { await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(list)); } catch {}
}
export async function enqueuePendingUpload(userId: string, uris: string[]) {
  if (!uris.length) return;
  const list = await loadPendingUploads();
  list.push({ id: generateId(), userId, uris, createdAt: new Date().toISOString() });
  await savePendingUploads(list);
  if (DEBUG_UPLOADS) console.log('[storage-offline] queued', { count: uris.length });
}
export async function processPendingUploads(options: Omit<UploadPhotoOptions, 'uris'> & { onItemDone?: (u: string) => void }) {
  const { userId } = options;
  let list = await loadPendingUploads();
  const mine = list.filter(p => p.userId === userId);
  if (!mine.length) return { processed: 0 };
  let processed = 0;
  for (const item of mine) {
    try {
      await uploadUserPhotos({ ...options, uris: item.uris, offlineQueue: false });
      processed += item.uris.length;
      options.onItemDone?.(item.id);
      // Remove from queue
      list = list.filter(p => p.id !== item.id);
      await savePendingUploads(list);
    } catch (e) {
      if (DEBUG_UPLOADS) console.log('[storage-offline] failed reprocess', e);
      // keep in queue
    }
  }
  return { processed };
}

export function guessContentType(pathOrExt: string): string {
  const ext = (pathOrExt.split('.').pop() || '').toLowerCase().split('?')[0];
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic':
    case 'heif': return 'image/heic';
    default: return 'image/jpeg';
  }
}

export async function readFileAsArrayBuffer(uri: string): Promise<{ buffer: ArrayBuffer; mime: string; filename: string }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('File not found: ' + uri);
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
  const filename = `upload.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const buffer = decodeBase64(base64);
  const mime = guessContentType(ext);
  return { buffer, mime, filename };
}

async function compressAndRead(uri: string, resize?: { maxWidth: number; maxHeight: number; quality: number }) {
  if (!resize || !ImageManipulator) {
    return readFileAsArrayBuffer(uri);
  }
  try {
    const actions = [{ resize: { width: resize.maxWidth, height: resize.maxHeight } }];
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: resize.quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const base64 = result.base64 || '';
    const buffer = decodeBase64(base64);
    return { buffer, mime: 'image/jpeg', filename: 'upload.jpg' };
  } catch (e) {
    if (DEBUG_UPLOADS) console.log('[storage] compress fallback', e);
    return readFileAsArrayBuffer(uri);
  }
}

async function retry<T>(fn: () => Promise<T>, opts: { retries: number; backoffMs: number; onRetry?: (a: number, e: any) => void; uri?: string }): Promise<T> {
  const { retries, backoffMs, onRetry } = opts; let attempt = 0;
  while (true) {
    try { return await fn(); } catch (e) {
      if (attempt >= retries) throw e; onRetry?.(attempt + 1, e); const delay = backoffMs * Math.pow(2, attempt); await new Promise(r => setTimeout(r, delay)); attempt += 1; }
  }
}

function isBucketNotFoundMessage(msg: string) {
  const m = msg.toLowerCase();
  // Casos verdaderos típicos devueltos por el servicio de storage
  if (m.includes('bucket not found')) return true;
  if (m.match(/bucket .* does not exist/)) return true;
  // Evitamos clasificar genéricamente un 'resource was not found' (puede ser path)
  return false;
}

export async function uploadUserPhotos(options: UploadPhotoOptions): Promise<UploadPhotoResult> {
  const { userId, uris, bucket = DEFAULT_PUBLIC_BUCKET, pathPrefix = `users/${userId}`, max = 6, retries = 2, backoffMs = 500, onProgress, onRetry, concurrency = 1, resize, offlineQueue = true } = options;
  const finalUris = uris.slice(0, max); const urls: string[] = []; onProgress?.({ current: 0, total: finalUris.length });
  // Pre-flight: comprobar que el bucket existe intentando listar. La API no lanza throw, retorna error en el objeto.
  const { error: listError } = await supabase.storage.from(bucket).list('', { limit: 1 });
  if (listError) {
    if (isBucketNotFoundMessage(listError.message)) {
      throw new Error(`BUCKET_NOT_FOUND:${bucket}:${listError.message}`);
    }
    if (DEBUG_UPLOADS) console.log('[storage] list pre-flight error (no bucket)', { bucket, message: listError.message, name: listError.name });
  } else {
    if (DEBUG_UPLOADS) console.log('[storage] pre-flight ok', { bucket, supabaseUrl: (process as any).env?.EXPO_PUBLIC_SUPABASE_URL });
  }
  // Concurrencia: preparamos tasks
  const results: (string | null)[] = new Array(finalUris.length).fill(null);
  let completed = 0;
  const queue = finalUris.map((uri, index) => ({ uri, index }));

  const worker = async () => {
    while (queue.length) {
      const { uri, index } = queue.shift()!;
      const doUpload = async () => {
        const { buffer, mime } = await compressAndRead(uri, resize);
        const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
  const filePath = `${pathPrefix}/${generateId()}_${index}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, { upsert: true, contentType: mime });
        if (error) {
          if (DEBUG_UPLOADS) console.log('[storage] upload error', { filePath, message: error.message, name: error.name });
          if (isBucketNotFoundMessage(error.message)) {
            throw new Error(`BUCKET_NOT_FOUND:${bucket}:${error.message}`);
          }
          throw new Error(`UPLOAD_FAILED:${error.message}`);
        }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
        results[index] = pub.publicUrl;
      };
      try {
        await retry(doUpload, { retries, backoffMs, onRetry: (attempt, error) => { onRetry?.({ attempt, maxAttempts: retries + 1, uri, error }); }, uri });
      } catch (e: any) {
        // Si es error de red y offlineQueue habilitado, re-enqueue restantes (incluyendo la fallida si no parcial)
        const msg = e?.message || '';
        if (offlineQueue && /network|fetch|request failed/i.test(msg)) {
          if (DEBUG_UPLOADS) console.log('[storage-offline] network issue, queue remaining');
          const remaining = [uri, ...queue.map(q => q.uri)];
          await enqueuePendingUpload(userId, remaining);
          // Vaciar queue para abortar
          queue.length = 0;
          break;
        }
        throw e;
      }
      completed += 1;
      onProgress?.({ current: completed, total: finalUris.length, uri });
    }
  };

  const workers = Array(Math.max(1, Math.min(concurrency, finalUris.length))).fill(0).map(() => worker());
  await Promise.all(workers);
  const filtered = results.filter((r): r is string => !!r);
  urls.push(...filtered);
  return { avatarUrl: urls[0] || null, urls };
}

// Upload a single photo (reuses internal helpers) returning its public URL
export async function uploadSinglePhoto(options: { userId: string; uri: string; bucket?: string; pathPrefix?: string; resize?: { maxWidth: number; maxHeight: number; quality: number } }): Promise<string> {
  const { userId, uri, bucket = DEFAULT_PUBLIC_BUCKET, pathPrefix = `users/${userId}`, resize } = options;
  // Pre-flight bucket existence
  const { error: listError } = await supabase.storage.from(bucket).list('', { limit: 1 });
  if (listError && isBucketNotFoundMessage(listError.message)) {
    throw new Error(`BUCKET_NOT_FOUND:${bucket}:${listError.message}`);
  }
  const { buffer, mime } = await compressAndRead(uri, resize);
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
  const filePath = `${pathPrefix}/${generateId()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, buffer, { upsert: true, contentType: mime, cacheControl: '3600' });
  if (upErr) {
    if (isBucketNotFoundMessage(upErr.message)) throw new Error(`BUCKET_NOT_FOUND:${bucket}:${upErr.message}`);
    throw new Error(`UPLOAD_FAILED:${upErr.message}`);
  }
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return pub.publicUrl;
}
