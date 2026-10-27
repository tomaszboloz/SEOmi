import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aioBandFor, answerFirstScore, buildAioReport, buildRewritePrompt, chunkSections, countDangling, extractabilityOf, rewritePassage,
  rulesFor, scoreChunk, scorePageAio, summarizeAio, crawlAioSummary, AIO_PDF_PAGES,
} from '@/services/aioReadiness';
import type { CrawlRunRecord } from '@/types';
import { aioPage, GOOD, GOOD_PAGE, section, WEAK, WEAK_PAGE } from './aioFixtures';

const en = rulesFor('en').rules;
const para = (words: number, prefix = 'Word'): string => Array.from({ length: words }, (_, i) => `${prefix}${i}`).join(' ') + '.';

describe('chunking', () => {
  it('makes one chunk per section and windows long sections with overlap', () => {
    expect(chunkSections([GOOD, WEAK])).toHaveLength(2);
    const long = section('Long', [para(150, 'a'), para(100, 'b'), para(40, 'c'), para(200, 'd')]);
    const chunks = chunkSections([long]);
    expect(chunks.map((c) => c.windowIndex)).toEqual([0, 1]);
    expect(chunks[1].paragraphs[0]).toContain('c0');
    expect(chunks[0].paragraphs).toHaveLength(3);
    expect(chunkSections([section('Only heading', [])])).toEqual([]);
    expect(chunkSections([section('J', ['犬は走る。'])], true)[0].tokens).toBeGreaterThan(0);
  });
});

describe('chunk scoring', () => {
  it('detects dangling pronouns unless the heading entity is named', () => {
    expect(countDangling(['It can vary.', 'Sensors vary.'], 'CGM sensors', en)).toBe(1);
    expect(countDangling(['This sensor works.'], 'Sensor life', en)).toBe(0);
    expect(countDangling([''], 'x', en)).toBe(1 - 1);
    expect(countDangling(['These battery units require careful recycling.'], 'Replacement batteries', en)).toBe(0);
  });

  it('scores answer-first by naming, facts and clean openers', () => {
    const [good] = chunkSections([GOOD]);
    const [weak] = chunkSections([WEAK]);
    expect(answerFirstScore(good, en)).toBeGreaterThan(0.8);
    expect(answerFirstScore(weak, en)).toBeLessThan(0.5);
    expect(answerFirstScore({ ...good, heading: '' }, en)).toBe(1);
    expect(answerFirstScore({ ...good, windowIndex: 1 }, en)).toBe(1);
    expect(answerFirstScore({ ...good, paragraphs: ['Short.'] }, en)).toBe(0.2);
    expect(answerFirstScore({ ...good, heading: 'a' }, en)).toBeGreaterThan(0);
  });

  it('flags every issue code on a weak chunk and none on a good one', () => {
    const weak = scoreChunk(chunkSections([WEAK])[0], en);
    expect(weak.issues).toEqual(expect.arrayContaining(['dangling-pronoun', 'no-answer-first', 'no-facts']));
    expect(weak.score).toBeLessThan(50);
    const filler = scoreChunk({ heading: 'Q', level: 2, paragraphs: ['As mentioned before, everything varies a lot.'], tokens: 7, windowIndex: 0 }, en);
    expect(filler.issues).toContain('filler-opening');
    const good = scoreChunk(chunkSections([GOOD])[0], en);
    expect(good.issues).toEqual([]);
    expect(good.score).toBeGreaterThan(70);
    const huge = scoreChunk({ heading: 'H', level: 2, paragraphs: [para(600)], tokens: 600, windowIndex: 0 }, en);
    expect(huge.issues).toContain('too-long');
  });
});

describe('page and report', () => {
  it('scores extractability from structures and outline', () => {
    expect(extractabilityOf([])).toBe(0);
    expect(extractabilityOf([GOOD, section('H2', [], { level: 2 }), section('H3', [], { level: 3 }), section('H2b', [], { level: 2 }), section('H2c', [], { level: 2 })])).toBe(1);
  });

  it('scores pages, reports weak chunks and skips unusable pages', () => {
    const good = scorePageAio(GOOD_PAGE);
    const weak = scorePageAio(WEAK_PAGE);
    expect(good.score).toBeGreaterThan(weak.score);
    expect(good.coverage).toBe('full');
    expect(weak.weakChunks).toHaveLength(1);
    expect(weak.danglingCount).toBe(1);
    expect(scorePageAio(aioPage('https://a.test/x', undefined)).skipped).toBe('no-sections');
    expect(scorePageAio(aioPage('https://a.test/x', [section('H', [])])).skipped).toBe('no-content');
    expect(scorePageAio(aioPage('https://a.test/x', [WEAK], { http_status: 404 })).skipped).toBe('request-error');
    expect(scorePageAio(aioPage('https://a.test/x', [WEAK], { http_status: 0 })).skipped).toBe('request-error');
    expect(scorePageAio(aioPage('https://a.test/x', [WEAK], { final_url: '', semantic_language: 'ja' } as never)).coverage).toBe('basic');
    expect(scorePageAio(aioPage('https://a.test/x', [WEAK], { semantic_language: null, document_language: 'pl-PL' })).language).toBe('pl');
  });

  it('aggregates by mean, ranks weak passages and lists basic-rule languages', () => {
    const report = buildAioReport([GOOD_PAGE, WEAK_PAGE, aioPage('https://a.test/de', [WEAK], { semantic_language: 'de' }), aioPage('https://a.test/none', undefined)], { now: '2026-10-16T00:00:00Z' });
    expect(report).toMatchObject({ scoredCount: 3, skippedCount: 1, pageCount: 4, generatedAt: '2026-10-16T00:00:00Z', basicRuleLanguages: ['de'] });
    expect(report.weakPassages[0].url).toBeDefined();
    expect(report.weakPassages.length).toBeLessThanOrEqual(25);
    expect(buildAioReport([]).score).toBe(0);
    expect(buildAioReport([aioPage('u', undefined)]).band).toBe('critical');
    expect(buildAioReport([WEAK_PAGE]).generatedAt).toMatch(/T/);
    [[95, 'excellent'], [80, 'good'], [65, 'moderate'], [45, 'weak'], [10, 'critical']].forEach(([score, band]) => expect(aioBandFor(score as number)).toBe(band));
  });

  it('breaks ties between equally weak passages by url', () => {
    const report = buildAioReport([aioPage('https://a.test/b', [WEAK]), aioPage('https://a.test/a', [WEAK])]);
    expect(report.weakPassages.map((p) => p.url)).toEqual(['https://a.test/a', 'https://a.test/b']);
  });
});

