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
