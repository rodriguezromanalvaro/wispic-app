import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Hybrid storage: prefer SecureStore for small secrets; fallback to AsyncStorage for large payloads (>2KB)
const MAX_SECURESTORE_BYTES = 2000;

const HybridStorage = {
  getItem: async (key: string) => {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v != null) return v;
    } catch {}
    try {
      return await AsyncStorage.getItem(key);
    } catch {}
    return null;
  },
  setItem: async (key: string, value: string) => {
    try {
      if (value && value.length > MAX_SECURESTORE_BYTES) {
        // Store large values in AsyncStorage to avoid SecureStore size limits
        await AsyncStorage.setItem(key, value);
        // Best-effort: ensure SecureStore doesn't hold stale
        try { await SecureStore.deleteItemAsync(key); } catch {}
        return;
      }
      await SecureStore.setItemAsync(key, value);
      // Keep AsyncStorage in sync off-path to avoid divergent states
      try { await AsyncStorage.setItem(key, value); } catch {}
    } catch {
      // If SecureStore fails, fall back to AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    try { await SecureStore.deleteItemAsync(key); } catch {}
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: HybridStorage as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
