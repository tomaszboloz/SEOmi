import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport } from '@/services/siteFocus';






import { diabetesSite, topicArticles } from './siteFocusFixtures';


const START = 'https://diabetes.test/';
const build = (pages = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: '2026-10-15T00:00:00Z', ...options });


describe('options and edge branches', () => {
  it('derives the language from the pages, honours an explicit one and stamps the time', () => {
    const polish = diabetesSite().map((page) => ({ ...page, document_language: 'pl-PL' }));
    expect(build(polish).model.language).toBe('pl');
    expect(build(diabetesSite().map((page) => ({ ...page, document_language: null }))).model.language).toBe('');
    expect(build(polish, { language: 'en' }).model.language).toBe('en');
    expect(buildSiteFocusReport(diabetesSite(), START).generatedAt).toMatch(/^\d{4}-/);
  });

  it('treats a matching manual topic as a boosted core and keeps the matched cluster id', () => {
    const matched = build(diabetesSite(), { manualTopic: 'insulin' });
    expect(matched.coreTopic.clusterId).toBe('c1');
    expect(matched.model.kCore[0]).toBe('insulin');
  });

  it('keeps pages without a word count scoreable and tolerates missing link arrays', () => {
    const pages = diabetesSite().map((page, index) => (index === 0 ? { ...page, word_count: 0 } : page));
    expect(build(pages).pages[0].wordCount).toBe(0);
  });

  it('ranks sub-sites only when the dominant clusters have URL segments', () => {
    const rootOnly = topicArticles('r.test', '', ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'], 6, 8)
      .concat(topicArticles('r.test', '', ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'black', 'white'], 6, 8))
      .map((page, index) => ({ ...page, url: `https://r.test/${index}`, final_url: `https://r.test/${index}` }));
    const result = buildSiteFocusReport(rootOnly, 'https://r.test/', { now: 'x' });
    expect(result.subSites ?? []).toEqual([]);
  });
});
