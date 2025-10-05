// Mapping of prompt template IDs to localized strings.
// TODO: Rellena los textos en español (es) si difieren del inglés.
// Puedes añadir más IDs según existan en la tabla profile_prompt_templates.

export interface PromptTranslationMapEntry {
  en: string;
  es: string;
}

export const promptTranslations: Record<number, PromptTranslationMapEntry> = {
  // 1: { en: 'My perfect weekend', es: 'Mi fin de semana perfecto' },
  // 2: { en: 'A fun fact about me', es: 'Un dato curioso sobre mí' },
};

// Enhanced translator: if a runtime localizedTemplates map is passed (id -> localized title)
// it will prefer that, otherwise fallback to static dictionary + provided fallback.
export function translatePrompt(id: number, fallback: string, locale: string, localizedTemplates?: Record<number,string>) {
  if (localizedTemplates && localizedTemplates[id]) return localizedTemplates[id];
  const entry = promptTranslations[id];
  if (!entry) return fallback; // no mapping yet
  if (locale.startsWith('es')) return entry.es || fallback;
  return entry.en || fallback;
}