describe('PDF summary', () => {
  const run = (pages: unknown[], flags: Record<string, boolean> = {}): CrawlRunRecord => ({ id: 'r', result: { pages, ...flags } } as unknown as CrawlRunRecord);

  it('keeps only weakest pages and bounded passages', () => {
    const many = Array.from({ length: 30 }, (_, i) => aioPage(`https://a.test/${i}`, [i % 2 ? GOOD : WEAK]));
    const summary = summarizeAio(buildAioReport([...many, aioPage('https://a.test/skip', undefined)]));
    expect(summary.pages).toHaveLength(AIO_PDF_PAGES);
    expect(summary.pages[0].score).toBeLessThanOrEqual(summary.pages[24].score);
    expect(summary.passages.length).toBeLessThanOrEqual(12);
    expect(summary.skipped).toBe(1);
    const long = summarizeAio(buildAioReport([aioPage('https://a.test/l', [section('H', [`It ${'x'.repeat(400)}`])])]));
    expect(long.passages[0].excerpt.endsWith('…')).toBe(true);
    expect(summarizeAio(buildAioReport([WEAK_PAGE])).passages[0].excerpt).not.toContain('…');
  });

  it('keeps cancelled, timed-out and empty runs out of the PDF, but discloses old non-empty runs', () => {
    expect(crawlAioSummary(run([GOOD_PAGE]))?.scored).toBe(1);
    const partial = crawlAioSummary(run([GOOD_PAGE, aioPage('partial-old', undefined)]));
    expect(partial?.availability).toBe('partial');
    expect(partial?.unknown_reasons).toContain('no-sections');
    expect(crawlAioSummary(run([]))).toBeUndefined();
    expect(crawlAioSummary(run([aioPage('u', undefined)]))).toMatchObject({ score: null, availability: 'unavailable', unknown_reasons: ['no-sections'] });
    expect(crawlAioSummary(run([GOOD_PAGE], { cancelled: true }))).toBeUndefined();
    expect(crawlAioSummary(run([GOOD_PAGE], { timed_out: true }))).toBeUndefined();
    expect(crawlAioSummary({ id: 'r' } as unknown as CrawlRunRecord)).toBeUndefined();
  });
});

describe('AI rewrite', () => {
  const chunk = { heading: 'Q', text: 'It varies.', issues: ['dangling-pronoun' as const] };
  let generateText: ReturnType<typeof vi.fn<(prompt: string) => Promise<string>>>;
  beforeEach(() => { generateText = vi.fn<(prompt: string) => Promise<string>>(); });

  it('builds a prompt with the rules and the detected problems', () => {
    const prompt = buildRewritePrompt(chunk);
    expect(prompt).toContain('Heading: Q');
    expect(prompt).toContain('explicit entity name');
    expect(buildRewritePrompt({ ...chunk, heading: '' })).toContain('(none)');
  });

  it('returns ok, no-key, empty and error outcomes without sending when unconfigured', async () => {
    expect(await rewritePassage({ isConfigured: () => false, generateText }, chunk)).toEqual({ status: 'no-key' });
    expect(generateText).not.toHaveBeenCalled();
    generateText.mockResolvedValueOnce('```\nTitle <b>x</b>\n```');
    expect(await rewritePassage({ isConfigured: () => true, generateText }, chunk)).toEqual({ status: 'ok', text: 'Title x' });
    generateText.mockResolvedValueOnce('   ');
    expect((await rewritePassage({ isConfigured: () => true, generateText }, chunk)).status).toBe('empty');
    generateText.mockRejectedValueOnce(new Error('boom'));
    expect(await rewritePassage({ isConfigured: () => true, generateText }, chunk)).toEqual({ status: 'error', message: 'boom' });
    generateText.mockRejectedValueOnce('plain');
    expect(await rewritePassage({ isConfigured: () => true, generateText }, chunk)).toEqual({ status: 'error', message: 'plain' });
  });

  it('builds a prompt hint for every issue code', () => {
    const issues = ['dangling-pronoun', 'no-answer-first', 'filler-opening', 'no-facts', 'too-long'] as const;
    expect(buildRewritePrompt({ ...chunk, issues: [...issues] }).split('\n').filter((line) => line.startsWith('- '))).toHaveLength(5);
  });
});
