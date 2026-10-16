import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { FocusPage } from '@/services/siteFocus';
import { ELECTRONICS, FASHION, HOME, topicArticles } from './siteFocusFixtures';
import { NOW } from './siteFocusBranchesHelpers';

describe('sub-site detection fallbacks', () => {
  const topic = (prefix: string, pool: string[], count: number, urlFor: (i: number) => string) =>
    topicArticles('shop.test', prefix, pool, count, 8).map((page, i) => ({ ...page, url: urlFor(i), final_url: urlFor(i) }));
  const reportFor = (pages: FocusPage[]) => buildSiteFocusReport(pages, 'https://shop.test/', { now: NOW });

  it('handles clusters whose pages sit at the site root, split across segments, or lack final_url', () => {
    const root = topic('/x', ELECTRONICS, 10, (i) => `https://shop.test/?e=${i}`);
    const split = topic('/y', FASHION, 10, (i) => `https://shop.test/${i % 2 ? 'fa' : 'fb'}/item-${i}`);
    const reversedSplit = topic('/y', FASHION, 10, (i) => `https://shop.test/${i % 2 ? 'fb' : 'fa'}/item-${i}`);
    [['fa', 'fb', 'fc'], ['fc', 'fb', 'fa'], ['fb', 'fc', 'fa'], ['fb', 'fa', 'fc']].forEach((order) => {
      const three = topic('/y', FASHION, 12, (i) => `https://shop.test/${order[i % 3]}/item-${i}`);
      reportFor([...root, ...three, ...topic('/home', HOME, 10, (i) => `https://shop.test/home/item-${i}`)]);
    });
    reportFor([...root, ...reversedSplit, ...topic('/home', HOME, 10, (i) => `https://shop.test/home/item-${i}`)]);
    const plain = topic('/home', HOME, 10, (i) => `https://shop.test/home/item-${i}`).map((page, i) => (i % 2 ? { ...page, final_url: '' } : page));
    const report = reportFor([...root, ...split, ...plain]);
    expect(report.flags.isMultiTopic === (report.subSites?.length ? true : report.flags.isMultiTopic)).toBe(true);
  });

  it('computes sub-site scores when final_url is missing on member pages', () => {
    const pages = [
      ...topic('/electronics', ELECTRONICS, 10, (i) => `https://shop.test/electronics/item-${i}`),
      ...topic('/fashion', FASHION, 10, (i) => `https://shop.test/fashion/item-${i}`),
      ...topic('/home', HOME, 10, (i) => `https://shop.test/home/item-${i}`),
    ].map((page, i) => (i % 2 ? { ...page, final_url: '' } : page));
    const report = reportFor(pages);
    expect(report.subSites?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('rejects two clusters that share one url prefix', () => {
    const pages = [
      ...topic('/shared', ELECTRONICS, 10, (i) => `https://shop.test/shared/e-${i}`),
      ...topic('/shared', FASHION, 10, (i) => `https://shop.test/shared/f-${i}`),
    ];
    expect(reportFor(pages).subSites).toBeUndefined();
  });
});
