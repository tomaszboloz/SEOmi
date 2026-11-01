// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sentenceLengths } from '@/services/briefDocument/markdown';
import { sentencesOf } from '@/services/llmEconomy/ymylValues';
import { mentionStance } from '@/services/offPage/mentionStance';
import { analyzeAiEvidence } from '@/services/aiResearchEvidence';

/** #106: pins the observable sentence handling of every consumer before they share one splitter. */
describe('sentence splitting characterization (#106)', () => {
  it('brief sentence lengths: split after . ! ? plus space, decimals stay whole', () => {
    expect(sentenceLengths('One two three. Four five! Six? Dose is 2.5 mg today.')).toEqual([3, 2, 1, 6]);
    expect(sentenceLengths('   ')).toEqual([]);
    expect(sentenceLengths('No end punctuation here')).toEqual([4]);
  });
  it('ymyl values: trimmed sentences, ellipsis and CJK marks split', () => {
    expect(sentencesOf('Take 500 mg.  Then rest… Done! 2.5 mg ok')).toEqual(['Take 500 mg.', 'Then rest…', 'Done!', '2.5 mg ok']);
    expect(sentencesOf('今日は雨です。明日は晴れ！ ok')).toEqual(['今日は雨です。', '明日は晴れ！', 'ok']);
    expect(sentencesOf('  ')).toEqual([]);
  });
  it('mention stance judges each sentence, worst stance wins', () => {
    expect(mentionStance('Acme ships fast. Acme is not reliable at all.', ['Acme'])).toBe('negated');
    expect(mentionStance('We love Acme. Other text here.', ['Acme'])).toBe('neutral');
    expect(mentionStance('Nothing relevant. Elsewhere.', ['Acme'])).toBe('neutral');
  });
  it('AI evidence drops refusal sentences and newline-separated prompt echoes, keeps order', () => {
    const evidence = analyzeAiEvidence('Best tools?\nI cannot browse. Beta is good. Acme is better.', 'Acme', '', ['Beta'], 'Best tools?');
    expect(evidence.competitorsMentioned).toEqual(['Beta']);
    expect(evidence.brandMentions).toEqual(['Beta', 'Acme']);
    expect(evidence.mentionPosition).toBe(2);
    expect(analyzeAiEvidence('I cannot determine that. Acme rocks.', 'Acme', '', []).mentionPosition).toBe(1);
    expect(analyzeAiEvidence('I cannot say anything about Acme.', 'Acme', '', []).brandMentioned).toBe(false);
  });
});
