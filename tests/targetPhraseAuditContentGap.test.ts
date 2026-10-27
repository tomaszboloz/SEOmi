import { describe, expect, it } from 'vitest';
import type { PageAuditData } from '@/types';
import { buildTopTenContentGap, collectTopTenContentGap, normalizeSerpUrl, selectOrganicTopTen } from '@/services/targetPhraseAudit';

const page = (url: string, status = 200, body = 'SEO guide and accessibility details.'): PageAuditData => ({
  url, final_url: url, http_status: status, timestamp: '2026-10-06T10:00:00.000Z',
  meta_tags: { title: 'SEO guide', description: null },
  headings: { h1_count: 1, h1_texts: ['SEO guide'], hierarchy: [], has_valid_hierarchy: true, issues: [] },
  content_stats: { body_text: body },
} as unknown as PageAuditData);

const row = (rank: number, url: string, type = 'organic') => ({ type, rank_absolute: rank, url, title: `Result ${rank}`, description: `Description ${rank}` });

describe('top ten content gap evidence', () => {
  it('accepts only organic positions 1–10, removes malformed and duplicate URLs', () => {
    const rows = selectOrganicTopTen([
      row(2, 'https://b.test/page/'), row(1, 'https://a.test/#fragment'), row(1, 'https://a.test/'),
      row(11, 'https://outside.test/'), row(3, 'https://paid.test/', 'paid'), row(4, 'not-a-url'),
      row(5, ''),
    ]);
    expect(rows.map((item) => [item.rank, item.url])).toEqual([[1, 'https://a.test/'], [2, 'https://b.test/page']]);
    expect(normalizeSerpUrl('ftp://example.test/')).toBeNull();
    expect(normalizeSerpUrl('not-a-url')).toBeNull();
    expect(selectOrganicTopTen([{ type: 'organic', rank: 1, url: 'https://rank-only.test/' }])).toHaveLength(1);
    expect(selectOrganicTopTen([{ type: 'organic', url: 'https://missing-rank.test/' }])).toEqual([]);
  });

  it('builds directly from supplied page audits and preserves unavailable evidence', () => {
    const suppliedRows = [row(1, 'https://one.test/'), row(2, 'https://two.test/'), row(3, 'https://three.test/')];
    const report = buildTopTenContentGap({
      phrase: ' SEO ', rows: suppliedRows, retrievedAt: '2026-10-06T12:00:00.000Z',
      evidence: [
        { url: 'https://one.test/#source', fetchedAt: '2026-10-06T11:01:00.000Z', audit: page('https://one.test/', 200, 'SEO accessibility') },
        { url: 'https://two.test/', fetchedAt: '2026-10-06T11:02:00.000Z', audit: page('https://two.test/', 200, '') },
      ],
      targetEvidence: { url: 'https://target.test/', fetchedAt: '2026-10-06T11:03:00.000Z', audit: page('https://target.test/', 200, 'SEO') },
    });
    expect(report).toMatchObject({ phrase: 'SEO', status: 'partial', availablePages: 1, targetAvailable: true, locationCode: null, languageCode: null });
    expect(report.rows.map((item) => [item.rank, item.availability, item.error, item.fetchedAt])).toEqual([
      [1, 'available', null, '2026-10-06T11:01:00.000Z'], [2, 'unavailable', 'body-unavailable', '2026-10-06T11:02:00.000Z'], [3, 'error', 'missing-evidence', null],
    ]);
    expect(report.topics.find((topic) => topic.term === 'seo')).toMatchObject({ status: 'covered', targetPresent: true, targetOccurrences: 3 });
    expect(report.topics.find((topic) => topic.term === 'accessibility')).toMatchObject({ observedPages: 1, availablePages: 1, share: 1, status: 'gap', targetOccurrences: 0, targetPresent: false });
    expect(buildTopTenContentGap({ phrase: 'x', rows: [], evidence: [], now: () => 'clock' })).toMatchObject({ status: 'unavailable', retrievedAt: 'clock', targetAvailable: false, topics: [] });
  });

  it('uses available pages as the denominator and bounds inspection concurrency', async () => {
    let active = 0;
    let maximum = 0;
    const report = await collectTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://one.test/'), row(2, 'https://two.test/'), row(3, 'https://three.test/')],
      locationCode: 2616, languageCode: 'pl', concurrency: 2, now: () => '2026-10-06T11:00:00.000Z',
      inspectUrl: async (url) => {
        active += 1; maximum = Math.max(maximum, active);
        await Promise.resolve();
        active -= 1;
        if (url.includes('three')) throw new Error('timeout');
        return page(url, 200, url.includes('two') ? 'SEO guide' : 'SEO guide accessibility');
      },
    });
    expect(maximum).toBeLessThanOrEqual(2);
    expect(report).toMatchObject({ source: 'supplied-serp', locationCode: 2616, languageCode: 'pl', status: 'partial', targetAvailable: false, availablePages: 2 });
    expect(report.rows.map((item) => [item.rank, item.availability, item.fetchedAt])).toEqual([
      [1, 'available', '2026-10-06T11:00:00.000Z'], [2, 'available', '2026-10-06T11:00:00.000Z'], [3, 'error', '2026-10-06T11:00:00.000Z'],
    ]);
    const accessibility = report.topics.find((topic) => topic.term === 'accessibility');
    expect(accessibility).toMatchObject({ observedPages: 1, availablePages: 2, share: 0.5, status: 'unknown', targetOccurrences: null, targetPresent: null });
  });

  it('does not attribute an inspection response to a different SERP URL', async () => {
    const report = await collectTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://requested.test/')],
      inspectUrl: async () => page('https://unrelated.test/'),
    });
    expect(report).toMatchObject({ status: 'unavailable', availablePages: 0 });
    expect(report.rows[0]).toMatchObject({ availability: 'error', error: 'Inspected page evidence does not match the requested SERP URL' });
  });
  it('marks mismatched supplied evidence as an error instead of using its content', () => {
    const report = buildTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://requested.test/')],
      evidence: [{ url: 'https://requested.test/', fetchedAt: 'fetched', audit: page('https://unrelated.test/', 200, 'exclusive topic') }],
    });
    expect(report.rows[0]).toMatchObject({ availability: 'error', error: 'Inspected page evidence does not match the requested SERP URL' });
    expect(report.topics).toEqual([]);
  });
  it('keeps no-data reports unavailable instead of creating missing topics', async () => {
    const report = await collectTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://gone.test/')], inspectUrl: async () => page('https://gone.test/', 404, 'SEO'),
    });
    expect(report).toMatchObject({ status: 'unavailable', availablePages: 0, targetAvailable: false, topics: [] });
    expect(report.rows[0]).toMatchObject({ availability: 'unavailable', error: 'http-404', status: 404 });
  });
  it('normalizes non-finite concurrency to a bounded worker count', async () => {
    let calls = 0;
    const report = await collectTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://nan.test/')], concurrency: Number.NaN,
      inspectUrl: async (url) => { calls += 1; return page(url); },
    });
    expect(calls).toBe(1);
    expect(report.rows[0].availability).toBe('available');
  });
  it('records complete reports and caps topic evidence at four pages', () => {
    const rows = [1, 2, 3, 4, 5].map((rank) => row(rank, `https://page-${rank}.test/`));
    const report = buildTopTenContentGap({
      phrase: 'SEO', rows, locationCode: 2840, languageCode: 'en', now: () => 'clock',
      evidence: rows.map((item) => ({ url: item.url!, fetchedAt: 'fetched', audit: page(item.url!, 200, 'SEO topic') })),
    });
    expect(report.status).toBe('complete');
    expect(report.topics.find((topic) => topic.term === 'topic')?.evidence).toHaveLength(4);
  });
  it('retains long topic excerpts and ignores punctuation-only content', () => {
    const rows = [row(1, 'https://deep.test/'), row(2, 'https://tail.test/'), row(3, 'https://empty.test/')];
    const report = buildTopTenContentGap({
      phrase: 'SEO', rows, evidence: [
        { url: rows[0].url!, fetchedAt: 'fetched', audit: page(rows[0].url!, 200, `${'a '.repeat(100)}deepterm ${'b '.repeat(200)}`) },
        { url: rows[1].url!, fetchedAt: 'fetched', audit: page(rows[1].url!, 200, `${'a '.repeat(200)}tailterm`) },
        { url: rows[2].url!, fetchedAt: 'fetched', audit: page(rows[2].url!, 200, '!!!') },
      ],
    });
    expect(report.topics.find((topic) => topic.term === 'deepterm')?.evidence[0].excerpt).toMatch(/^…/);
    expect(report.topics.find((topic) => topic.term === 'tailterm')?.evidence[0].excerpt).not.toMatch(/…$/);
    expect(report.topics.some((topic) => topic.term === '!!!')).toBe(false);
  });
  it('keeps provider metadata empty when a supplied row omits it', () => {
    const report = buildTopTenContentGap({
      phrase: 'SEO', rows: [{ type: 'organic', rank_absolute: 1, url: 'https://bare.test/' }],
      evidence: [{ url: 'https://bare.test/', fetchedAt: 'fetched', audit: page('https://bare.test/') }],
    });
    expect(report.rows[0]).toMatchObject({ providerTitle: '', providerDescription: '' });
  });
  it('handles bounded lexical input with no matches and partial target metadata', () => {
    const rowWithNoUrl = { type: 'organic', rank_absolute: 1 };
    expect(selectOrganicTopTen([rowWithNoUrl])).toEqual([]);
    const report = buildTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://lexical.test/')],
      evidence: [{ url: 'https://lexical.test/', fetchedAt: 'fetched', audit: page('https://lexical.test/', 200, 'SEO topic') }],
      targetPageAudit: {
        url: 'https://target.test/', meta_tags: { title: '' }, headings: { h1_texts: [] }, content_stats: { body_text: '!!!' },
      } as unknown as PageAuditData,
    });
    expect(report.targetAvailable).toBe(true);
    expect(report.topics.find((topic) => topic.term === 'topic')).toMatchObject({ status: 'gap', targetOccurrences: 0 });
    const legacyTarget = buildTopTenContentGap({
      phrase: 'SEO', rows: [row(1, 'https://legacy-target.test/')],
      evidence: [{ url: 'https://legacy-target.test/', fetchedAt: 'fetched', audit: page('https://legacy-target.test/', 200, 'SEO topic') }],
      targetPageAudit: { url: 'https://legacy-target.test/' } as PageAuditData,
    });
    expect(legacyTarget).toMatchObject({ targetAvailable: true, status: 'complete' });
  });
});
