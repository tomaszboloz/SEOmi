import { afterEach, describe, expect, it } from 'vitest';
import { buildSiteFocusReport, cleanSegments, formatSegmentInput, MAX_SEGMENTS, parseSegmentInput } from '@/services/siteFocus';
import { focusConfigHash } from '@/services/siteFocus/configHash';
import { buildProjectRunReport, focusSegmentsKey, projectFocusOptions, readFocusSegments, writeFocusSegments } from '@/services/siteFocusMonitoring';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import type { CrawlRunRecord } from '@/types';
import { ELECTRONICS, FASHION, multiTopicSite } from './siteFocusFixtures';

const START = 'https://shop.test/';
const NOW = '2026-10-30T00:00:00Z';
const build = (segments?: Parameters<typeof cleanSegments>[0]) =>
  buildSiteFocusReport(multiTopicSite(), START, { language: 'en', now: NOW, segments: segments as never });

afterEach(() => localStorage.clear());

describe('segment input validation (#82 GEM-82-05)', () => {
  it('normalises prefixes and drops invalid, duplicate and surplus rows', () => {
    expect(cleanSegments([
      { label: ' Shop ', pathPrefix: '/Electronics/' },
      { label: 'dup', pathPrefix: '/electronics' },
      { label: '', pathPrefix: '/x' },
      { label: 'root', pathPrefix: '/' },
      { label: 'rel', pathPrefix: 'fashion' },
      { label: 'query', pathPrefix: '/a?b' },
      { label: 'x'.repeat(61), pathPrefix: '/long' },
      { label: 'topic', pathPrefix: '/t', topic: 't'.repeat(201) },
      null,
      { label: 'Wear', pathPrefix: '/fashion', topic: ' dress ' },
    ])).toEqual([{ label: 'Shop', pathPrefix: '/electronics' }, { label: 'Wear', pathPrefix: '/fashion', topic: 'dress' }]);
    expect(cleanSegments('nope')).toEqual([]);
    const many = Array.from({ length: 15 }, (_, i) => ({ label: `S${i}`, pathPrefix: `/s${i}` }));
    expect(cleanSegments(many)).toHaveLength(MAX_SEGMENTS);
  });

  it('parses and formats the one-per-line text form', () => {
    const parsed = parseSegmentInput('Tech | /electronics\nbad line\nWear | /fashion | dress | silk\n');
    expect(parsed).toEqual([{ label: 'Tech', pathPrefix: '/electronics' }, { label: 'Wear', pathPrefix: '/fashion', topic: 'dress | silk' }]);
    expect(formatSegmentInput(parsed)).toBe('Tech | /electronics\nWear | /fashion | dress | silk');
  });
});

describe('segment scoring', () => {
  it('scores each segment against its own Core and leaves the site SFS and hash unchanged', () => {
    const plain = build();
    const report = build([{ label: 'Tech', pathPrefix: '/electronics' }, { label: 'Wear', pathPrefix: '/fashion' }]);
    expect(plain.segments).toBeUndefined();
    expect(report.score).toBe(plain.score);
    expect(report.coreTopic).toEqual(plain.coreTopic);
    expect(report.coreConfigHash).toBe(plain.coreConfigHash);
    const [tech, wear] = report.segments ?? [];
    expect(tech).toMatchObject({ source: 'user', pathPrefix: '/electronics', pageCount: 10, scoredCount: 10, coreMode: 'anchored' });
    expect(ELECTRONICS.some((term) => tech.coreLabel.includes(term))).toBe(true);
    expect(FASHION.some((term) => wear.coreLabel.includes(term))).toBe(true);
    expect(tech.score).toBeGreaterThan(report.score);
    expect(wear.score).toBeGreaterThan(report.score);
    expect(tech.band).not.toBe('unavailable');
  });

  it('uses a typed segment topic and reports an empty segment as unavailable, not 0', () => {
    const report = build([{ label: 'Wear', pathPrefix: '/fashion', topic: 'dress, jacket' }, { label: 'Ghost', pathPrefix: '/missing' }]);
    const [wear, ghost] = report.segments ?? [];
    expect(wear).toMatchObject({ coreMode: 'manual', coreLabel: 'dress, jacket', topic: 'dress, jacket' });
    expect(ghost).toEqual({ label: 'Ghost', pathPrefix: '/missing', source: 'user', pageCount: 0, scoredCount: 0, score: null, band: 'unavailable', coreLabel: '', coreMode: 'auto' });
  });

  it('exports segment rows to the PDF summary, keeping an unscored segment as null', () => {
    const summary = summarizeSiteFocus(build([{ label: 'Tech', pathPrefix: '/electronics' }, { label: 'Ghost', pathPrefix: '/missing' }]));
    expect(summary.segments?.[0]).toMatchObject({ label: 'Tech', path_prefix: '/electronics', scored: 10, pages: 10 });
    expect(summary.segments?.[1]).toEqual({ label: 'Ghost', path_prefix: '/missing', core: '', scored: 0, pages: 0, score: null });
    expect(summarizeSiteFocus(build()).segments).toBeUndefined();
  });

  it('does not let segments enter the Core Topic config hash', () => {
    expect(focusConfigHash({ segments: [{ label: 'a', pathPrefix: '/a' }] } as never)).toBe(focusConfigHash({}));
  });
});

describe('segment storage', () => {
  const run = { id: 'r1', startUrl: START, status: 'completed', result: { pages: multiTopicSite(), cancelled: false, timed_out: false } } as unknown as CrawlRunRecord;

  it('saves cleaned segments per project, feeds the project report and clears on empty input', () => {
    expect(writeFocusSegments('p1', [{ label: 'Tech', pathPrefix: '/electronics/' }, { label: '', pathPrefix: '/x' }])).toEqual([{ label: 'Tech', pathPrefix: '/electronics' }]);
    expect(readFocusSegments('p1')).toEqual([{ label: 'Tech', pathPrefix: '/electronics' }]);
    expect(projectFocusOptions('p1').segments).toHaveLength(1);
    expect(buildProjectRunReport(run, 'p1', NOW).segments?.[0].pathPrefix).toBe('/electronics');
    writeFocusSegments('p1', []);
    expect(localStorage.getItem(focusSegmentsKey('p1'))).toBeNull();
    expect(projectFocusOptions('p1').segments).toBeUndefined();
  });

  it('ignores invalid projects and corrupt stored values', () => {
    expect(writeFocusSegments('', [{ label: 'Tech', pathPrefix: '/electronics' }])).toHaveLength(1);
    expect(readFocusSegments(null)).toEqual([]);
    localStorage.setItem(focusSegmentsKey('p2'), '{"oops":1}');
    expect(readFocusSegments('p2')).toEqual([]);
  });
});
