import { describe, expect, it } from 'vitest';
import { analyzeAiEvidence, extractAiCitations, isUnbrandedPrompt, normalizeAiResearchSettings, redactLocalContext } from '@/services/aiResearchEvidence';

describe('neutral AI research evidence', () => {
  it('rejects branded questions, including domains and names with diacritics', () => {
    expect(isUnbrandedPrompt('What is SEOmi?', 'SEOmi', 'seomi.test')).toBe(false);
    expect(isUnbrandedPrompt('Who runs https://www.seomi.test?', 'SEOmi', 'seomi.test')).toBe(false);
    expect(isUnbrandedPrompt('Who provides SEO audits?', 'SEOmi', 'seomi.test')).toBe(true);
    expect(isUnbrandedPrompt('Co robi Rafał Szymański?', 'Rafał Szymański', '')).toBe(false);
  });

  it('ignores refusals, prompt echoes, name collisions and partial names', () => {
    expect(analyzeAiEvidence("I cannot identify SEOmi.", 'SEOmi', '', []).brandMentioned).toBe(false);
    expect(analyzeAiEvidence('What is SEOmi?', 'SEOmi', '', [], 'What is SEOmi?').brandMentioned).toBe(false);
    expect(analyzeAiEvidence('Rafał Szymański is an athlete. https://sports.test/person', 'Rafał Szymański', 'training.test', []).brandMentioned).toBe(false);
    expect(analyzeAiEvidence('Rafał Szymański is an athlete. https://sports.test/person', 'Rafał Szymański', 'training.test', []).mentionPosition).toBeNull();
    expect(analyzeAiEvidence('SEOmi is a tool.', 'SEO', '', []).brandMentioned).toBe(false);
  });

  it('tracks first appearance amongst configured competitors and exact own-domain citations', () => {
    const result = analyzeAiEvidence('OtherBrand and SEOmi offer audits: https://docs.seomi.test/audit).', 'SEOmi', 'https://www.seomi.test', ['OtherBrand']);
    expect(result).toMatchObject({ brandMentioned: true, ownDomainCited: true, mentionPosition: 2, brandMentions: ['OtherBrand', 'SEOmi'], competitorsMentioned: ['OtherBrand'] });
    expect(result.citations).toEqual(['https://docs.seomi.test/audit']);
    expect(analyzeAiEvidence('SEOmi: https://seomi.test.evil.test', 'SEOmi', 'seomi.test', []).brandMentioned).toBe(false);
  });

  it('keeps redaction and citation parsing consistent for both research workflows', () => {
    const text = redactLocalContext('User mail@example.test, /Users/local/projects/a and C:\\Users\\local\\secret. Source: https://source.test/page.');
    expect(text).not.toContain('mail@example.test');
    expect(text).not.toContain('/Users/local');
    expect(text).not.toContain('C:\\Users\\local');
    expect(extractAiCitations(text)).toEqual(['https://source.test/page']);
  });

  it('bounds requests and removes duplicate inputs without inventing default questions', () => {
    expect(normalizeAiResearchSettings({ prompts: [' a ', 'a', ''], repetitions: 100, competitors: ['x', 'x'] })).toEqual({ prompts: ['a'], repetitions: 5, competitors: ['x'] });
    expect(normalizeAiResearchSettings(null).prompts).toEqual([]);
  });
});


describe('AI research edge cases', () => {
  it.each([0, -5, 1.9, 99, NaN])('normalizes repetition count %j to a bounded integer', (value) => {
    const repetitions = normalizeAiResearchSettings({ repetitions: value }).repetitions;
    expect(repetitions).toBe(Number.isNaN(value) || value <= 0 ? 1 : Math.min(5, Math.floor(value)));
  });

  it('bounds persisted prompts and competitors and ignores malformed entries', () => {
    const settings = normalizeAiResearchSettings({ prompts: [...Array.from({ length: 15 }, (_, i) => `Question ${i}`), 42] as never, competitors: Array.from({ length: 25 }, (_, i) => `Brand ${i}`) });
    expect(settings.prompts).toHaveLength(10);
    expect(settings.competitors).toHaveLength(20);
    expect(normalizeAiResearchSettings({ prompts: 'wrong-shape', competitors: null } as never)).toEqual({ prompts: [], competitors: [], repetitions: 1 });
  });

  it('counts repeated case-insensitive competitors once in textual order', () => {
    expect(analyzeAiEvidence('OtherBrand, OTHERBRAND and SEOmi: https://seomi.test', 'SEOmi', 'seomi.test', ['OtherBrand', 'OTHERBRAND', 'SEOmi'])).toMatchObject({ mentionPosition: 2, competitorsMentioned: ['OtherBrand'], brandMentions: ['OtherBrand', 'SEOmi'] });
  });

  it('recognizes an own-domain citation without a literal brand name but does not invent its position', () => {
    expect(analyzeAiEvidence('Try this tool: https://docs.seomi.test/audit', 'Audit tool', 'seomi.test', [])).toMatchObject({ brandMentioned: true, ownDomainCited: true, mentionPosition: null, brandMentions: ['Audit tool'] });
  });

  it('removes credential-bearing citations and does not accept lookalike domain suffixes', () => {
    const result = analyzeAiEvidence('SEOmi https://user:pass@seomi.test https://seomi.test.evil.test https://evilseomi.test', 'SEOmi', 'seomi.test', []);
    expect(result.citations).toEqual(['https://seomi.test.evil.test', 'https://evilseomi.test']);
    expect(result).toMatchObject({ brandMentioned: false, ownDomainCited: false, mentionPosition: null });
  });

  it('discards citations with invalid port or invalid URL syntax', () => {
    const text = 'Valid https://valid.test and invalid https://bad.test:99999.';
    expect(extractAiCitations(text)).toEqual(['https://valid.test']);
    const analysis = analyzeAiEvidence(text, 'Valid', 'valid.test', []);
    expect(analysis.citations).toEqual(['https://valid.test']);
  });
});
