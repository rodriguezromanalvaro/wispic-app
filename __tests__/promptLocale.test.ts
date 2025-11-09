import { getLocaleChain, parseLabels, pickFirstNonEmptyTitle, mergeChoiceLabels } from '../lib/promptLocale';

describe('promptLocale utilities', () => {
  test('getLocaleChain normalizes and orders preferences', () => {
    expect(getLocaleChain('es-ES')).toEqual(['es', 'en']);
    expect(getLocaleChain('en-GB')).toEqual(['en', 'es']);
    expect(getLocaleChain(undefined)).toEqual(['en', 'es']);
  });

  test('parseLabels handles objects and JSON strings', () => {
    expect(parseLabels({ a: 'A' })).toEqual({ a: 'A' });
    expect(parseLabels('{"a":"A"}')).toEqual({ a: 'A' });
    expect(parseLabels('invalid')).toBeNull();
    expect(parseLabels(null as any)).toBeNull();
  });

  test('pickFirstNonEmptyTitle respects chain order', () => {
    const locs = {
      en: { title: 'Hello' },
      es: { title: 'Hola' },
    } as Record<string, any>;
    expect(pickFirstNonEmptyTitle(locs, ['en', 'es'])).toBe('Hello');
    expect(pickFirstNonEmptyTitle(locs, ['es', 'en'])).toBe('Hola');
    expect(pickFirstNonEmptyTitle({}, ['es', 'en'])).toBeUndefined();
  });

  test('mergeChoiceLabels merges with preference precedence', () => {
    const locs = {
      en: { choices_labels: { a: 'A', b: 'Bee' } },
      es: { choices_labels: { a: 'Á', c: 'Ce' } },
    } as Record<string, any>;
    // Chain [es, en] => en is lower priority, es overrides
    expect(mergeChoiceLabels(locs, ['es', 'en'])).toEqual({ a: 'Á', b: 'Bee', c: 'Ce' });
    // Chain [en, es] => es is lower priority, en overrides
    expect(mergeChoiceLabels(locs, ['en', 'es'])).toEqual({ a: 'A', b: 'Bee', c: 'Ce' });
  });
});
