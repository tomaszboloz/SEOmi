// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { coreTopicShare } from '@/services/semanticGraph/topicShare';
import { buildSemanticMap } from '@/services/semanticMap';
import { phraseKey } from '@/services/siteFocus/terms';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, semantic_terms?: string[]) => ({ url, final_url: url, http_status: 200, links: [], semantic_links: [], semantic_terms }) as unknown as CrawledPageSummary;
const coreKeys = new Set([phraseKey('insulin', 'en')!, phraseKey('glucose', 'en')!]);
const topic = { coreKeys, language: 'en' };

describe('semanticGraph consumes the shared TopicModel (#106)', () => {
  it('measures the share of terms in the Core Topic with Site Focus keys, unknown without terms', () => {
    expect(coreTopicShare(page('a', ['insulin', 'glucose', 'phone', 'case']), topic)).toBe(0.5);
    expect(coreTopicShare(page('a', ['the', '!!']), topic)).toBeNull();
    expect(coreTopicShare(page('a', []), topic)).toBeNull();
    expect(coreTopicShare(page('a'), topic)).toBeNull();
  });
  it('adds coreTopicShare to nodes only when a model and terms exist', () => {
    const pages = [page('https://a.test/', ['insulin', 'phone']), page('https://a.test/b', [])];
    const withModel = buildSemanticMap(pages, 'https://a.test/', { topicModel: topic });
    expect(withModel.nodes[0].coreTopicShare).toBe(0.5);
    expect(withModel.nodes[1]).not.toHaveProperty('coreTopicShare');
    expect(buildSemanticMap(pages, 'https://a.test/').nodes[0]).not.toHaveProperty('coreTopicShare');
  });
});
