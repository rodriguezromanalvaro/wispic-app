// lib/userPrefs.ts
import { saveJSON, loadJSON } from './storage';
import { FilterState } from './types';

// Puedes añadir el userId a la clave si quisieras aislar por usuario en el futuro.
const KEY = 'filters:user:default';

export async function saveUserDefaultFilters(state: FilterState) {
  await saveJSON(KEY, state);
}

export async function loadUserDefaultFilters(): Promise<FilterState | null> {
  return await loadJSON<FilterState>(KEY);
}
