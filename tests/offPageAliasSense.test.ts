import { describe, expect, it } from 'vitest';
import { hasWord, mentionsInSense } from '@/services/offPage/aliasSense';
import { findCoCitations } from '@/services/offPage/cocitation';
import { mentionStance } from '@/services/offPage/mentionStance';

const senses = [{ alias: 'Orange', excludeContext: ['juice', 'fruit'], requireContext: ['telecom', 'mobile'] }];
const para = (text: string) => [{ sourceUrl: 'https://a.test', offset: 0, linked: true, text }];

describe('alias sense', () => {
  it('matches whole words only and ignores empty words', () => {
    expect(hasWord('Apple pie', 'apple')).toBe(true);
    expect(hasWord('Pineapple', 'apple')).toBe(false);
    expect(hasWord('x', '  ')).toBe(false);
  });
  it('keeps plain matching without a rule', () => {
    expect(mentionsInSense('Acme is fine.', 'Acme', senses)).toBe(true);
    expect(mentionsInSense('Nothing here.', 'Acme', senses)).toBe(false);
  });
  it('rejects the fruit sense and requires brand context', () => {
    expect(mentionsInSense('Orange juice is tasty.', 'orange', senses, 'Orange telecom')).toBe(false);
    expect(mentionsInSense('Orange is great.', 'Orange', senses, 'Orange is great.')).toBe(false);
    expect(mentionsInSense('Orange is great.', 'Orange', senses, 'Orange is great. Best mobile network.')).toBe(true);
  });
  it('rules without context lists accept the alias', () => {
    expect(mentionsInSense('Orange rocks.', 'Orange', [{ alias: 'Orange', requireContext: [' '] }])).toBe(true);
  });
  it('mention stance ignores homonym sentences', () => {
    const text = 'Orange juice is not sweet. Orange mobile is solid.';
    expect(mentionStance(text, ['Orange'])).toBe('negated');
    expect(mentionStance(text, ['Orange'], [{ alias: 'Orange', excludeContext: ['juice'] }])).toBe('neutral');
  });
  it('co-citation skips homonym paragraphs', () => {
    const text = 'Orange juice and SEO tools.';
    expect(findCoCitations(para(text), ['Orange'], 'SEO').linked).toHaveLength(1);
    expect(findCoCitations(para(text), ['Orange'], 'SEO', senses).linked).toHaveLength(0);
  });
});
