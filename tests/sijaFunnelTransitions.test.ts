// @vitest-environment node
import { expect, it } from 'vitest';
import { crawlFunnelStage, featuresFromCrawlPage } from '@/services/sija/crawlFeatures';
import { funnelTransitions, type FunnelPageInput } from '@/services/sija/funnelTransitions';

const link = (target_url: string, is_internal = true) => ({ target_url, anchor_text: 'a', is_internal });
const page = (url: string, title: string, dom: FunnelPageInput['dom_structure'], links: FunnelPageInput['semantic_links'] = []): FunnelPageInput => ({
  url, final_url: url, title, word_count: 400, heading_counts: [1, 3], dom_structure: dom, semantic_links: links,
});
const none = { tables: 0, ordered_lists: 0, unordered_lists: 0, interactive_inputs: 0 };

it('reads features from dom_structure and is null without it', () => {
  expect(featuresFromCrawlPage(page('https://a.test/', 't', undefined))).toBeNull();
  expect(featuresFromCrawlPage({ ...page('https://a.test/', 'How to x', { ...none, tables: 2 }), heading_counts: undefined })).toMatchObject({ tables: 2, headings: 0, headingText: 'How to x', calculators: 0 });
  expect(crawlFunnelStage(page('https://a.test/', 'Hi', undefined))).toBeNull();
  expect(crawlFunnelStage(page('https://a.test/', 'Hi', none))).toBeNull();
});

it('counts links between classified stages and skips the rest', () => {
  const pages = [
    page('https://a.test/how', 'How to bake', { ...none, ordered_lists: 1 }, [link('https://a.test/cmp#x'), link('https://a.test/ext', false), link('https://a.test/unknown')]),
    page('https://a.test/cmp', 'A vs B', { ...none, tables: 1 }, [link('https://a.test/how/')]),
    page('https://a.test/unknown', 'Hi', undefined),
  ];
  const report = funnelTransitions(pages);
  expect(report.transitions.TOFU.MOFU).toBe(1);
  expect(report.transitions.MOFU.TOFU).toBe(1);
  expect(report).toMatchObject({ classifiedPages: 2, unclassifiedPages: 1, skippedLinks: 1 });
});

it('treats a missing title as empty heading text', () => {
  const noTitle = { ...page('https://a.test/', 't', { ...none, tables: 1 }), title: null };
  expect(featuresFromCrawlPage(noTitle)).toMatchObject({ headingText: '', headings: 4 });
});

it('reports zero links for a page without semantic_links', () => {
  const { semantic_links: _omitted, ...bare } = page('https://a.test/how', 'How to bake', { ...none, ordered_lists: 1 });
  expect(funnelTransitions([bare])).toMatchObject({ classifiedPages: 1, unclassifiedPages: 0, skippedLinks: 0 });
});
