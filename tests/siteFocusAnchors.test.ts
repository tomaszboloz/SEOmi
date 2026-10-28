import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { MAX_ANCHORS, MAX_ANCHOR_URL_LENGTH, resolveAnchors } from '@/services/siteFocus/anchors';
import type { Prepared } from '@/services/siteFocus/evaluate';
import { DIABETES_TERMS, PHONE_TERMS, makePage } from './siteFocusFixtures';

const HOST = 'offer.test';
const START = `https://${HOST}/`;
const NOW = '2026-10-27T00:00:00.000Z';
const OFFER = ['smartphone repair', 'battery replacement', 'screen repair', 'charging port', 'warranty', 'service'];
const rotate = (pool: string[], start: number, size: number): Array<[string, number]> =>
  Array.from({ length: size }, (_, j): [string, number] => [pool[(start + j) % pool.length], 3 + ((start + j) % 3)]);

/** Small offer (home + 3 service pages) drowned by a 30-article diabetes blog. */
const bigBlogSmallOffer = (): FocusPage[] => [
  makePage(HOST, { path: '/', title: 'Phone repair service', terms: [...rotate(OFFER, 0, 6), ...rotate(PHONE_TERMS, 0, 4)] }),
  ...[0, 1, 2].map((i) => makePage(HOST, { path: `/offer/service-${i}`, title: `Service ${i}`, terms: [...rotate(OFFER, i, 5), ...rotate(PHONE_TERMS, i * 3, 5)] })),
  ...Array.from({ length: 30 }, (_, i) => makePage(HOST, { path: `/blog/post-${i}`, title: `Post ${i}`, terms: rotate(DIABETES_TERMS, i, 14) })),
];

const build = (pages: FocusPage[], anchorUrls?: string[], manualTopic?: string) =>
  buildSiteFocusReport(pages, START, { anchorUrls, manualTopic, language: 'en', now: NOW });
const coreText = (pages: FocusPage[], anchorUrls?: string[], manualTopic?: string): string =>
  build(pages, anchorUrls, manualTopic).coreTopic.terms.map((term) => term.term).join(' ');

describe('Site Focus anchored Core Topic (#82)', () => {
  it('auto mode lets a large blog win; anchors keep the offer as Core Topic', () => {
    const pages = bigBlogSmallOffer();
    const auto = build(pages);
    expect(auto.coreTopic.mode).toBe('auto');
    expect(auto.coreTopic.anchors).toBeUndefined();
    expect(coreText(pages)).toMatch(/insulin|glucose|diabetes/);
    const anchored = build(pages, [`https://${HOST}/offer/service-0`, `https://${HOST}/offer/service-1/`]);
    expect(anchored.coreTopic.mode).toBe('anchored');
    expect(anchored.coreTopic.anchors).toEqual({
      sources: [START, `https://${HOST}/offer/service-0`, `https://${HOST}/offer/service-1`], missing: [], applied: true,
    });
    expect(coreText(pages, [`https://${HOST}/offer/service-0`])).toMatch(/repair|battery|warranty|smartphone/);
    expect(anchored.coreTopic.clusterId).not.toBe(auto.coreTopic.clusterId);
  });

  it('does not mutate the input crawl and is deterministic', () => {
    const pages = bigBlogSmallOffer();
    const snapshot = JSON.stringify(pages);
    const anchors = [`https://${HOST}/offer/service-2`];
    expect(build(pages, anchors)).toEqual(build(pages, anchors));
    expect(JSON.stringify(pages)).toBe(snapshot);
  });

  it('manual topic outranks anchors, which are then reported as not applied', () => {
    const report = build(bigBlogSmallOffer(), [`https://${HOST}/offer/service-0`], 'insulin');
    expect(report.coreTopic.mode).toBe('manual');
    expect(report.coreTopic.anchors?.applied).toBe(false);
  });

  it('reports missing, malformed and unscored anchors instead of guessing', () => {
    const pages = [...bigBlogSmallOffer(), makePage(HOST, { path: '/hidden', title: 'Hidden', terms: rotate(OFFER, 0, 6), patch: { http_status: 404 } })];
    const report = build(pages, ['  ', 'not a url', `https://${HOST}/nope`, `https://${HOST}/hidden`, 'x'.repeat(MAX_ANCHOR_URL_LENGTH + 1)]);
    expect(report.coreTopic.anchors?.missing).toEqual(['not a url', `https://${HOST}/nope`, `https://${HOST}/hidden`]);
    expect(report.coreTopic.anchors?.sources).toEqual([START]);
    expect(report.coreTopic.mode).toBe('anchored');
  });

  it('falls back to auto when home is unavailable and no anchor resolves', () => {
    const pages = bigBlogSmallOffer().slice(1);
    const report = build(pages, [`https://${HOST}/gone`]);
    expect(report.coreTopic.mode).toBe('auto');
    expect(report.coreTopic.anchors).toEqual({ sources: [], missing: [START, `https://${HOST}/gone`], applied: false });
    expect(report.coreTopic.clusterId).toBe(build(pages).coreTopic.clusterId);
  });

  it('resolves anchors through redirect target and canonical, own URL first', () => {
    const pages = bigBlogSmallOffer();
    pages[1] = { ...pages[1], url: `https://${HOST}/old-service`, final_url: `https://${HOST}/offer/service-0` };
    pages[2] = { ...pages[2], canonical: `https://${HOST}/offer/main` };
    pages[3] = { ...pages[3], canonical: `https://${HOST}/offer/service-0` };
    const anchorUrls = [`https://${HOST}/old-service`, `https://${HOST}/offer/main`, `https://${HOST}/offer/service-0`];
    // Canonicalized pages are gated out by default, so their canonical target cannot anchor.
    expect(build(pages, anchorUrls).coreTopic.anchors?.missing).toEqual([`https://${HOST}/offer/main`]);
    const opted = buildSiteFocusReport(pages, START, { anchorUrls, includeNonIndexable: true, language: 'en', now: NOW });
    expect(opted.coreTopic.anchors?.sources).toEqual([START, ...anchorUrls]);
    expect(opted.coreTopic.anchors?.missing).toEqual([]);
  });

  it('caps the anchor list and ignores anchors without clustered terms', () => {
    const many = Array.from({ length: MAX_ANCHORS + 5 }, (_, i) => `https://${HOST}/m${i}`);
    expect(build(bigBlogSmallOffer(), many).coreTopic.anchors?.missing).toHaveLength(MAX_ANCHORS);
    const empty = [makePage(HOST, { path: '/', title: 'Home', terms: [] }), ...bigBlogSmallOffer().slice(4)];
    expect(build(empty, [`https://${HOST}/blog/post-0`]).coreTopic.mode).toBe('anchored');
    expect(build([], [START]).coreTopic.mode).toBe('auto');
  });

  it('a scored page whose TF-IDF mass is zero resolves but contributes no weight', () => {
    const page = makePage(HOST, { path: '/', title: 'Home', terms: [['service', 1]] });
    const live = [{ page, terms: {} } as unknown as Prepared];
    expect(resolveAnchors(live, [new Map([['service', 0]])], START, [START])).toEqual({ sources: [START], missing: [], applied: false, mass: new Map() });
  });
});
