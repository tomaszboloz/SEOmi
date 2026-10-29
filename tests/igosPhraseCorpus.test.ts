import { describe, expect, it } from 'vitest';
import { buildPhraseIgos, chunkText, LOCAL_LEXICAL, PHRASE_IGOS_PROFILE } from '@/services/igos/phraseIgos';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';
import type { PageAuditData } from '@/types';

const words = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i % 7}`).join(' ');
const corpus = (pages: number): TopTenCorpus => ({
  target: { url: 'https://me.test/', text: `${words('coffee', 90)} grinder burr 12 g 93 °C we tested`, wordCount: 100 },
  pages: Array.from({ length: pages }, (_, i) => ({ rank: i + 1, url: `https://c${i}.test/`, fetchedAt: '2026-10-29T00:00:00Z', status: 200, text: words('coffee', 80) })),
  requested: 3,
});

describe('IGOS from the phrase TOP 10 corpus (#67/#68)', () => {
  it('chunks text into bounded word windows with offsets', () => {
    expect(chunkText('')).toEqual([]);
    const chunks = chunkText(` a ${'w '.repeat(PHRASE_IGOS_PROFILE.chunkWords * 50)}`);
    expect(chunks).toHaveLength(PHRASE_IGOS_PROFILE.maxChunks);
    expect(chunks[0].offset).toBe(1);
    expect(chunks[1].text.split(' ')).toHaveLength(PHRASE_IGOS_PROFILE.chunkWords);
  });
  it('returns null without target text and when the embedder drops vectors', async () => {
    expect(await buildPhraseIgos({ ...corpus(3), target: null })).toBeNull();
    expect(await buildPhraseIgos(corpus(3), async () => [])).toBeNull();
  });
  it('scores against a real baseline and labels local lexical vectors', async () => {
    const report = await buildPhraseIgos(corpus(3));
    expect(report?.availableDocs).toBe(3);
    expect(report?.requestedDocs).toBe(3);
    expect(report?.zones.length).toBeGreaterThan(0);
    expect(report?.limitations).toContain(LOCAL_LEXICAL);
  });
  it('gives no score without competitor pages and no lexical label for an injected model', async () => {
    const empty = await buildPhraseIgos(corpus(0));
    expect(empty?.status).toBe('unavailable');
    expect(empty?.igos).toBeNull();
    const injected = await buildPhraseIgos(corpus(3), async (texts) => texts.map(() => new Float64Array([1, 0])));
    expect(injected?.limitations).not.toContain(LOCAL_LEXICAL);
  });
  it('content gap reports carry the fetched corpus only', () => {
    const audit = (url: string, body: string) => ({ url, final_url: url, http_status: 200, meta_tags: { title: 'T' }, headings: { h1_texts: [] }, content_stats: { body_text: body, word_count: 2 } }) as unknown as PageAuditData;
    const rows = [{ url: 'https://a.test/', rank_absolute: 1, type: 'organic' }, { url: 'https://b.test/', rank_absolute: 2, type: 'organic' }];
    const report = buildTopTenContentGap({ phrase: 'x', rows, evidence: [{ url: 'https://a.test/', fetchedAt: 'now', audit: audit('https://a.test/', 'alpha beta') }], targetPageAudit: audit('https://me.test/', 'gamma') });
    expect(report.corpus?.requested).toBe(2);
    expect(report.corpus?.pages.map((page) => page.url)).toEqual(['https://a.test/']);
    expect(report.corpus?.target).toEqual({ url: 'https://me.test/', text: 'T gamma', wordCount: 2 });
  });
});

describe('IGOS components (#67 GEM-67-06/07)', () => {
  it('counts measured quantities in EDSI and ignores bare numbers', async () => {
    const { edsi, measuredQuantities } = await import('@/services/igos/components');
    expect(measuredQuantities('Brew at 93 °C with 12 g, 4,5 kWh, 30% and $5; year 2024, page 3, v1.2, 10.1000/x')).toBe(5);
    expect(edsi('12 g 15 g 18 g 20 g', 1000)).toBeCloseTo(1 / 3);
    expect(edsi('no data here 2024', 1000)).toBe(0);
  });
  it('counts only novel entities found in on-topic text', async () => {
    const { novelEntities } = await import('@/services/igos/components');
    const base = { consensusEntities: ['coffee'] } as never;
    expect(novelEntities(['coffee', 'burr', 'crypto'], base)).toEqual(['burr', 'crypto']);
    expect(novelEntities(['coffee', 'Burr', 'crypto'], base, 'the burr grinder sets the coffee size')).toEqual(['Burr']);
  });
});
