import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { createEmptyTopicalMap, importDiagnosisTopics } from '@/services/topicalMap';

const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({ url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch });
const pair = (slug: string, terms: string[], title: string) => [
  page(`https://ex.test/${slug}/`, { title, semantic_terms: terms, hreflangs: [{ language: 'en', target_url: `https://ex.test/en/${slug}/`, reciprocal_in_run: true }] }),
  page(`https://ex.test/en/${slug}/`, { title: `${title} EN`, semantic_language: 'en', semantic_terms: terms.map((term) => `${term}en`), hreflangs: [{ language: 'pl', target_url: `https://ex.test/${slug}/`, reciprocal_in_run: true }] }),
];
const pages = [
  ...pair('a', ['navigator', 'alerty', 'crm'], 'Alerty Sales Navigatora'),
  ...pair('b', ['navigator', 'alerty', 'teams'], 'Alerty Sales Navigatora w Teams'),
  ...pair('c', ['psychiatria', 'dzieci', 'szpital'], 'Psychiatria dzieci'),
  ...pair('d', ['psychiatria', 'dzieci', 'oddział'], 'Psychiatria dzieci na oddziale'),
  page('https://ex.test/solo/', { title: 'Samotna', semantic_terms: ['wordpress', 'kraków'] }),
];

describe('importDiagnosisTopics', () => {
  const report = buildTopicalDiagnosis(pages, 'https://ex.test/');

  it('creates one cluster node per topic with every language version as a source URL', () => {
    const next = importDiagnosisTopics(createEmptyTopicalMap(), report, 'run-1', 'Temat');
    expect(next.nodes).toHaveLength(2);
    const navigator = next.nodes.find((node) => /navigator/i.test(node.title))!;
    expect(navigator).toMatchObject({ kind: 'cluster', sourceRunId: 'run-1', sourceClusterId: report.topics.find((topic) => /navigator/i.test(topic.label))!.id });
    expect(navigator.sourceUrls.sort()).toEqual(['https://ex.test/a/', 'https://ex.test/b/', 'https://ex.test/en/a/', 'https://ex.test/en/b/']);
    expect(navigator.evidenceTerms).toEqual(expect.arrayContaining(['navigator', 'alerty', 'crm', 'teams', 'navigatoren']));
    expect(next.nodes.some((node) => node.sourceUrls.some((url) => new URL(url).href === 'https://ex.test/solo/'))).toBe(false);
  });

  it('does not import the same topic twice for one run and uses the fallback title when a topic has no label', () => {
    const once = importDiagnosisTopics(createEmptyTopicalMap(), report, 'run-1', 'Temat');
    expect(importDiagnosisTopics(once, report, 'run-1', 'Temat').nodes).toHaveLength(2);
    expect(importDiagnosisTopics(once, report, 'run-2', 'Temat').nodes).toHaveLength(4);
    const unlabelled = { ...report, topics: [{ ...report.topics[0], label: '', labelSource: 'none' as const }] };
    expect(importDiagnosisTopics(createEmptyTopicalMap(), unlabelled, 'run-3', 'Temat').nodes[0].title).toBe('Temat · /a/');
  });
});
