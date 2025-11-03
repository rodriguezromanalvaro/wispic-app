import { Profile } from 'lib/types';

export type CompletionResult = {
  score: number;
  missing: string[];
  promptsCount: number;
  photosCount: number;
};

// Simple heuristic; can be expanded
export function computeCompletion(p: Partial<Profile> & { interested_in?: string[]; seeking?: string[]; prompts?: any[]; photos_count?: number; }): CompletionResult {
  const missing: string[] = [];
  const required: Array<keyof Profile> = ['display_name','bio','birthdate','gender'];
  required.forEach(k => {
    // @ts-ignore
    if (!p[k]) missing.push(String(k));
  });
  const promptsCount = (p.prompts?.length) || 0;
  const photosCount = p.photos_count || 0;
  if (promptsCount < 3) missing.push('prompts');
  if (photosCount < 1) missing.push('photos');

  const baseParts = 6; // 4 fields + prompts + photos
  let score = Math.round(((baseParts - missing.length) / baseParts) * 100);
  if (score < 0) score = 0; if (score > 100) score = 100;
  return { score, missing: Array.from(new Set(missing)), promptsCount, photosCount };
}
