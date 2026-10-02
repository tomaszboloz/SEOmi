import { describe, expect, it } from 'vitest';
import { assessDraftQuality } from '@/services/briefDocument/quality';
import i18n from '@/i18n';

describe('brief advisory editorial quality contracts', () => {
  it('excludes front matter, code and table rows from prose counts', () => {
    const draft = '---\ntitle: Hidden Words\n---\n## Guide\n\nCoffee beans\n\n```\nignored code words\n```\n\n| ignored | table |';
    const result = assessDraftQuality(draft, 2);
    expect(result.wordCount).toBe(3);
    expect(result.medianWordsPerSection).toBe(2);
    expect(result.sectionCount).toBe(1);
    expect(result.components.length).toBe(15);
  });

  it('handles odd/even section medians and prose without sections', () => {
    const odd = assessDraftQuality('## A\none\n## B\none two three\n## C\none two');
    const even = assessDraftQuality('## A\none\n## B\none two three four');
    expect(odd.medianWordsPerSection).toBe(2);
    expect(even.medianWordsPerSection).toBe(3);
    expect(assessDraftQuality('one two').medianWordsPerSection).toBe(2);
    const empty = assessDraftQuality('');
    expect(empty).toMatchObject({ wordCount: 0, medianWordsPerSection: 0, grade: 'thin' });
    expect(empty.components).toEqual({ depth: 0, examples: 0, specificity: 0, antiFiller: 20, length: 0 });
  });

  it('bounds reference length and counts examples, concrete details, links and filler occurrences', () => {
    const draft = '## Espresso\nFor example Google HTTP 200, 20% and [source](https://site.test). It is important. It is important.';
    const result = assessDraftQuality(draft, 1);
    expect(result.components).toMatchObject({ specificity: 20, examples: 20, antiFiller: 0, length: 15 });
    expect(result.fillerMatches).toEqual(['it is important']);
    expect(result.recommendations).toContain(i18n.t('runtimeErrors.contentBrief.filler', { matches: 'it is important' }));
    for (const floor of [NaN, Infinity]) expect(assessDraftQuality(draft, floor)).toEqual(assessDraftQuality(draft, 800));
    expect(assessDraftQuality(draft, 0)).toEqual(assessDraftQuality(draft, 1));
    expect(assessDraftQuality(draft, 10001)).toEqual(assessDraftQuality(draft, 10000));
    expect(assessDraftQuality(draft, 2.9)).toEqual(assessDraftQuality(draft, 2));
  });

  it('assigns every score band without using score as a publication gate', () => {
    const examples = '## Section\nFor example Google HTTP 200 ' + 'coffee '.repeat(100);
    const excellent = assessDraftQuality(examples, 50);
    expect(excellent).toMatchObject({ grade: 'excellent', score: 100, recommendations: [] });
    const good = assessDraftQuality('## Section\nGoogle HTTP 200 ' + 'coffee '.repeat(100), 50);
    expect(good).toMatchObject({ grade: 'good', score: 80 });
    const needsWork = assessDraftQuality('## Section\nGoogle HTTP 200 ' + 'coffee '.repeat(20), 50);
    expect(needsWork.grade).toBe('needs-work');
    expect(needsWork.score).toBeGreaterThanOrEqual(50);
    expect(needsWork.score).toBeLessThan(70);
    expect(assessDraftQuality('short').grade).toBe('thin');
  });
});
