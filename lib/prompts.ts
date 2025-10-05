// Lista de prompts predefinidos para que el usuario responda durante la creación de perfil.
// Se pueden internacionalizar los títulos con i18n claves: complete.prompt.<key>.title / placeholder
export type ProfilePrompt = {
  key: string;
  type: 'text' | 'choice';
  choices?: string[]; // claves de choice (referenciadas en i18n)
  maxLen?: number; // sólo para text
  maxChoices?: number; // para multi-choice futuro
};

export const AVAILABLE_PROMPTS: ProfilePrompt[] = [
  {
    key: 'myPersonality',
    type: 'choice',
    choices: ['creative', 'adventurous', 'analytical', 'empathetic', 'funny', 'ambitious']
  },
  {
    key: 'myPerfectPlan',
    type: 'choice',
    choices: ['coffeeChat', 'museumVisit', 'hikingNature', 'cookingTogether', 'liveMusic', 'movieMarathon']
  },
  {
    key: 'twoTruthsOneLie',
    type: 'choice',
    choices: ['traveled10', 'playsInstrument', 'climbedVolcano', 'polyglot', 'ranMarathon', 'neverOnPlane']
  },
  {
    key: 'theMostSpontaneous',
    type: 'choice',
    choices: ['lastMinuteTrip', 'boughtConcert', 'changedCareer', 'movedCity', 'dancedRain', 'randomRoadtrip']
  },
];

export type PromptAnswer = { key: string; answers: string[] }; // answers almacena claves elegidas (choice) o array con un texto/libre

export function mergePromptAnswers(existing: PromptAnswer[], incoming: PromptAnswer[]): PromptAnswer[] {
  const map = new Map(existing.map(p => [p.key, p.answers] as const));
  for (const inc of incoming) {
    map.set(inc.key, inc.answers.filter(a => a.trim().length > 0));
  }
  return Array.from(map.entries()).map(([key, answers]) => ({ key, answers: answers.filter(a => a.trim().length>0) }))
    .filter(a => a.answers.length > 0);
}
