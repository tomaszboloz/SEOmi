import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { computeCrawlLinksData, getLinkStatusDisplay } from '@/components/Domain/crawlResults/linksTab/crawlLinksTabHelpers';
import type { CrawledLink, CrawledPageSummary } from '@/types';

const link = (over: Record<string, unknown>) => ({ target_url: 'https://a.test/x', is_internal: true, ...over }) as unknown as CrawledLink;
const t = i18n.t.bind(i18n);

describe('getLinkStatusDisplay', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it.each([
    [{ target_http_status: 404 }, 'text-rose-300', false, () => t('crawl.ui.httpStatus', { status: 404 })],
    [{ target_http_status: 301, target_checked_at: 'x' }, 'text-amber-300', false, () => t('crawl.ui.httpStatus', { status: 301 })],
    [{ target_http_status: 200, target_checked_at: 'x' }, 'text-emerald-300', false, () => t('crawl.ui.httpStatus', { status: 200 })],
    [{ target_http_status: 200 }, 'text-slate-400', false, () => t('crawl.ui.httpStatus', { status: 200 })],
    [{ target_request_error_kind: 'blocked', target_checked_at: 'x' }, 'text-slate-400', false, () => t('crawl.ui.blockedPrivateAddress')],
    [{ target_request_error_kind: 'invalid' }, 'text-rose-300', true, () => t('crawl.ui.invalidAddress')],
    [{ target_request_error_kind: 'dns' }, 'text-rose-300', true, () => t('crawl.ui.requestError', { kind: 'dns' })],
    [{}, 'text-slate-400', false, () => t('crawl.ui.notChecked')],
  ])('maps %j', (over, color, failure, label) => {
    expect(getLinkStatusDisplay(link(over), t)).toEqual({ status: label(), hasRequestFailure: failure, statusColorClass: color });
  });
});

describe('computeCrawlLinksData', () => {
  const pages = [
    { url: 'https://a.test/', links: [
      link({ target_url: 'https://a.test/ok#frag', target_http_status: 200 }),
      link({ target_url: 'https://a.test/ok', target_http_status: 200 }),
      link({ target_url: 'https://a.test/bad', target_http_status: 404 }),
      link({ target_url: 'https://a.test/down', target_http_status: 0 }),
      link({ target_url: 'https://a.test/todo' }),
      link({ target_url: 'https://x.test/1', is_internal: false }),
      link({ target_url: 'https://x.test/2', is_internal: false, target_checked_at: 't', target_http_status: 200 }),
      link({ target_url: 'https://x.test/3', is_internal: false, target_checked_at: 't', target_request_error_kind: 'blocked' }),
      link({ target_url: 'https://x.test/4', is_internal: false, target_checked_at: 't', target_request_error_kind: 'invalid' }),
      link({ target_url: 'https://x.test/5', is_internal: false, target_checked_at: 't', target_request_error_kind: 'dns' }),
    ] },
    { url: 'https://a.test/page2', links: [link({ target_url: 'https://a.test/bad', target_http_status: 500 })] },
  ] as unknown as CrawledPageSummary[];
  const run = (over: Record<string, unknown> = {}) => computeCrawlLinksData({ pages, query: '', kind: 'all', status: 'all', sort: 'source', descending: false, ...over } as never);

  it('flattens links with stable keys and aggregates internal counts', () => {
    const d = run();
    expect(d.allLinks).toHaveLength(11);
    expect(d.allLinks[0].key).toBe('https://a.test/-https://a.test/ok#frag-0');
    expect(d.internalLinks).toHaveLength(6);
    expect(d.uniqueInternalTargets.size).toBe(4);
    expect([...d.checkedInternalTargets].sort()).toEqual(['https://a.test/bad', 'https://a.test/down', 'https://a.test/ok']);
    expect([...d.brokenInternalTargets].sort()).toEqual(['https://a.test/bad', 'https://a.test/down']);
    expect(d.uncheckedInternalCount).toBe(1);
  });

  it('counts external targets by check and error kind', () => {
    const d = run();
    expect(d.externalLinks).toHaveLength(5);
    expect(d.uncheckedExternalCount).toBe(1);
    expect(d.checkedExternalCount).toBe(2);
    expect(d.blockedExternalCount).toBe(1);
    expect(d.invalidExternalCount).toBe(1);
  });

  it('applies the query filter to the visible links only', () => {
    const d = run({ query: 'x.test/2' });
    expect(d.links.map((l: { link: CrawledLink }) => l.link.target_url)).toEqual(['https://x.test/2']);
    expect(d.allLinks).toHaveLength(11);
  });

  it('never reports a negative unchecked count', () => {
    const d = computeCrawlLinksData({ pages: [], query: '', kind: 'all', status: 'all', sort: 'source', descending: false } as never);
    expect(d.uncheckedInternalCount).toBe(0);
    expect(d.links).toEqual([]);
  });
});
