import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSemanticMap } from '@/services/semanticMap';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, final = url, targets: Array<string | undefined> = []) => ({
  url, final_url: final, semantic_terms: [],
  semantic_links: targets.map((target_url) => ({ target_url, anchor_text: '', is_internal: true })),
}) as unknown as CrawledPageSummary;

describe('semantic map URL ownership', () => {
  it('does not turn missing or blank hyperlink targets into the source URL', () => {
    const map = buildSemanticMap([
      page('https://site.test/', undefined, ['', ' ', undefined]),
      page('https://site.test/redirect', 'https://site.test/'),
    ], 'https://site.test/');
    expect(map.edges).toEqual([]);
    expect(map.totalInternalLinks).toBe(0);
  });

  it('prefers the exact requested document over another page redirect alias', () => {
    const map = buildSemanticMap([
      page('https://site.test/source', undefined, ['https://site.test/article']),
      page('https://site.test/article'),
      page('https://site.test/legacy', 'https://site.test/article'),
    ], 'https://site.test/source');
    expect(map.edges).toEqual([expect.objectContaining({ source: 'page-0', target: 'page-1' })]);
    expect(map.nodes[1].incomingContentLinks).toBe(1);
    expect(map.nodes[2].incomingContentLinks).toBe(0);
  });

  it('does not invent an owner for an ambiguous final URL shared by different requests', () => {
    const map = buildSemanticMap([
      page('https://site.test/source', undefined, ['https://site.test/shared']),
      page('https://site.test/a', 'https://site.test/shared'),
      page('https://site.test/b', 'https://site.test/shared'),
    ], 'https://site.test/source');
    expect(map.edges).toEqual([]);
    expect(map.nodes.slice(1).map((node) => node.orphan)).toEqual([true, true]);
  });

  it('keeps every semantic map responsibility within 150 physical lines', () => {
    const directory = 'src/services/semanticGraph';
    for (const file of ['src/services/semanticMap.ts', ...readdirSync(directory).map((file) => `${directory}/${file}`)]) {
      const source = readFileSync(file, 'utf8');
      expect(source.split('\n').length - Number(source.endsWith('\n')), file).toBeLessThanOrEqual(150);
    }
  });
});
