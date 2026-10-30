import { describe, expect, it } from 'vitest';
import { findCoCitations } from '@/services/offPage/cocitation';
import { mentionStance } from '@/services/offPage/mentionStance';

describe('brand mention stance (#93 GEM-93-07, T03)', () => {
  it.each([
    ['Acme is a solid SEO tool.', 'neutral'],
    ['Acme is not a good SEO tool.', 'negated'],
    ["Acme doesn't support audits.", 'negated'],
    ['Nie polecam Acme do SEO.', 'negated'],
    ['Acme не поддерживает аудит.', 'negated'],
    ['Acme to oszustwo, unikajcie.', 'critical'],
    ['Avoid Acme for SEO.', 'critical'],
    ['Acme 是骗局。', 'critical'],
    ['According to Jan, Acme is the best tool.', 'quoted'],
    ['Zdaniem autora Acme pomaga.', 'quoted'],
    ['Users call it "Acme the great" in forums.', 'quoted'],
  ])('%s -> %s', (text, stance) => expect(mentionStance(text, ['Acme'])).toBe(stance));

  it('looks only at sentences that mention the brand and keeps the strongest cue', () => {
    expect(mentionStance('Other tools are not great. Acme does SEO audits.', ['Acme'])).toBe('neutral');
    expect(mentionStance('Acme does audits. Some say Acme is a scam.', ['Acme'])).toBe('critical');
    expect(mentionStance('Acmegroup is not great.', ['Acme'])).toBe('neutral');
    expect(mentionStance('Acme is not great.', [' '])).toBe('neutral');
  });

  it('marks critical and quoted co-citations as unclear, never as support', () => {
    const p = (text: string) => ({ sourceUrl: 'https://s.test', offset: 0, text, linked: false });
    const report = findCoCitations([p('Acme is a scam for SEO.'), p('"Acme" is great for SEO, says Jan.'), p('Acme SEO audits.')], ['Acme'], 'SEO');
    expect(report.unlinked.map((hit) => [hit.polarity, hit.stance])).toEqual([['unclear', 'critical'], ['unclear', 'quoted'], ['neutral', 'neutral']]);
  });
});
