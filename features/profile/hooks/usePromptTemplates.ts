import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { supabase } from 'lib/supabase';

export interface PromptTemplate {
  id: number;
  key?: string; // stable identifier from profile_prompt_templates.key
  // Localized question exposed for current language; baseQuestion retains original DB value
  question: string;              // localized (primary consumer field)
  baseQuestion?: string | null;  // original question (e.g. seed language)
  localizedQuestion?: string;    // explicit localized version after fallback resolution
  active?: boolean;
  type?: string | null;
  choices?: string[] | null; // predefined choice keys
  max_choices?: number | null;
  max_len?: number | null;
  display_order?: number | null;
  choicesLabels?: Record<string,string> | null; // merged localized labels
  rawChoicesLabels?: { // raw per-locale labels before merge (debug / future tooling)
    [locale: string]: Record<string,string> | undefined;
  } | null;
  icon?: string | null;
  categories?: { key: string; icon?: string | null; color?: string | null }[];
}

export function usePromptTemplates() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  return useQuery<PromptTemplate[]>({
    queryKey: ['profile:prompt-templates', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_prompt_templates')
        // Normalized categories: join mapping -> category
        .select('id, key, question, active, type, choices, max_choices, max_len, display_order, icon, prompt_template_categories(prompt_categories(key,icon,color,display_order))')
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      const base = data || [];
      const ids = base.map(b => b.id);
      // i18n improvement: dynamic fallback chain (currentLang -> es -> en)
      const fallbackLocales = Array.from(new Set([lang, 'es', 'en']));
      let locales: any[] = [];
      if (ids.length) {
        try {
          const { data: locRows } = await supabase
            .from('profile_prompt_template_locales')
            .select('template_id, locale, title, placeholder, choices_labels')
            .in('template_id', ids)
            .in('locale', fallbackLocales);
          locales = locRows || [];
        } catch {}
      }
      // Group locales by template id
      const locByTemplate: Record<number, Record<string, any>> = {};
      locales.forEach(l => {
        if (!locByTemplate[l.template_id]) locByTemplate[l.template_id] = {};
        locByTemplate[l.template_id][l.locale] = l;
      });
      function parseLabels(val: any): Record<string,string> | null {
        if (!val) return null;
        if (typeof val === 'object') return val as any;
        try { return JSON.parse(val); } catch { return null; }
      }
      return base.map(r => {
        const locMap = locByTemplate[r.id] || {};
        // Determine localized title via fallback chain
        let localizedTitle: string | undefined;
        for (const fl of fallbackLocales) {
          const row = locMap[fl];
            if (row?.title && row.title.trim()) { localizedTitle = row.title.trim(); break; }
        }
        // If none found, use original question
        localizedTitle = localizedTitle || r.question || '';

        // Placeholder fallback chain (allow empty string fallback to next)
        let localizedPlaceholder: string | undefined;
        for (const fl of fallbackLocales) {
          const row = locMap[fl];
          if (row?.placeholder && row.placeholder.trim()) { localizedPlaceholder = row.placeholder.trim(); break; }
        }
        // If none, leave undefined so UI can decide a generic placeholder or none

        // Merge choices_labels respecting fallback priority: earliest in chain lowest precedence, later override
        const labelsByLocale: Record<string, Record<string,string> | undefined> = {};
        fallbackLocales.forEach(lo => {
          const parsed = parseLabels(locMap[lo]?.choices_labels);
          if (parsed) labelsByLocale[lo] = parsed;
        });
        // Merge labels so that the MOST PREFERRED locale wins for each key.
        // fallbackLocales is ordered [preferredLang, 'es', 'en'] (unique). We want
        // to start from the most generic (end) and let earlier (preferred) override.
        const mergedLabels: Record<string,string> = {};
        const precedence = [...fallbackLocales].reverse(); // e.g. ['en','es','fr'] if lang=fr
        for (const lo of precedence) {
          const lbl = labelsByLocale[lo];
          if (lbl) Object.assign(mergedLabels, lbl); // later in original list overrides earlier
        }
        const type = r.type || (Array.isArray(r.choices) && r.choices.length ? 'choice' : 'text');
        const categories = Array.isArray((r as any).prompt_template_categories)
          ? (r as any).prompt_template_categories
              .map((pc: any) => pc.prompt_categories)
              .filter((c: any) => c && c.key)
              .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map((c: any) => ({ key: c.key, icon: c.icon, color: c.color }))
          : [];
        return {
          id: r.id,
          key: (r as any).key || undefined,
          question: localizedTitle,
          placeholder: localizedPlaceholder,
          baseQuestion: r.question,
          localizedQuestion: localizedTitle,
          active: r.active,
          type,
          choices: r.choices,
          max_choices: r.max_choices ?? 1,
          max_len: (r as any).max_len ?? null,
          display_order: (r as any).display_order ?? null,
          choicesLabels: Object.keys(mergedLabels).length ? mergedLabels : null,
          rawChoicesLabels: Object.keys(labelsByLocale).length ? labelsByLocale : null,
          icon: r.icon || (categories[0]?.icon || null),
          categories
        } as PromptTemplate;
      });
    }
  });
}
