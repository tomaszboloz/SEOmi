import { describe, expect, it } from 'vitest';
import { aioRulesChecklistMarkdown, flatten, reviewChecklistMarkdown, reviewItems } from '@/services/localeReview/checklist';

const en = { a: { title: 'Weakest passages here', count: '{{n}} items found in total', brand: 'SEOmi' }, b: 'Close dialog now' };
const de = { a: { title: 'Weakest passages here', count: '{{count}} Einträge gefunden', brand: 'SEOmi' } };

describe('locale review checklist (#109)', () => {
  it('flattens nested keys', () => {
    expect(flatten(null)).toEqual({});
    expect(flatten(en)).toEqual({ 'a.title': 'Weakest passages here', 'a.count': '{{n}} items found in total', 'a.brand': 'SEOmi', b: 'Close dialog now' });
  });

  it('adds heuristic hints without judging quality', () => {
    const items = reviewItems(en, de);
    expect(Object.fromEntries(items.map((item) => [item.key, item.flags]))).toEqual({
      'a.title': ['same-as-en'], 'a.count': ['placeholders'], 'a.brand': [], b: ['missing'],
    });
    expect(reviewItems(en, de, 'a.').map((item) => item.key)).toEqual(['a.title', 'a.count', 'a.brand']);
    expect(reviewItems({ x: 'A long English sentence here' }, { x: 'Kurz' })[0].flags).toEqual(['length']);
  });

  it('leaves reviewer, date and every checkbox empty', () => {
    const markdown = reviewChecklistMarkdown(reviewItems(en, de), { locale: 'de', generatedAt: '2026-10-30T00:00:00Z', flaggedOnly: true });
    expect(markdown).toContain('Reviewer: ____________________');
    expect(markdown).not.toContain('[x]');
    expect(markdown.match(/\| \[ \] \|/g)).toHaveLength(3);
    expect(markdown).toContain('Automatic hints: 3.');
    expect(reviewChecklistMarkdown([{ key: 'k', en: 'a|b', text: undefined, flags: ['missing'] }], { locale: 'de', generatedAt: 'x' })).toContain('a\\|b | — | missing');
  });

  it('lists AIO-R word lists for review only for uncertain languages (#108)', () => {
    const de = aioRulesChecklistMarkdown('de', 'x');
    expect(de).toContain('status: uncertain');
    expect(de).toContain('- [ ] dieser');
    expect(de).not.toContain('[x]');
    expect(aioRulesChecklistMarkdown('pl', 'x')).toContain('baseline language');
    expect(aioRulesChecklistMarkdown('fi', 'x')).toContain('No rules exist for fi');
  });
});
